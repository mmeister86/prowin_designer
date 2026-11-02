import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as actions from '../server/actions.ts'
import { store } from '../server/store.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import type { Canvas, Frame } from '../shared/types.ts'

vi.mock('../server/db/persist.ts', () => ({
  saveFrame: vi.fn(),
  saveCanvas: vi.fn(),
  saveActivity: vi.fn(),
  saveTask: vi.fn(),
  saveFeedback: vi.fn(),
  saveComment: vi.fn(),
  saveDecision: vi.fn(),
  saveProposal: vi.fn(),
  saveFrameVersion: vi.fn(),
  getFrameVersion: vi.fn(),
  saveGuideline: vi.fn(),
  saveGuidelineVersion: vi.fn(),
  saveReference: vi.fn(),
}))
vi.mock('../server/prowin/accounts.ts', () => ({
  permissionIdentity: async (userId: string) => ({ userId, admin: false, creator: userId === 'creator' }),
}))
const model = vi.hoisted(() => ({ pickModel: vi.fn() }))
vi.mock('../server/agentModel.ts', () => ({
  pickModel: model.pickModel,
  ModelAuthError: class extends Error {},
  ModelUnavailableError: class extends Error {},
}))
vi.mock('../server/residentAdmission.ts', () => ({ prepareServerWork: async () => true }))
vi.mock('../server/screenshot.ts', () => ({
  renderFrame: async () => Buffer.from('shot'),
  inspectFrame: async () => null,
  findBrowserPath: () => null,
}))
vi.mock('../server/allowance.ts', () => ({ RESIDENT_TASK_LIMIT: 1 }))
const persist = await import('../server/db/persist.ts')
await import('../server/resident.ts')
const actor = { name: 'Creator', kind: 'user', color: '#000' } as const
const broadcast = vi.fn()
const as = <T>(id: string, run: () => T) => withUserPermissions(id, run)
const create = (input: Record<string, unknown> = {}) =>
  actions.createFrame('c', { name: 'Frame', html: '<p>Design</p>', ...input }, { ...actor })!

beforeEach(() => {
  store.init([
    {
      id: 'c',
      name: 'Canvas',
      ownerId: 'creator',
      memberIds: ['mate'],
      frames: [],
      createdAt: 1,
      updatedAt: 1,
    } as Canvas,
  ])
  actions.wire(broadcast, () => {})
  actions.hydrateLogs({
    activity: new Map([['c', []]]),
    tasks: new Map([['c', []]]),
    feedback: new Map(),
    comments: new Map(),
    decisions: new Map(),
    proposals: new Map(),
  })
  vi.clearAllMocks()
})

describe('preset action boundary', () => {
  it.each([
    ['ig-post', 1080, 1080],
    ['ig-story', 1080, 1920],
    ['wa-status', 1080, 1920],
    ['fb-post', 1200, 630],
    ['a4', 794, 1123],
  ])('canonicalizes new %s frames, ignoring client dimensions', async (preset, width, height) => {
    const frame = await as('mate', () => create({ preset, width: 17, height: 23 }))
    expect(frame).toMatchObject({ preset, width, height })
  })

  it.each(['unknown', '__proto__', 'constructor', 'toString', '', null, 42, {}])(
    'rejects invalid creation preset %j before side effects',
    async (preset) => {
      const before = structuredClone(store.getCanvas('c'))
      await expect(as('creator', () => create({ preset }))).rejects.toMatchObject({ status: 400 })
      expect(store.getCanvas('c')).toEqual(before)
      expect(broadcast).not.toHaveBeenCalled()
      expect(persist.saveFrame).not.toHaveBeenCalled()
    },
  )

  it.each([
    { width: 1200 },
    { height: 800 },
    { preset: null },
    { preset: 'fb-post' },
    { preset: null, width: 900 },
    { preset: 'ig-post', width: 900 },
  ])('denies protected patch %j without ending a draft or changing history', async (patch) => {
    const frame = await as('creator', () => create({ preset: 'ig-post', width: 1080, height: 1080 }))
    await as('mate', () => actions.appendFrameHtml(frame.id, '<p>Draft', { ...actor }, { start: true }))
    const before = structuredClone(store.getCanvas('c'))
    const activity = structuredClone(actions.getActivity('c'))
    vi.clearAllMocks()
    await expect(
      as('mate', () => actions.updateFrame(frame.id, { ...patch, html: '<p>Changed</p>' } as never, { ...actor })),
    ).rejects.toMatchObject({ status: 403 })
    expect(store.getCanvas('c')).toEqual(before)
    expect(actions.getActivity('c')).toEqual(activity)
    expect(actions.hasAppendDraft(frame.id)).toBe(true)
    expect(persist.saveFrameVersion).not.toHaveBeenCalled()
    expect(persist.saveFrame).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
  })

  it.each(['__proto__', 'constructor', false, {}])('rejects invalid updates %j even for Creators', async (preset) => {
    const frame = await as('creator', () => create())
    const before = structuredClone(frame)
    await expect(
      as('creator', () => actions.updateFrame(frame.id, { preset } as never, { ...actor })),
    ).rejects.toMatchObject({ status: 400 })
    expect(store.getFrame(frame.id)).toEqual(before)
  })

  it('allows moves, same-value saves and free resizes; applying a preset canonicalizes', async () => {
    const frame = await as('mate', () => create())
    await as('mate', () => actions.updateFrame(frame.id, { width: 200, height: 300 }, { ...actor }))
    expect(frame).toMatchObject({ width: 200, height: 300 })
    await as('mate', () => actions.updateFrame(frame.id, { preset: 'fb-post', width: 10, height: 10 }, { ...actor }))
    expect(frame).toMatchObject({ preset: 'fb-post', width: 1200, height: 630 })
    await as('mate', () =>
      actions.updateFrame(frame.id, { preset: 'fb-post', width: 1200, height: 630, x: 42, y: 77 }, { ...actor }),
    )
    expect(frame).toMatchObject({ preset: 'fb-post', x: 42, y: 77, width: 1200, height: 630 })
  })

  it('lets Creators customize dimensions without losing identity, switch and explicitly remove it', async () => {
    const frame = await as('creator', () => create({ preset: 'ig-post' }))
    await as('creator', () => actions.updateFrame(frame.id, { width: 1111 }, { ...actor }))
    expect(frame).toMatchObject({ preset: 'ig-post', width: 1111 })
    await as('creator', () => actions.updateFrame(frame.id, { preset: 'a4' }, { ...actor }))
    expect(frame).toMatchObject({ preset: 'a4', width: 794, height: 1123 })
    await as('creator', () => actions.updateFrame(frame.id, { preset: null }, { ...actor }))
    expect(frame).not.toHaveProperty('preset')
  })

  it('does not reset customized sizes on same-preset member saves or weaken template geometry guards', async () => {
    const customized = await as('creator', () => create({ preset: 'ig-post' }))
    await as('creator', () => actions.updateFrame(customized.id, { width: 1111, height: 777 }, { ...actor }))
    await as('mate', () => actions.updateFrame(customized.id, { preset: 'ig-post', width: 1111, x: 42 }, { ...actor }))
    expect(customized).toMatchObject({ preset: 'ig-post', width: 1111, height: 777, x: 42 })
    const template = await as('creator', () => create({ html: '<p data-od-id="title">Template</p>' }))
    const before = structuredClone(template)
    await expect(
      as('mate', () => actions.updateFrame(template.id, { preset: 'a4' }, { ...actor })),
    ).rejects.toMatchObject({ status: 403 })
    expect(template).toEqual(before)
  })

  it('copies actual customized source dimensions and preset without canonicalizing them again', async () => {
    const source = await as('creator', () => create({ preset: 'ig-post' }))
    await as('creator', () => actions.updateFrame(source.id, { width: 1111, height: 777 }, { ...actor }))
    const copy = await as('mate', () => create({ sourceFrameId: source.id }))
    expect(copy).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
    const explicit = await as('mate', () =>
      create({ sourceFrameId: source.id, preset: 'ig-post', width: 1111, height: 777 }),
    )
    expect(explicit).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
    const changed = await as('creator', () => create({ sourceFrameId: source.id, preset: 'a4' }))
    expect(changed).toMatchObject({ preset: 'a4', width: 794, height: 1123 })
  })

  it('keeps customized copy defaults for Creators unless they explicitly choose another format', async () => {
    const source = await as('creator', () => create({ preset: 'ig-post' }))
    await as('creator', () => actions.updateFrame(source.id, { width: 1111, height: 777 }, { ...actor }))
    const implicit = await as('creator', () => create({ sourceFrameId: source.id }))
    expect(implicit).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
    const explicit = await as('creator', () => create({ sourceFrameId: source.id, preset: 'ig-post' }))
    expect(explicit).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
  })

  it.each([{ width: 999 }, { height: 999 }, { preset: 'a4' }])(
    'rejects forged source geometry/metadata %j',
    async (patch) => {
      const source = await as('creator', () => create({ preset: 'ig-post' }))
      const before = structuredClone(store.getCanvas('c'))
      await expect(as('mate', () => create({ sourceFrameId: source.id, ...patch }))).rejects.toMatchObject({
        status: 403,
      })
      expect(store.getCanvas('c')).toEqual(before)
    },
  )

  it('rejects missing and inaccessible sources without adding frames', async () => {
    const hidden = store.createCanvas('Hidden', 'creator')!
    const source = store.createFrame(
      hidden.id,
      { name: 'Secret', preset: 'ig-post', width: 1111, height: 777 },
      'Creator',
    )!
    const before = structuredClone(store.getCanvas('c'))
    await expect(as('mate', () => create({ sourceFrameId: 'missing', preset: 'ig-post' }))).rejects.toMatchObject({
      status: 404,
    })
    await expect(as('mate', () => create({ sourceFrameId: source.id, preset: 'ig-post' }))).rejects.toMatchObject({
      status: 403,
    })
    expect(store.getCanvas('c')).toEqual(before)
  })

  it('guards restore before touching drafts, dimensions or history and keeps the current preset', async () => {
    const frame = await as('creator', () => create({ preset: 'ig-post' }))
    vi.mocked(persist.getFrameVersion).mockResolvedValue({
      id: 'v',
      frameId: frame.id,
      canvasId: 'c',
      html: '<p>Earlier</p>',
      width: 300,
      height: 400,
      savedAt: 1,
      savedBy: 'Creator',
      htmlBytes: 14,
    })
    await as('mate', () => actions.appendFrameHtml(frame.id, '<p>Draft', { ...actor }, { start: true }))
    const before = structuredClone(frame)
    vi.clearAllMocks()
    await expect(as('mate', () => actions.restoreFrameVersion(frame.id, 'v', { ...actor }))).rejects.toMatchObject({
      status: 403,
    })
    expect(frame).toEqual(before)
    expect(actions.hasAppendDraft(frame.id)).toBe(true)
    expect(persist.saveFrameVersion).not.toHaveBeenCalled()
    expect(broadcast).not.toHaveBeenCalled()
    const restored = await as('creator', () => actions.restoreFrameVersion(frame.id, 'v', { ...actor }))
    expect(restored?.frame).toMatchObject({ preset: 'ig-post', width: 300, height: 400 })
  })

  it('allows non-Creator restore when preset dimensions do not change', async () => {
    const frame = await as('creator', () => create({ preset: 'ig-post' }))
    vi.mocked(persist.getFrameVersion).mockResolvedValue({
      id: 'v',
      frameId: frame.id,
      canvasId: 'c',
      html: '<p>Earlier</p>',
      width: 1080,
      height: 1080,
      savedAt: 1,
      savedBy: 'Creator',
      htmlBytes: 14,
    })
    const restored = await as('mate', () => actions.restoreFrameVersion(frame.id, 'v', { ...actor }))
    expect(restored?.frame).toMatchObject({ preset: 'ig-post', width: 1080, height: 1080 })
    expect(restored?.frame.html).toContain('Earlier')
  })
})

describe('resident preset inputs and summaries', () => {
  async function run(input: Record<string, unknown>, sourceId?: string) {
    const canvas = store.createCanvas('Resident', 'creator')!
    canvas.memberIds = ['mate']
    const requests: unknown[] = []
    const html = '<!doctype html><html><head><title>Design</title></head><body><p>Design</p></body></html>'
    let source: Frame | undefined
    if (sourceId)
      source = store.createFrame(
        canvas.id,
        { name: 'Source', preset: 'ig-post', width: 1111, height: 777, html },
        'Creator',
      )!
    model.pickModel.mockResolvedValue({
      provider: 'test',
      label: 'scripted',
      userId: 'mate',
      vision: false,
      run: async (req: unknown) => {
        requests.push(JSON.parse(JSON.stringify(req)))
        return requests.length === 1
          ? {
              content: [
                {
                  type: 'tool_use',
                  id: 'create',
                  name: 'create_frame',
                  input: { name: 'Created', html, ...input, ...(source ? { source_frame_id: source.id } : {}) },
                },
              ],
              stop_reason: 'tool_use',
            }
          : { content: [{ type: 'text', text: 'Done' }], stop_reason: 'end_turn' }
      },
    })
    const card = actions.addQueuedCard(canvas.id, 'Create a frame', 'Mate', undefined, undefined, 'mate')!
    await vi.waitFor(() => expect(card.endedAt ?? card.failedAt).toBeDefined(), { timeout: 20_000 })
    return { canvas, requests }
  }
  it('passes preset input through the real resident loop and includes it in tool results', async () => {
    const { canvas, requests } = await run({ preset: 'a4', width: 10, height: 20 })
    expect(canvas.frames[0]).toMatchObject({ preset: 'a4', width: 794, height: 1123 })
    expect(JSON.stringify(requests)).toContain('preset=a4')
  }, 30_000)
  it('inherits customized source sizes when the resident omits dimensions', async () => {
    const { canvas, requests } = await run({}, 'source')
    expect(canvas.frames[1]).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
    expect(JSON.stringify(requests[0])).toContain('preset=ig-post')
    const tools = (requests[0] as { tools: { name: string; input_schema: { required: string[] } }[] }).tools
    const required = tools.find((tool) => tool.name === 'create_frame')!.input_schema.required
    expect(required).not.toContain('width')
    expect(required).not.toContain('height')
    const messages = (requests[1] as { messages: { content: unknown }[] }).messages
    expect(JSON.stringify(messages.at(-1))).toContain('preset=ig-post')
  }, 30_000)
  it('rejects invalid resident preset IDs instead of silently dropping them', async () => {
    const { canvas, requests } = await run({ preset: '__proto__' })
    expect(canvas.frames).toHaveLength(0)
    expect(JSON.stringify(requests)).toContain('"is_error":true')
  }, 30_000)
})
