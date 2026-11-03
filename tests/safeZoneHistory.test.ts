import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

/* history replays through the API: stub the network so set/reset undo/redo,
   recreation and clipboard round trips can be exercised on their own */
let nextId = 0
const frames = new Map<string, Frame>()
const api = {
  createFrame: vi.fn(async (canvasId: string, rest: Partial<Frame>) => {
    const f: Frame = { ...frame('x'), ...rest, canvasId, id: `new${++nextId}` } as Frame
    frames.set(f.id, { ...f })
    return f
  }),
  updateFrame: vi.fn(async (id: string, patch: Partial<Frame>) => {
    const current = frames.get(id)!
    /* JSON round trip: undefined keys vanish, null resets survive */
    const sent = JSON.parse(JSON.stringify(patch))
    const next = { ...current }
    for (const [k, v] of Object.entries(sent)) (next as Record<string, unknown>)[k] = v
    if ('safeZoneOverride' in sent && sent.safeZoneOverride === null) delete next.safeZoneOverride
    frames.set(id, next)
    return next
  }),
  deleteFrame: vi.fn(async (id: string) => {
    frames.delete(id)
    return {}
  }),
}
vi.mock('../src/lib/api', async (original) => ({ ...(await original<typeof import('../src/lib/api')>()), api }))

const store = new Map<string, string>()
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
})
vi.stubGlobal('window', { innerWidth: 1000, innerHeight: 800 })
vi.stubGlobal('document', { querySelector: () => null })

const { useStore } = await import('../src/lib/store')
const history = await import('../src/lib/history')
const clipboard = await import('../src/lib/frameClipboard')

const ZONE = { top: 10, right: 20, bottom: 30, left: 40 }

function frame(id: string, extra: Partial<Frame> = {}): Frame {
  return {
    id,
    canvasId: 'c1',
    name: id,
    html: `<p>${id}</p>`,
    x: 0,
    y: 0,
    width: 1080,
    height: 1080,
    preset: 'ig-post',
    updatedAt: 1,
    ...extra,
  } as Frame
}

function seed(...fs: Frame[]) {
  frames.clear()
  for (const f of fs) frames.set(f.id, { ...f })
  useStore.getState().setCanvas({ id: 'c1', name: 'c', frames: fs.map((f) => ({ ...f })) } as unknown as Canvas)
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  store.clear()
  nextId = 0
  seed(frame('a'))
  useStore.getState().setViewport({ x: 0, y: 0, zoom: 1 })
  useStore.getState().select(null)
  history.clearHistory()
  vi.clearAllMocks()
})

describe('safe-zone undo/redo', () => {
  it('undoes a newly set override with an explicit null reset through JSON', async () => {
    history.recordUpdate('a', {}, { safeZoneOverride: { ...ZONE } })
    await history.undo()
    expect(api.updateFrame).toHaveBeenLastCalledWith('a', { safeZoneOverride: null })
    expect(frames.get('a')).not.toHaveProperty('safeZoneOverride')
    await history.redo()
    expect(api.updateFrame).toHaveBeenLastCalledWith('a', { safeZoneOverride: ZONE })
    expect(frames.get('a')).toMatchObject({ safeZoneOverride: ZONE })
  })

  it('redoes a reset and undoes it back through JSON', async () => {
    seed(frame('a', { safeZoneOverride: { ...ZONE } }))
    history.recordUpdate('a', { safeZoneOverride: { ...ZONE } }, { safeZoneOverride: null })
    await history.undo()
    expect(frames.get('a')).toMatchObject({ safeZoneOverride: ZONE })
    await history.redo()
    expect(api.updateFrame).toHaveBeenLastCalledWith('a', { safeZoneOverride: null })
    expect(frames.get('a')).not.toHaveProperty('safeZoneOverride')
  })

  it('treats reordered keys as equal (no entry, no request)', () => {
    history.recordUpdate(
      'a',
      { safeZoneOverride: { top: 1, right: 2, bottom: 3, left: 4 } },
      { safeZoneOverride: { left: 4, bottom: 3, right: 2, top: 1 } },
    )
    expect(api.updateFrame).not.toHaveBeenCalled()
  })
})

describe('safe-zone clipboard and recreation', () => {
  it('carries the override and source id through copy/paste and redo', async () => {
    clipboard.copyFrame({ ...frame('source', { safeZoneOverride: { ...ZONE } }) })
    clipboard.pasteFrameCentered('c1')
    await flush()
    expect(api.createFrame).toHaveBeenLastCalledWith(
      'c1',
      expect.objectContaining({ safeZoneOverride: ZONE, sourceFrameId: 'source' }),
    )
    await history.undo()
    await history.redo()
    await flush()
    expect(api.createFrame).toHaveBeenLastCalledWith(
      'c1',
      expect.objectContaining({ safeZoneOverride: ZONE, sourceFrameId: 'source' }),
    )
  })

  it('recreates deleted and undone-created frames with their override', async () => {
    const source = frame('source', { safeZoneOverride: { ...ZONE } })
    history.deleteFrameTracked(source)
    await history.undo()
    expect(api.createFrame).toHaveBeenLastCalledWith('c1', expect.objectContaining({ safeZoneOverride: ZONE }))
    const created = frame('fresh', { safeZoneOverride: { ...ZONE } })
    history.recordCreate(created)
    await history.undo()
    await history.redo()
    await flush()
    expect(api.createFrame).toHaveBeenLastCalledWith('c1', expect.objectContaining({ safeZoneOverride: ZONE }))
  })
})
