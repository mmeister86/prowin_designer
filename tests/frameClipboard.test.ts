import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

/* the clipboard module creates frames through the API and records them in
   history — stub the network and analytics so the copy/paste bookkeeping can
   be exercised on its own */
let nextId = 0
const api = {
  createFrame: vi.fn(async (canvasId: string, rest: Partial<Frame>) => ({
    ...frame('x'),
    ...rest,
    canvasId,
    id: `new${++nextId}`,
  })),
  updateFrame: vi.fn(async () => ({})),
  deleteFrame: vi.fn(async () => ({})),
}
vi.mock('../src/lib/api', async (original) => ({ ...(await original<typeof import('../src/lib/api')>()), api }))

/* the module keeps the clip in localStorage, which the node test runtime
   lacks; a tiny in-memory stand-in is all it needs */
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
const { ApiError } = await import('../src/lib/api')

function frame(id: string, x = 0, y = 0, width = 100, height = 100): Frame {
  return { id, canvasId: 'c1', name: id, html: `<p>${id}</p>`, x, y, width, height } as Frame
}

function seed(...frames: Frame[]) {
  useStore.getState().setCanvas({ id: 'c1', name: 'c', frames } as unknown as Canvas)
}

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  store.clear()
  nextId = 0
  seed(frame('a', 100, 100), frame('b', 300, 150, 50, 50))
  useStore.getState().setViewport({ x: 0, y: 0, zoom: 1 })
  useStore.getState().select(null)
  history.clearHistory()
  vi.clearAllMocks()
})

describe('multi-frame copy and paste', () => {
  it.each([1, 2])(
    'keeps %s denied preset restoration(s) visible and retryable instead of losing the snapshots',
    async (count) => {
      const sources = Array.from({ length: count }, (_, index) => ({
        ...frame(`source-${index}`, 0, 0, 900, 1700),
        preset: 'ig-story' as const,
      }))
      history.deleteFramesTracked(sources)
      seed()
      useStore.setState({ notice: null })
      for (const _source of sources)
        api.createFrame.mockRejectedValueOnce(
          new ApiError(403, JSON.stringify({ error: 'Du benötigst Creator-Rechte auf dieser Arbeitsfläche.' })),
        )
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
      try {
        await history.undo()
        expect(useStore.getState().canvas!.frames).toEqual([])
        expect(useStore.getState().notice?.text).toContain('Creator')
        await history.undo()
        expect(useStore.getState().canvas!.frames).toHaveLength(count)
        expect(api.createFrame).toHaveBeenLastCalledWith(
          'c1',
          expect.objectContaining({ preset: 'ig-story', width: 900, height: 1700, restoreDimensions: true }),
        )
      } finally {
        errors.mockRestore()
      }
    },
  )
  it('remaps preset copy provenance when its source is recreated by redo', async () => {
    const source = { ...frame('source', 0, 0, 1080, 1920), preset: 'ig-story' as const }
    history.recordCreate(source)
    clipboard.duplicateFrame(source)
    await flush()
    await history.undo()
    await history.undo()
    await history.redo()
    await history.redo()
    expect(api.createFrame).toHaveBeenLastCalledWith(
      'c1',
      expect.objectContaining({ preset: 'ig-story', sourceFrameId: 'new2' }),
    )
  })
  it.each(['ig-story', 'wa-status'] as const)(
    'preserves %s and customized source dimensions through paste and redo',
    async (preset) => {
      clipboard.copyFrame({ ...frame('source', 0, 0, 900, 1700), preset })
      clipboard.pasteFrameCentered('c1')
      await flush()
      expect(api.createFrame).toHaveBeenLastCalledWith(
        'c1',
        expect.objectContaining({ preset, width: 900, height: 1700, sourceFrameId: 'source' }),
      )
      await history.undo()
      await history.redo()
      expect(api.createFrame).toHaveBeenLastCalledWith(
        'c1',
        expect.objectContaining({ preset, width: 900, height: 1700, sourceFrameId: 'source' }),
      )
    },
  )

  it('preserves preset identity and dimensions for duplication and deleted-frame undo', async () => {
    const source = { ...frame('source', 0, 0, 900, 1700), preset: 'wa-status' as const }
    clipboard.duplicateFrame(source)
    await flush()
    expect(api.createFrame).toHaveBeenLastCalledWith(
      'c1',
      expect.objectContaining({ preset: 'wa-status', width: 900, height: 1700, sourceFrameId: 'source' }),
    )
    history.deleteFrameTracked(source)
    await history.undo()
    expect(api.createFrame).toHaveBeenLastCalledWith(
      'c1',
      expect.objectContaining({ preset: 'wa-status', width: 900, height: 1700 }),
    )
  })
  it('pastes every copied frame, keeping their layout, centred as a group', async () => {
    clipboard.copyFrames([frame('a', 100, 100), frame('b', 300, 150, 50, 50)])
    clipboard.pasteFrameCentered('c1')
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(2)
    const [, a] = api.createFrame.mock.calls[0]!
    const [, b] = api.createFrame.mock.calls[1]!
    /* the group spans 250×100 (a at 0,0 and b at 200,50 relative), so its
       top-left sits at the view centre minus half of that */
    expect(a).toMatchObject({ name: 'a', html: '<p>a</p>', x: 375, y: 350, width: 100, height: 100 })
    expect(b).toMatchObject({ name: 'b', html: '<p>b</p>', x: 575, y: 400, width: 50, height: 50 })
  })

  it('selects all pasted frames and undoes the paste as one step', async () => {
    clipboard.copyFrames([frame('a', 100, 100), frame('b', 300, 150)])
    clipboard.pasteFrameCentered('c1')
    await flush()

    expect(useStore.getState().selectedIds).toEqual(['new1', 'new2'])
    await history.undo()
    await flush()
    expect(api.deleteFrame).toHaveBeenCalledTimes(2)
  })

  it('pastes at a screen point with the group top-left there', async () => {
    clipboard.copyFrames([frame('a', 100, 100), frame('b', 300, 150)])
    clipboard.pasteFrameAtScreen('c1', 10, 20)
    await flush()

    expect(api.createFrame.mock.calls[0]![1]).toMatchObject({ x: 10, y: 20 })
    expect(api.createFrame.mock.calls[1]![1]).toMatchObject({ x: 210, y: 70 })
  })

  it('still reads a single-frame clip written before multi-frame copy', async () => {
    store.set('doop:frame-clipboard', JSON.stringify({ name: 'old', html: '<p>old</p>', width: 200, height: 100 }))
    expect(clipboard.hasFrameClip()).toBe(true)
    clipboard.pasteFrameCentered('c1')
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(1)
    expect(api.createFrame.mock.calls[0]![1]).toMatchObject({ name: 'old', x: 400, y: 350 })
  })

  it('keeps the frames that landed when one create fails', async () => {
    api.createFrame.mockImplementationOnce(async () => {
      throw new Error('boom')
    })
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    clipboard.copyFrames([frame('a', 100, 100), frame('b', 300, 150)])
    clipboard.pasteFrameCentered('c1')
    await flush()

    /* the first request failed, the second landed as new1 */
    expect(useStore.getState().selectedIds).toEqual(['new1'])
    await history.undo()
    await flush()
    expect(api.deleteFrame).toHaveBeenCalledTimes(1)
    expect(api.deleteFrame).toHaveBeenCalledWith('new1')
    error.mockRestore()
  })

  it('reselects the whole group after undo and redo', async () => {
    clipboard.copyFrames([frame('a', 100, 100), frame('b', 300, 150)])
    clipboard.pasteFrameCentered('c1')
    await flush()
    await history.undo()
    await flush()
    await history.redo()
    await flush()

    expect(useStore.getState().selectedIds).toEqual(['new3', 'new4'])
  })

  it('duplicates a selection as a group offset by 40px', async () => {
    clipboard.duplicateFrames([frame('a', 100, 100), frame('b', 300, 150)])
    await flush()

    expect(api.createFrame.mock.calls[0]![1]).toMatchObject({ name: 'a Kopie', x: 140, y: 140 })
    expect(api.createFrame.mock.calls[1]![1]).toMatchObject({ name: 'b Kopie', x: 340, y: 190 })
    expect(useStore.getState().selectedIds).toEqual(['new1', 'new2'])
  })
})
