import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as actions from '../server/actions.ts'
import { DOOP_GUIDE, TEMPLATE_GUIDE } from '../server/guide.ts'
import { buildMcpServer } from '../server/mcp.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import { store } from '../server/store.ts'
import type { Canvas, Frame } from '../shared/types.ts'

/**
 * TASK-31 Task 3 RED: the shared template guide must reach both the MCP
 * `get_guide` output and the resident system prompt, and real
 * agent/MCP edits must keep passing through the server guard —
 * permission comes from the trusted server identity, never actor names.
 */

vi.mock('../server/db/persist.ts', () => ({
  saveFrame: vi.fn(),
  saveCanvas: vi.fn(),
  saveActivity: vi.fn(),
  saveTask: vi.fn(),
  saveFeedback: vi.fn(),
  saveComment: vi.fn(),
  saveDecision: vi.fn(),
  saveProposal: vi.fn(),
  saveGuideline: vi.fn(),
  deleteGuideline: vi.fn(),
  saveGuidelineVersion: vi.fn(),
  listGuidelineVersions: () => [],
  saveReference: vi.fn(),
  deleteReference: vi.fn(),
  saveFrameVersion: vi.fn(),
  listFrameVersions: async () => [],
  getFrameVersion: vi.fn(),
  saveCanvasCopy: vi.fn(),
  savePageCopy: vi.fn(),
  saveMember: vi.fn(),
  deleteMember: vi.fn(),
  deleteCanvas: vi.fn(),
  deleteFrame: vi.fn(),
  flush: async () => {},
  hydrate: async () => ({}),
  importLegacyJson: async () => null,
}))
vi.mock('../server/prowin/accounts.ts', () => ({
  permissionIdentity: async (userId: string) => ({ userId, admin: false, creator: userId === 'creator-id' }),
}))
vi.mock('../server/agentModel.ts', () => ({
  pickModel: mocks.pickModel,
  ModelAuthError: class extends Error {},
  ModelUnavailableError: class extends Error {},
}))
vi.mock('../server/residentAdmission.ts', () => ({ prepareServerWork: mocks.prepareServerWork }))
vi.mock('../server/screenshot.ts', () => ({
  renderFrame: mocks.renderFrame,
  inspectFrame: mocks.inspectFrame,
  findBrowserPath: () => null,
}))
vi.mock('../server/allowance.ts', () => ({
  get RESIDENT_TASK_LIMIT() {
    return 1
  },
}))

const mocks = vi.hoisted(() => ({
  pickModel: vi.fn(),
  prepareServerWork: vi.fn(),
  renderFrame: vi.fn(),
  inspectFrame: vi.fn(),
}))

await import('../server/resident.ts')

const CREATOR = 'creator-id'
const MATE = 'mate-id'
const creatorActor = { name: 'Creator', kind: 'user', color: '#111' } as const

const FIELD = '<h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel">Hallo</h1>'
const LOCKED = '<p data-od-id="intro" data-od-role="body" data-od-locked="true">Text</p>'
const TEMPLATE = `<!doctype html><html><head><title>Vorlage</title></head><body><div>${FIELD}${LOCKED}</div></body></html>`
/* nested length fixture: outer text is "Hi Du" (5 code points), inner has no own limit */
const NESTED =
  `<!doctype html><html><head><title>V</title></head><body>` +
  `<div data-od-id="aussen" data-od-role="body" data-od-max-length="5">Hi ` +
  `<span data-od-id="innen" data-od-role="body">Du</span></div></body></html>`
const LIMITED =
  `<!doctype html><html><head><title>V</title></head><body>` +
  `<p data-od-id="kurz" data-od-role="body" data-od-max-length="2">OK</p></body></html>`

/* every surface must carry the same contract — one list, checked twice */
const CONTRACT = [
  'data-od-id',
  'data-od-role',
  'data-od-label',
  'data-od-locked',
  'data-od-max-length',
  'data-od-allowed-colors',
  'manageLocks',
  'var(--',
  '403',
  'agent_name',
]

function seedCanvas() {
  store.init([
    {
      id: 'guide',
      name: 'Guide',
      ownerId: CREATOR,
      memberIds: [MATE],
      frames: [],
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Canvas,
  ])
  actions.wire(
    () => {},
    () => {},
  )
  actions.hydrateLogs({
    tasks: new Map([['guide', []]]),
    feedback: new Map([['guide', []]]),
    comments: new Map([['guide', []]]),
    activity: new Map([['guide', []]]),
    decisions: new Map([['guide', []]]),
    proposals: new Map([['guide', []]]),
  })
}

async function templateFrame(html = TEMPLATE): Promise<Frame> {
  let frame!: Frame
  await withUserPermissions(CREATOR, () => {
    frame = actions.createFrame('guide', { name: 'Template', html }, { ...creatorActor })!
  })
  return frame
}

async function guideText(): Promise<string> {
  const server = buildMcpServer('Mate', MATE)
  const client = new Client({ name: 'guide-test', version: '1.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  await client.connect(a)
  try {
    const result = await withUserPermissions(MATE, () =>
      client.callTool({ name: 'get_guide', arguments: { topic: 'doop-instructions' } }),
    )
    return (result.content as Array<{ type: string; text?: string }>)
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n')
  } finally {
    await client.close()
    await server.close()
  }
}

function tool(client: Client, name: string, args: Record<string, unknown>, userId: string) {
  return withUserPermissions(userId, () => client.callTool({ name, arguments: args }))
}

async function connectAs(userName: string, userId: string) {
  const server = buildMcpServer(userName, userId)
  const client = new Client({ name: 'guide-edit-test', version: '1.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  await client.connect(a)
  return {
    client,
    close: async () => {
      await client.close()
      await server.close()
    },
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pickModel.mockReset()
  mocks.prepareServerWork.mockReset().mockResolvedValue(true)
  mocks.renderFrame.mockReset().mockResolvedValue(Buffer.from('shot'))
  mocks.inspectFrame.mockReset().mockResolvedValue(null)
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seedCanvas()
})

describe('shared template guide', () => {
  it('exposes one shared section listing all six attributes', () => {
    expect(TEMPLATE_GUIDE).toContain('data-od-id')
    expect(DOOP_GUIDE).toContain(TEMPLATE_GUIDE)
  })

  it('reaches MCP get_guide with role, length, token, structure and 403 rules', async () => {
    const text = await guideText()
    expect(text).toContain(TEMPLATE_GUIDE)
    for (const needle of CONTRACT) expect(text, needle).toContain(needle)
    /* exact contract details, not just keywords */
    expect(text).toContain('data-od-locked')
    expect(text).toContain('Unicode')
    expect(text).toContain('ancestor')
    expect(text).toContain('frozen')
    expect(text).toContain('stable')
  })

  it('reaches the resident system prompt with the same rules', async () => {
    const captured: Array<{ system: Array<{ text: string }> }> = []
    mocks.pickModel.mockResolvedValue({
      provider: 'test',
      label: 'fake model',
      userId: 'test-payer',
      vision: false,
      run: async (req: { system: Array<{ text: string }> }) => {
        captured.push(JSON.parse(JSON.stringify(req)))
        return { content: [], stop_reason: 'refusal' }
      },
    })
    const card = actions.addQueuedCard('guide', 'Guide pruefen', 'Mate', undefined, undefined, MATE)!
    await vi.waitFor(() => expect(card.failedAt).toBeDefined(), { timeout: 20_000 })
    const system = captured[0]?.system.map((block) => block.text).join('\n\n') ?? ''
    expect(system).toContain(TEMPLATE_GUIDE)
    for (const needle of CONTRACT) expect(system, needle).toContain(needle)
    expect(system).toContain('Unicode')
    expect(system).toContain('403')
  })
})

describe('guide-backed agent edits', () => {
  it('applies a permitted member edit but leaves the baseline on locked/length rejects', async () => {
    const frame = await templateFrame()
    const before = store.getFrame(frame.id)!
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const ok = await tool(
        client,
        'set_frame_html',
        { frame_id: frame.id, html: before.html.replace('>Hallo<', '>Hallo Welt<'), agent_name: 'Mate' },
        MATE,
      )
      expect(ok.isError, JSON.stringify(ok)).not.toBe(true)
      const mid = store.getFrame(frame.id)!.html
      expect(mid).toContain('Hallo Welt')
      const denied = await tool(
        client,
        'set_frame_html',
        { frame_id: frame.id, html: mid.replace('>Text<', '>Gehackt<'), agent_name: 'Mate' },
        MATE,
      )
      expect(denied.isError, JSON.stringify(denied)).toBe(true)
      expect(store.getFrame(frame.id)!.html).toBe(mid)
    } finally {
      await close()
    }
  })

  it('denies Unicode and ancestor length violations', async () => {
    const nested = await templateFrame(NESTED)
    const limited = await templateFrame(LIMITED)
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const nestedBefore = store.getFrame(nested.id)!.html
      /* "Du" -> "Duu" pushes the outer field from 5 to 6 code points */
      const ancestor = await tool(
        client,
        'set_frame_html',
        { frame_id: nested.id, html: nestedBefore.replace('>Du<', '>Duu<'), agent_name: 'Mate' },
        MATE,
      )
      expect(ancestor.isError, JSON.stringify(ancestor)).toBe(true)
      expect(store.getFrame(nested.id)!.html).toBe(nestedBefore)
      const limitedBefore = store.getFrame(limited.id)!.html
      /* three emoji are three code points over a limit of two */
      const unicode = await tool(
        client,
        'set_frame_html',
        { frame_id: limited.id, html: limitedBefore.replace('>OK<', '>✅✅✅<'), agent_name: 'Mate' },
        MATE,
      )
      expect(unicode.isError, JSON.stringify(unicode)).toBe(true)
      expect(store.getFrame(limited.id)!.html).toBe(limitedBefore)
    } finally {
      await close()
    }
  })

  it('decides by server identity, never by actor names', async () => {
    const frame = await templateFrame()
    const before = store.getFrame(frame.id)!.html
    const { client, close } = await connectAs('Mate', MATE)
    try {
      /* claiming to be the Creator in agent_name buys no manageLocks */
      const escalated = await tool(
        client,
        'set_frame_html',
        { frame_id: frame.id, html: before.replace('>Text<', '>Gehackt<'), agent_name: 'Creator' },
        MATE,
      )
      expect(escalated.isError, JSON.stringify(escalated)).toBe(true)
      expect(store.getFrame(frame.id)!.html).toBe(before)
    } finally {
      await close()
    }
  })

  it('lets explicit Creator authoring change locked content under real permission', async () => {
    const frame = await templateFrame()
    const before = store.getFrame(frame.id)!
    const { client, close } = await connectAs('Creator', CREATOR)
    try {
      const result = await tool(
        client,
        'set_frame_html',
        { frame_id: frame.id, html: before.html.replace('>Text<', '>Neu vom Creator<'), agent_name: 'Creator' },
        CREATOR,
      )
      expect(result.isError, JSON.stringify(result)).not.toBe(true)
      expect(store.getFrame(frame.id)!.html).toContain('Neu vom Creator')
    } finally {
      await close()
    }
  })
})
