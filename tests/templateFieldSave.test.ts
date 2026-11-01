// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

const updateFrame = vi.fn((_id: string, _patch: Partial<Frame>) => Promise.resolve({} as Frame))
vi.mock('../src/lib/api', () => ({
  api: { updateFrame: (id: string, patch: Partial<Frame>) => updateFrame(id, patch) },
  errorMessage: (_err: unknown, fallback: string) => fallback,
}))
const requestFrame = vi.fn(() => Promise.resolve(null))
vi.mock('../src/lib/frameBridge', () => ({
  requestFrame: (...args: unknown[]) => requestFrame(...(args as [])),
}))

const { useStore } = await import('../src/lib/store')
const { applyTemplateField, duplicateLayer, markTemplateField, saveFrameHtml } = await import('../src/lib/layerEdits')
const { rollbackTarget } = await import('../src/lib/layerEdits')

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const SECTION = 'body:nth-of-type(1) > section:nth-of-type(1)'
const field = {
  id: 'hero-title',
  role: 'headline' as const,
  label: 'Titel',
  locked: false,
  maxLength: null,
  allowedColors: [] as string[],
}

const frame = (html: string): Frame => ({
  id: 'f1',
  canvasId: 'c1',
  name: 'Frame',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  html,
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'me',
})

function liveHtml(): string {
  return useStore.getState().canvas?.frames[0]?.html ?? ''
}

beforeEach(() => {
  updateFrame.mockClear()
  requestFrame.mockClear()
  updateFrame.mockImplementation((_id: string, _patch: Partial<Frame>) => Promise.resolve({} as Frame))
  const canvas: Canvas = { id: 'c1', name: 'Canvas', frames: [frame(page('<section><p>A</p></section>'))] } as Canvas
  useStore.setState({ canvas, selectedId: 'f1', selectedIds: ['f1'], selectedElement: null, notice: null })
})

describe('applyTemplateField', () => {
  it('saves the field and mirrors it to the live document', () => {
    expect(applyTemplateField(frame(liveHtml()), SECTION, field)).toBe(true)
    expect(requestFrame).toHaveBeenCalledWith('f1', 'doop:template', { selector: SECTION, field })
    expect(updateFrame).toHaveBeenCalledWith('f1', { html: liveHtml() })
  })

  it('unmarks with null and mirrors null', () => {
    applyTemplateField(frame(liveHtml()), SECTION, field)
    requestFrame.mockClear()
    expect(applyTemplateField(frame(liveHtml()), SECTION, null)).toBe(true)
    expect(requestFrame).toHaveBeenCalledWith('f1', 'doop:template', { selector: SECTION, field: null })
    expect(liveHtml()).not.toContain('data-od-id')
  })

  it('rolls back local html and pushes a notice when the save is rejected', async () => {
    const before = liveHtml()
    updateFrame.mockRejectedValueOnce(new Error('Offline'))
    expect(applyTemplateField(frame(before), SECTION, field)).toBe(true)
    expect(liveHtml()).not.toBe(before)
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    expect(liveHtml()).toBe(before)
    expect(useStore.getState().notice?.text).toBe('Template-Feld konnte nicht gespeichert werden')
  })

  it('re-mirrors the previous field to the live document when the save is rejected', async () => {
    applyTemplateField(frame(liveHtml()), SECTION, field)
    requestFrame.mockClear()
    const before = liveHtml()
    updateFrame.mockRejectedValueOnce(new Error('Offline'))
    expect(applyTemplateField(frame(before), SECTION, null)).toBe(true)
    expect(liveHtml()).not.toContain('data-od-id')
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
    expect(liveHtml()).toBe(before)
    expect(requestFrame).toHaveBeenLastCalledWith('f1', 'doop:template', { selector: SECTION, field })
  })

  it('marks with a fresh id', () => {
    expect(markTemplateField(frame(liveHtml()), SECTION)).toBe(true)
    expect(requestFrame).toHaveBeenCalledWith('f1', 'doop:template', {
      selector: SECTION,
      field: expect.objectContaining({ id: expect.any(String) }),
    })
  })

  it('ignores a stale field rejection when a newer field save is stored', async () => {
    let rejectFirst!: (err: unknown) => void
    updateFrame.mockImplementationOnce(() => new Promise<Frame>((_, reject) => (rejectFirst = reject)))
    expect(applyTemplateField(frame(liveHtml()), SECTION, field)).toBe(true)
    const marked = liveHtml()
    expect(marked).toContain('data-od-id')
    requestFrame.mockClear()
    expect(applyTemplateField(frame(marked), SECTION, null)).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(liveHtml()).not.toContain('data-od-id')
    requestFrame.mockClear()
    useStore.setState({ notice: null })
    rejectFirst(new Error('Offline'))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(liveHtml()).not.toContain('data-od-id')
    expect(requestFrame).not.toHaveBeenCalled()
    expect(useStore.getState().notice).toBeNull()
  })
})

describe('rollbackTarget', () => {
  it('returns before with no refused predecessors', () => {
    expect(rollbackTarget([], 'X')).toBe('X')
    expect(rollbackTarget([{ html: 'A', before: 'X', rejected: false }], 'X')).toBe('X')
  })

  it('walks past refused predecessors to the newest confirmed state', () => {
    const attempts = [
      { html: 'A', before: 'X', rejected: true },
      { html: 'B', before: 'A', rejected: true },
    ]
    expect(rollbackTarget(attempts, 'B')).toBe('X')
    expect(rollbackTarget(attempts, 'A')).toBe('X')
  })

  it('stops at pending or confirmed predecessors', () => {
    expect(rollbackTarget([{ html: 'A', before: 'X', rejected: false }], 'A')).toBe('A')
    expect(rollbackTarget([], 'A')).toBe('A')
  })
})

describe('saveFrameHtml', () => {
  async function flush() {
    await Promise.resolve()
    await new Promise((r) => setTimeout(r, 0))
  }

  it('rolls back local html and pushes a notice when a duplicate save is rejected', async () => {
    const before = liveHtml()
    updateFrame.mockRejectedValueOnce(new Error('Forbidden'))
    duplicateLayer(frame(before), SECTION)
    expect(liveHtml()).not.toBe(before)
    await flush()
    expect(liveHtml()).toBe(before)
    expect(useStore.getState().notice?.text).toBe('Die Ebene konnte nicht gespeichert werden')
  })

  it('reverts the live document when a save is rejected', async () => {
    const before = liveHtml()
    updateFrame.mockRejectedValueOnce(new Error('Forbidden'))
    saveFrameHtml(frame(before), before.replace('<p>A</p>', '<p>B</p>'))
    await flush()
    expect(liveHtml()).toBe(before)
    expect(requestFrame).toHaveBeenCalledWith('f1', 'doop:revert', { html: before })
  })

  it('leaves the live document alone when the server accepts the save', async () => {
    const before = liveHtml()
    saveFrameHtml(frame(before), before.replace('<p>A</p>', '<p>B</p>'))
    await flush()
    expect(liveHtml()).toContain('<p>B</p>')
    expect(requestFrame).not.toHaveBeenCalled()
  })

  it('ignores a stale rejection when a newer save is already stored', async () => {
    const before = liveHtml()
    let rejectFirst!: (err: unknown) => void
    updateFrame.mockImplementationOnce(() => new Promise<Frame>((_, reject) => (rejectFirst = reject)))
    const htmlA = before.replace('<p>A</p>', '<p>B</p>')
    saveFrameHtml(frame(before), htmlA)
    saveFrameHtml(frame(liveHtml()), htmlA.replace('<p>B</p>', '<p>C</p>'))
    await flush()
    expect(liveHtml()).toContain('<p>C</p>')
    requestFrame.mockClear()
    useStore.setState({ notice: null })
    rejectFirst(new Error('Forbidden'))
    await flush()
    /* the superseded rejection must not clobber the newer content,
       in the store or live, and stays silent: the newer save judges */
    expect(liveHtml()).toContain('<p>C</p>')
    expect(requestFrame).not.toHaveBeenCalled()
    expect(useStore.getState().notice).toBeNull()
  })

  it('rolls back past a refused predecessor on overlapping double rejection', async () => {
    const before = liveHtml()
    const gates: Array<{ resolve: (v: Frame) => void; reject: (e: unknown) => void }> = []
    updateFrame.mockImplementation(
      () =>
        new Promise<Frame>((resolve, reject) => {
          gates.push({ resolve, reject })
        }),
    )
    const htmlA = before.replace('<p>A</p>', '<p>B</p>')
    saveFrameHtml(frame(before), htmlA)
    const htmlB = htmlA.replace('<p>B</p>', '<p>C</p>')
    saveFrameHtml(frame(liveHtml()), htmlB)
    expect(gates.length).toBe(2)
    gates[0]!.reject(new Error('Forbidden'))
    await flush()
    /* superseded: the newer save still governs */
    expect(liveHtml()).toContain('<p>C</p>')
    gates[1]!.reject(new Error('Forbidden'))
    await flush()
    /* both refused: back to the newest confirmed state, not the
       refused intermediate — in the store and live */
    expect(liveHtml()).toBe(before)
    expect(requestFrame).toHaveBeenLastCalledWith('f1', 'doop:revert', { html: before })
    expect(useStore.getState().notice?.text).toBe('Die Ebene konnte nicht gespeichert werden')
  })

  it('keeps the saved html when the server accepts it', async () => {
    const before = liveHtml()
    saveFrameHtml(frame(before), before.replace('<p>A</p>', '<p>B</p>'))
    await flush()
    expect(liveHtml()).toContain('<p>B</p>')
    expect(useStore.getState().notice).toBeNull()
  })
})
