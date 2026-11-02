import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Window } from 'happy-dom'
import * as actions from '../server/actions.ts'
import { store } from '../server/store.ts'
import { buildMcpServer } from '../server/mcp.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import type { Canvas, Frame } from '../shared/types.ts'

/**
 * TASK-30 Task 3 RED: transport-level template enforcement. Real MCP tools
 * and real Resident runs must deny non-Creator locked writes (leaving frame,
 * versions and persistence untouched) while creator writes and member
 * source-backed copies succeed. A browser-style DOM reserialization must
 * keep working as an ordinary save.
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

const persist = await import('../server/db/persist.ts')
await import('../server/resident.ts')

const CREATOR = 'creator-id'
const MATE = 'mate-id'
const creatorActor = { name: 'Creator', kind: 'user', color: '#111' } as const
const mateActor = { name: 'Mate', kind: 'user', color: '#000' } as const

const FIELD = '<h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel">Hallo</h1>'
const LOCKED = '<p data-od-id="intro" data-od-role="body" data-od-locked="true">Text</p>'
/* full documents: set_frame_html and resident tools only accept complete
   HTML, so fragments would be rejected before ever reaching the guard */
const TEMPLATE = `<!doctype html><html><head><title>Vorlage</title></head><body><div>${FIELD}${LOCKED}</div></body></html>`

function seedCanvas() {
  store.init([
    {
      id: 'transports',
      name: 'Transports',
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
    tasks: new Map([['transports', []]]),
    feedback: new Map([['transports', []]]),
    comments: new Map([['transports', []]]),
    activity: new Map([['transports', []]]),
    decisions: new Map([['transports', []]]),
    proposals: new Map([['transports', []]]),
  })
}

async function templateFrame(): Promise<Frame> {
  let frame!: Frame
  await withUserPermissions(CREATOR, () => {
    frame = actions.createFrame('transports', { name: 'Template', html: TEMPLATE }, { ...creatorActor })!
  })
  return frame
}

function stored(id: string): Frame {
  return store.getFrame(id)!
}

async function connectAs(userName: string, userId: string) {
  const server = buildMcpServer(userName, userId)
  const client = new Client({ name: 'transport-test', version: '1.0' })
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

/* Production wraps every MCP request in the caller's trusted permission
   scope (server/mcp.ts handleMcpRequest); in-process calls do the same. */
function tool(client: Client, name: string, args: Record<string, unknown>, userId: string) {
  return withUserPermissions(userId, () => client.callTool({ name, arguments: args }))
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

describe('MCP template transports', () => {
  it('denies a member locked-text edit without touching frame or persistence', async () => {
    const frame = await templateFrame()
    const before = stored(frame.id)
    /* the creator seed above persisted once — the denied write must add nothing */
    vi.clearAllMocks()
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const result = await tool(
        client,
        'set_frame_html',
        { frame_id: frame.id, html: before.html.replace('>Text<', '>Gehackt<'), agent_name: 'Mate' },
        MATE,
      )
      expect(result.isError, JSON.stringify(result)).toBe(true)
      expect(stored(frame.id)).toEqual(before)
      expect(persist.saveFrame).not.toHaveBeenCalled()
      expect(persist.saveFrameVersion).not.toHaveBeenCalled()
    } finally {
      await close()
    }
  })

  it('denies a member locked-text edit through edit_frame_html too', async () => {
    const frame = await templateFrame()
    const before = stored(frame.id)
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const result = await tool(
        client,
        'edit_frame_html',
        { frame_id: frame.id, old_str: '>Text<', new_str: '>Gehackt<', agent_name: 'Mate' },
        MATE,
      )
      expect(result.isError, JSON.stringify(result)).toBe(true)
      expect(stored(frame.id)).toEqual(before)
    } finally {
      await close()
    }
  })

  it('denies member resize and delete of a template frame', async () => {
    const frame = await templateFrame()
    const before = stored(frame.id)
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const resized = await tool(client, 'update_frame', { frame_id: frame.id, width: 1200, agent_name: 'Mate' }, MATE)
      expect(resized.isError, JSON.stringify(resized)).toBe(true)
      const deleted = await tool(client, 'delete_frame', { frame_id: frame.id, agent_name: 'Mate' }, MATE)
      expect(deleted.isError, JSON.stringify(deleted)).toBe(true)
      expect(stored(frame.id)).toEqual(before)
    } finally {
      await close()
    }
  })

  it('lets a creator save a valid text edit', async () => {
    const frame = await templateFrame()
    const before = stored(frame.id)
    const { client, close } = await connectAs('Creator', CREATOR)
    try {
      const result = await tool(
        client,
        'set_frame_html',
        { frame_id: frame.id, html: before.html.replace('>Hallo<', '>Hallo Welt<'), agent_name: 'Creator' },
        CREATOR,
      )
      expect(result.isError, JSON.stringify(result)).not.toBe(true)
      expect(stored(frame.id).html).toContain('Hallo Welt')
    } finally {
      await close()
    }
  })

  it('exposes an optional source_frame_id on create_frame', async () => {
    const { client, close } = await connectAs('Creator', CREATOR)
    try {
      const { tools } = await client.listTools()
      const schema = tools.find((t) => t.name === 'create_frame')!.inputSchema as {
        properties?: Record<string, unknown>
        required?: string[]
      }
      expect(schema.properties).toEqual(expect.objectContaining({ source_frame_id: expect.any(Object) }))
      expect(schema.required).not.toContain('source_frame_id')
    } finally {
      await close()
    }
  })

  it('lets a member copy a template frame with its source id', async () => {
    const source = await templateFrame()
    const sourceHtml = stored(source.id).html
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const result = await tool(
        client,
        'create_frame',
        { canvas_id: 'transports', name: 'Kopie', html: sourceHtml, source_frame_id: source.id, agent_name: 'Mate' },
        MATE,
      )
      expect(result.isError, JSON.stringify(result)).not.toBe(true)
      const created = store.getCanvas('transports')!.frames.find((f) => f.id !== source.id)!
      expect(created.html).toBe(sourceHtml)
    } finally {
      await close()
    }
  })

  it('rejects a member template create without a source', async () => {
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const count = store.getCanvas('transports')!.frames.length
      const result = await tool(
        client,
        'create_frame',
        { canvas_id: 'transports', name: 'Frisch', html: TEMPLATE, agent_name: 'Mate' },
        MATE,
      )
      expect(result.isError, JSON.stringify(result)).toBe(true)
      expect(store.getCanvas('transports')!.frames).toHaveLength(count)
    } finally {
      await close()
    }
  })

  it('fails a copy from a deleted source closed instead of stripping locks', async () => {
    const source = await templateFrame()
    const sourceHtml = stored(source.id).html
    await withUserPermissions(CREATOR, () => actions.deleteFrame(source.id, { ...creatorActor }))
    const { client, close } = await connectAs('Mate', MATE)
    try {
      const count = store.getCanvas('transports')!.frames.length
      const result = await tool(
        client,
        'create_frame',
        { canvas_id: 'transports', name: 'Waise', html: sourceHtml, source_frame_id: source.id, agent_name: 'Mate' },
        MATE,
      )
      expect(result.isError, JSON.stringify(result)).toBe(true)
      expect(store.getCanvas('transports')!.frames).toHaveLength(count)
    } finally {
      await close()
    }
  })
})

/* Resident runs drive the real run loop with a scripted model (the seam the
   harness uses to pick a provider); tool errors surface in the next turn. */
const toolUse = (id: string, name: string, input: Record<string, unknown>) => ({
  content: [{ type: 'tool_use', id, name, input }],
  stop_reason: 'tool_use',
})
const doneTurn = () => ({ content: [{ type: 'text', text: 'Fertig.' }], stop_reason: 'end_turn' })

function scriptedModel(steps: Array<(req: unknown) => unknown>, captured: unknown[]) {
  return {
    provider: 'test',
    label: 'fake model',
    userId: 'test-payer',
    vision: false,
    run: async (req: unknown) => {
      captured.push(JSON.parse(JSON.stringify(req)))
      const step = steps[captured.length - 1]
      return step ? step(req) : doneTurn()
    },
  }
}

function sawToolError(captured: unknown[]): boolean {
  return JSON.stringify(captured).includes('"is_error":true')
}

function freshResidentCanvas(): Canvas {
  const canvas = store.createCanvas('resident-transports', CREATOR)!
  /* the member payer needs current canvas access for source-backed copies */
  canvas.memberIds = [MATE]
  actions.hydrateLogs({
    tasks: new Map([[canvas.id, []]]),
    feedback: new Map([[canvas.id, []]]),
    comments: new Map([[canvas.id, []]]),
    activity: new Map([[canvas.id, []]]),
    decisions: new Map([[canvas.id, []]]),
    proposals: new Map([[canvas.id, []]]),
  })
  return canvas
}

async function residentTemplateFrame(canvasId: string): Promise<Frame> {
  let frame!: Frame
  await withUserPermissions(CREATOR, () => {
    frame = actions.createFrame(canvasId, { name: 'Template', html: TEMPLATE }, { ...creatorActor })!
  })
  return frame
}

describe('resident template transports', () => {
  it('denies a member-run locked edit and leaves the frame unchanged', async () => {
    const canvas = freshResidentCanvas()
    const frame = await residentTemplateFrame(canvas.id)
    const before = stored(frame.id).html
    const captured: unknown[] = []
    mocks.pickModel.mockResolvedValue(
      scriptedModel(
        [
          () => toolUse('t1', 'set_frame_html', { frame_id: frame.id, html: before.replace('>Text<', '>Gehackt<') }),
          () => doneTurn(),
        ],
        captured,
      ),
    )
    const card = actions.addQueuedCard(canvas.id, 'Locked text aendern', 'Mate', undefined, undefined, MATE)!
    await vi.waitFor(() => expect(card.endedAt ?? card.failedAt).toBeDefined(), { timeout: 20_000 })
    expect(sawToolError(captured)).toBe(true)
    expect(stored(frame.id).html).toBe(before)
  }, 30_000)

  it('grants a missing payer no owner privilege on locked edits', async () => {
    const canvas = freshResidentCanvas()
    const frame = await residentTemplateFrame(canvas.id)
    const before = stored(frame.id).html
    const captured: unknown[] = []
    mocks.pickModel.mockResolvedValue(
      scriptedModel(
        [
          () => toolUse('t1', 'set_frame_html', { frame_id: frame.id, html: before.replace('>Text<', '>Gehackt<') }),
          () => doneTurn(),
        ],
        captured,
      ),
    )
    /* legacy card without an initiating user: payer falls back for billing
       only, never for write authority — the canvas owner is a creator */
    const card = actions.addQueuedCard(canvas.id, 'Locked text aendern', 'Someone')!
    await vi.waitFor(() => expect(card.endedAt ?? card.failedAt).toBeDefined(), { timeout: 20_000 })
    expect(sawToolError(captured)).toBe(true)
    expect(stored(frame.id).html).toBe(before)
  }, 30_000)

  it('applies a creator-run valid text edit', async () => {
    const canvas = freshResidentCanvas()
    const frame = await residentTemplateFrame(canvas.id)
    const before = stored(frame.id).html
    mocks.pickModel.mockResolvedValue(
      scriptedModel(
        [
          () =>
            toolUse('t1', 'set_frame_html', { frame_id: frame.id, html: before.replace('>Hallo<', '>Hallo Welt<') }),
        ],
        [],
      ),
    )
    const card = actions.addQueuedCard(canvas.id, 'Headline aendern', 'Creator', undefined, undefined, CREATOR)!
    await vi.waitFor(() => expect(card.endedAt ?? card.failedAt).toBeDefined(), { timeout: 20_000 })
    expect(card.failureReason, JSON.stringify(card)).toBeUndefined()
    expect(card.endedAt).toBeDefined()
    expect(stored(frame.id).html).toContain('Hallo Welt')
  }, 30_000)

  it('lets a member run create a source-backed template copy', async () => {
    const canvas = freshResidentCanvas()
    const source = await residentTemplateFrame(canvas.id)
    const sourceHtml = stored(source.id).html
    const captured: unknown[] = []
    mocks.pickModel.mockResolvedValue(
      scriptedModel(
        [
          () =>
            toolUse('t1', 'create_frame', {
              name: 'Kopie',
              width: source.width,
              height: source.height,
              html: sourceHtml,
              source_frame_id: source.id,
            }),
          () => doneTurn(),
        ],
        captured,
      ),
    )
    const card = actions.addQueuedCard(canvas.id, 'Template kopieren', 'Mate', undefined, undefined, MATE)!
    await vi.waitFor(() => expect(card.endedAt ?? card.failedAt).toBeDefined(), { timeout: 20_000 })
    expect(card.failureReason, JSON.stringify(card)).toBeUndefined()
    expect(card.endedAt).toBeDefined()
    const copy = store.getCanvas(canvas.id)!.frames.find((f) => f.id !== source.id)!
    expect(copy.html).toContain('data-od-id="titel"')
  }, 30_000)
})

describe('browser-style template saves', () => {
  it('accepts a happy-dom reserialization with an edited headline', async () => {
    const frame = await templateFrame()
    const before = stored(frame.id)
    /* an editor round-trips the live DOM: parse, type into a field,
       serialize the whole document back */
    const win = new Window()
    win.document.write(before.html)
    win.document.querySelector('[data-od-id="titel"]')!.textContent = 'Hallo Welt'
    /* outerHTML omits the doctype; a real editor save keeps it */
    const reserialized = `<!doctype html>${win.document.documentElement.outerHTML}`
    await win.close()
    let saved!: Frame
    await withUserPermissions(MATE, () => {
      saved = actions.updateFrame(frame.id, { html: reserialized }, { ...mateActor })!
    })
    expect(saved.html).toContain('Hallo Welt')
    expect(saved.html).toContain('data-od-locked="true"')
    expect(saved.html).toContain('>Text<')
  })
})
