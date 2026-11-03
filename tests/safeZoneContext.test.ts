import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as actions from '../server/actions.ts'
import { DOOP_GUIDE, SAFE_ZONE_GUIDE } from '../server/guide.ts'
import { buildMcpServer } from '../server/mcp.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import { store } from '../server/store.ts'
import type { Canvas, Frame } from '../shared/types.ts'

/**
 * TASK-33 Task 3 RED: shared agent guidance plus effective safe-zone values
 * in MCP/Resident context, and export isolation (stored/downloaded HTML and
 * server renders carry no overlay DOM).
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
const HTML = '<!doctype html><html><head><title>T</title></head><body><h1>Hi</h1></body></html>'

function seedCanvas() {
  store.init([
    {
      id: 'ctx',
      name: 'Ctx',
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
    tasks: new Map([['ctx', []]]),
    feedback: new Map([['ctx', []]]),
    comments: new Map([['ctx', []]]),
    activity: new Map([['ctx', []]]),
    decisions: new Map([['ctx', []]]),
    proposals: new Map([['ctx', []]]),
  })
}

async function makeFrame(patch: Record<string, unknown> = {}): Promise<Frame> {
  let frame!: Frame
  await withUserPermissions(CREATOR, () => {
    frame = actions.createFrame('ctx', { name: 'F', preset: 'ig-post', html: HTML, ...patch }, { ...creatorActor })!
  })
  return frame
}

async function callMcp(userName: string, userId: string, name: string, args: Record<string, unknown>) {
  const server = buildMcpServer(userName, userId)
  const client = new Client({ name: 'ctx-test', version: '1.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  await client.connect(a)
  try {
    return await withUserPermissions(userId, () => client.callTool({ name, arguments: args }))
  } finally {
    await client.close()
    await server.close()
  }
}

function framePayload(result: unknown): Record<string, unknown> {
  const content = (result as { content: Array<{ type: string; text?: string }> }).content
  const first = content.find((b) => b.type === 'text')?.text ?? '{}'
  return JSON.parse(first)
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pickModel.mockReset()
  mocks.prepareServerWork.mockReset().mockResolvedValue(true)
  mocks.renderFrame.mockReset().mockResolvedValue(Buffer.from('shot'))
  mocks.inspectFrame.mockReset().mockResolvedValue({ document: {}, design: {}, elements: [] })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  seedCanvas()
})

describe('SAFE_ZONE_GUIDE', () => {
  it('lists all five preset defaults', () => {
    for (const preset of ['ig-post', 'ig-story', 'wa-status', 'fb-post', 'a4']) {
      expect(SAFE_ZONE_GUIDE, preset).toContain(preset)
    }
    expect(SAFE_ZONE_GUIDE).toContain('50')
    expect(SAFE_ZONE_GUIDE).toContain('200')
    expect(SAFE_ZONE_GUIDE).toContain('250')
    expect(SAFE_ZONE_GUIDE).toContain('150')
    expect(SAFE_ZONE_GUIDE).toContain('11')
  })

  it('tells agents to check the zone before creating and keep text/CTA inside', () => {
    expect(SAFE_ZONE_GUIDE.toLowerCase()).toMatch(/before (creating|adding)/)
    expect(SAFE_ZONE_GUIDE.toLowerCase()).toContain('inner')
    expect(SAFE_ZONE_GUIDE).toMatch(/CTA/i)
    expect(SAFE_ZONE_GUIDE.toLowerCase()).toContain('text')
  })

  it('states the correct millimetre math and no bleed/print-ready promise', () => {
    expect(SAFE_ZONE_GUIDE).toContain('11.34')
    expect(SAFE_ZONE_GUIDE).toContain('35.43')
    expect(SAFE_ZONE_GUIDE).toContain('34.375')
    expect(SAFE_ZONE_GUIDE.toLowerCase()).not.toContain('print-ready')
    expect(SAFE_ZONE_GUIDE.toLowerCase()).toContain('bleed')
  })

  it('reaches both the MCP guide and the resident system prompt', async () => {
    expect(DOOP_GUIDE).toContain(SAFE_ZONE_GUIDE)
    await makeFrame()
    const captured: Array<{ system: Array<{ text: string }>; messages?: unknown }> = []
    mocks.pickModel.mockResolvedValue({
      provider: 'test',
      label: 'fake model',
      userId: 'test-payer',
      vision: false,
      run: async (req: { system: Array<{ text: string }>; messages: unknown }) => {
        captured.push({ system: JSON.parse(JSON.stringify(req.system)), messages: req.messages })
        return { content: [], stop_reason: 'refusal' }
      },
    })
    const card = actions.addQueuedCard('ctx', 'Guide pruefen', 'Mate', undefined, undefined, MATE)!
    await vi.waitFor(() => expect(card.failedAt).toBeDefined(), { timeout: 20_000 })
    const system = captured[0]?.system.map((b) => b.text).join('\n\n') ?? ''
    expect(system).toContain(SAFE_ZONE_GUIDE)
    // Resident frame list uses effective values regardless of overlay visibility.
    expect(JSON.stringify(captured[0]?.messages ?? '')).toContain('safe-zone 50/50/50/50 (preset)')
  })
})

describe('millimetre math', () => {
  it('3mm converts to 11.34 CSS px, 35.43 raster px, 34.375 at export scale', () => {
    expect((3 * 96) / 25.4).toBeCloseTo(11.34, 2)
    expect(Math.round((3 * 96) / 25.4)).toBe(11)
    expect((3 * 300) / 25.4).toBeCloseTo(35.43, 2)
    expect(11 * 3.125).toBe(34.375)
  })
})

describe('MCP frame context', () => {
  it('reports inherited preset values with a preset source', async () => {
    const frame = await makeFrame()
    const res = await callMcp('Mate', MATE, 'get_frame', { frame_id: frame.id })
    expect(res.isError).not.toBe(true)
    expect(framePayload(res)).toMatchObject({
      safeZone: { top: 50, right: 50, bottom: 50, left: 50 },
      safeZoneSource: 'preset',
    })
  })

  it('reports the override once set, zeroes included', async () => {
    const frame = await makeFrame()
    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(frame.id, { safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } }, { ...creatorActor })
    })
    const res = await callMcp('Mate', MATE, 'get_frame', { frame_id: frame.id })
    expect(framePayload(res)).toMatchObject({
      safeZone: { top: 0, right: 0, bottom: 0, left: 0 },
      safeZoneSource: 'override',
    })
  })

  it('reports null/none without a preset and uses effective values in canvas lists', async () => {
    await makeFrame()
    const plain = await makeFrame({ preset: undefined })
    const single = await callMcp('Mate', MATE, 'get_frame', { frame_id: plain.id })
    expect(framePayload(single)).toMatchObject({ safeZone: null, safeZoneSource: 'none' })
    const canvas = await callMcp('Mate', MATE, 'get_canvas', { canvas_id: 'ctx' })
    const body = framePayload(canvas) as { frames: Array<Record<string, unknown>> }
    const listed = body.frames.find((f) => f.id === plain.id)!
    expect(listed).toMatchObject({ safeZone: null, safeZoneSource: 'none' })
    const inherited = body.frames.find((f) => f.id !== plain.id)
    expect(inherited).toMatchObject({
      safeZone: { top: 50, right: 50, bottom: 50, left: 50 },
      safeZoneSource: 'preset',
    })
  })

  it('carries effective values on created frames regardless of overlay visibility', async () => {
    const res = await callMcp('Creator', CREATOR, 'create_frame', {
      canvas_id: 'ctx',
      name: 'Story',
      preset: 'ig-story',
      html: HTML,
      agent_name: 'Creator',
    })
    expect(res.isError, JSON.stringify(res)).not.toBe(true)
    // Overlay visibility is a local UI preference; the MCP summary still reports effective insets.
    expect(framePayload(res).frame).toMatchObject({
      safeZone: { top: 200, right: 0, bottom: 250, left: 0 },
      safeZoneSource: 'preset',
    })
  })
})

describe('export isolation', () => {
  it('leaves stored HTML byte-identical across Creator metadata edits', async () => {
    const frame = await makeFrame()
    const before = store.getFrame(frame.id)!.html
    expect(before).not.toContain('data-safe-zone')
    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(frame.id, { safeZoneOverride: { top: 5, right: 5, bottom: 5, left: 5 } }, { ...creatorActor })
    })
    const edited = store.getFrame(frame.id)!.html
    expect(edited).toBe(before)
    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(frame.id, { safeZoneOverride: null }, { ...creatorActor })
    })
    expect(store.getFrame(frame.id)!.html).toBe(before)
  })

  it('renders server images from stored HTML with no overlay DOM', async () => {
    const { getImage } = await import('../server/previews.ts')
    const frame = await makeFrame()
    for (const ext of ['png', 'jpg'] as const) {
      const result = await getImage(
        { ...store.getFrame(frame.id)! },
        {
          ext,
          scale: 1,
          quality: 90,
          preview: false,
          ip: 'test',
          isAuthenticated: async () => true,
        },
      )
      expect(result.status).toBe('ok')
      if (result.status !== 'ok') continue
      const [html] = mocks.renderFrame.mock.calls.map((c) => (c[0] as Frame).html)
      expect(html).toBe(frame.html)
      expect(html).not.toContain('data-safe-zone')
      expect(result.buf.toString('utf8')).not.toContain('data-safe-zone')
    }
  })
})
