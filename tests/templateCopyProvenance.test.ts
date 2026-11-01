import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

/**
 * TASK-30 Task 3 RED: clipboard and duplicate payloads carry the trusted
 * source frame id so member pastes of template frames validate against the
 * stored source instead of failing closed; metadata-free legacy clips keep
 * working without provenance; history redo replays the same provenance.
 */

let nextId = 0
const api = {
  createFrame: vi.fn(async (canvasId: string, rest: Partial<Frame> & { sourceFrameId?: string }) => ({
    ...frame('x'),
    ...rest,
    canvasId,
    id: `new${++nextId}`,
  })),
  updateFrame: vi.fn(async () => ({})),
  deleteFrame: vi.fn(async () => ({})),
}
vi.mock('../src/lib/api', () => ({ api }))

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

const TEMPLATE =
  '<div><h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel">Hallo</h1>' +
  '<p data-od-id="intro" data-od-role="body" data-od-locked="true">Text</p></div>'

function frame(id: string, x = 0, y = 0, width = 100, height = 100, html = `<p>${id}</p>`): Frame {
  return { id, canvasId: 'c1', name: id, html, x, y, width, height } as Frame
}

function seed(...frames: Frame[]) {
  useStore.getState().setCanvas({ id: 'c1', name: 'c', frames } as unknown as Canvas)
}

const flush = () => new Promise((r) => setTimeout(r, 0))

function payloads(): (Partial<Frame> & { sourceFrameId?: string })[] {
  return api.createFrame.mock.calls.map(([, rest]) => rest)
}

beforeEach(() => {
  store.clear()
  nextId = 0
  seed(frame('a', 100, 100), frame('b', 300, 150, 50, 50))
  useStore.getState().setViewport({ x: 0, y: 0, zoom: 1 })
  useStore.getState().select(null)
  history.clearHistory()
  vi.clearAllMocks()
})

describe('clipboard source provenance', () => {
  it('pastes every copied template frame with its own source id', async () => {
    clipboard.copyFrames([frame('a', 100, 100, 100, 100, TEMPLATE), frame('b', 300, 150, 100, 100, TEMPLATE)])
    clipboard.pasteFrameCentered('c1')
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(2)
    expect(payloads()).toMatchObject([{ sourceFrameId: 'a' }, { sourceFrameId: 'b' }])
  })

  it('keeps plain clipboard entries independent of the original frame', async () => {
    clipboard.copyFrames([frame('a')])
    const clip = JSON.parse(store.get('doop:frame-clipboard')!) as { frames: Record<string, unknown>[] }
    expect(clip.frames[0]).not.toHaveProperty('sourceId')
    seed()
    clipboard.pasteFrameCentered('c1')
    await flush()
    expect(payloads()[0]).toMatchObject({ html: '<p>a</p>' })
    expect(payloads()[0]).not.toHaveProperty('sourceFrameId')
  })

  it('keeps template metadata on a source-backed paste', async () => {
    seed(frame('t', 0, 0, 200, 100, TEMPLATE))
    clipboard.copyFrames([frame('t', 0, 0, 200, 100, TEMPLATE)])
    clipboard.pasteFrameCentered('c1')
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(1)
    expect(payloads()[0]).toMatchObject({ html: TEMPLATE, sourceFrameId: 't' })
  })

  it('still pastes a metadata-free legacy clip without provenance', async () => {
    store.set('doop:frame-clipboard', JSON.stringify({ name: 'old', html: '<p>old</p>', width: 200, height: 100 }))
    clipboard.pasteFrameCentered('c1')
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(1)
    expect(payloads()[0]).toMatchObject({ name: 'old', html: '<p>old</p>' })
    expect(payloads()[0]).not.toHaveProperty('sourceFrameId')
  })

  it('duplicates frames with their source ids', async () => {
    clipboard.duplicateFrames([frame('a', 100, 100), frame('b', 300, 150)])
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(2)
    expect(payloads()).toMatchObject([
      { name: 'a Kopie', sourceFrameId: 'a' },
      { name: 'b Kopie', sourceFrameId: 'b' },
    ])
  })
})

describe('history redo provenance', () => {
  it('replays the source id when redoing a provenance paste', async () => {
    clipboard.copyFrames([frame('t', 0, 0, 200, 100, TEMPLATE)])
    clipboard.pasteFrameCentered('c1')
    await flush()
    expect(payloads()[0]).toMatchObject({ sourceFrameId: 't' })

    await history.undo()
    await flush()
    expect(api.deleteFrame).toHaveBeenCalledTimes(1)
    await history.redo()
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(2)
    expect(payloads()[1]).toMatchObject({ html: TEMPLATE, sourceFrameId: 't' })
  })

  it('redoes provenance-free entries without inventing a source', async () => {
    store.set('doop:frame-clipboard', JSON.stringify({ name: 'old', html: '<p>old</p>', width: 200, height: 100 }))
    clipboard.pasteFrameCentered('c1')
    await flush()
    await history.undo()
    await flush()
    await history.redo()
    await flush()

    expect(api.createFrame).toHaveBeenCalledTimes(2)
    expect(payloads()[1]).not.toHaveProperty('sourceFrameId')
  })
})
