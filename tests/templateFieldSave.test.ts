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
const { enqueueHtmlSave, rollbackTarget } = await import('../src/lib/frameHtmlSaves')
const { safeZoneDocumentToken } = await import('../src/lib/safeZoneDocument')

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

  it('serializes overlapping field saves and ignores the superseded rejection', async () => {
    const gates: Array<{ resolve: (v: Frame) => void; reject: (e: unknown) => void }> = []
    updateFrame.mockImplementation(
      () =>
        new Promise<Frame>((resolve, reject) => {
          gates.push({ resolve, reject })
        }),
    )
    expect(applyTemplateField(frame(liveHtml()), SECTION, field)).toBe(true)
    const marked = liveHtml()
    expect(marked).toContain('data-od-id')
    requestFrame.mockClear()
    /* the second commit coalesces behind the running first save */
    expect(applyTemplateField(frame(marked), SECTION, null)).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(updateFrame).toHaveBeenCalledTimes(1)
    expect(liveHtml()).not.toContain('data-od-id')
    /* refusing the superseded first save flushes the second and stays
       silent: the newer commit governs */
    gates[0]!.reject(new Error('Offline'))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(updateFrame).toHaveBeenCalledTimes(2)
    expect(liveHtml()).not.toContain('data-od-id')
    expect(useStore.getState().notice).toBeNull()
    gates[1]!.resolve({} as Frame)
    await new Promise((r) => setTimeout(r, 0))
    expect(liveHtml()).not.toContain('data-od-id')
    expect(useStore.getState().notice).toBeNull()
    expect(requestFrame).not.toHaveBeenCalledWith('f1', 'doop:revert', expect.anything())
  })

  it('walks back to the original field on overlapping double rejection', async () => {
    const original = liveHtml()
    const gates: Array<{ resolve: (v: Frame) => void; reject: (e: unknown) => void }> = []
    updateFrame.mockImplementation(
      () =>
        new Promise<Frame>((resolve, reject) => {
          gates.push({ resolve, reject })
        }),
    )
    expect(applyTemplateField(frame(original), SECTION, field)).toBe(true)
    expect(applyTemplateField(frame(liveHtml()), SECTION, null)).toBe(true)
    await new Promise((r) => setTimeout(r, 0))
    expect(updateFrame).toHaveBeenCalledTimes(1)
    /* oldest refusal first: silent, the newer commit is flushed */
    gates[0]!.reject(new Error('Offline'))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(updateFrame).toHaveBeenCalledTimes(2)
    expect(useStore.getState().notice).toBeNull()
    /* newest refusal next: back to the original unmarked field — never
       the already-refused intermediate — in the store and live */
    gates[1]!.reject(new Error('Offline'))
    await new Promise((r) => setTimeout(r, 0))
    await new Promise((r) => setTimeout(r, 0))
    expect(liveHtml()).toBe(original)
    expect(requestFrame).toHaveBeenLastCalledWith('f1', 'doop:template', { selector: SECTION, field: null })
    expect(useStore.getState().notice?.text).toBe('Template-Feld konnte nicht gespeichert werden')
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

  it.each([false, true])('never restores coalesced unsent HTML (first accepted: %s)', async (accepted) => {
    const before = liveHtml()
    const gates: Array<{ resolve: (v: Frame) => void; reject: (e: unknown) => void }> = []
    updateFrame.mockImplementation(() => new Promise<Frame>((resolve, reject) => gates.push({ resolve, reject })))
    const first = before.replace('<p>A</p>', '<p>sent</p>')
    saveFrameHtml(frame(before), first)
    saveFrameHtml(frame(liveHtml()), before.replace('<p>A</p>', '<p>unsent</p>'))
    const last = before.replace('<p>A</p>', '<p>latest</p>')
    saveFrameHtml(frame(liveHtml()), last)
    expect(updateFrame).toHaveBeenCalledTimes(1)
    if (accepted) gates[0]!.resolve({} as Frame)
    else gates[0]!.reject(new Error('Forbidden'))
    await flush()
    expect(updateFrame.mock.calls.map(([, patch]) => patch.html)).toEqual([first, last])
    gates[1]!.reject(new Error('Forbidden'))
    await flush()
    expect(liveHtml()).toBe(accepted ? first : before)
    expect(requestFrame).toHaveBeenLastCalledWith('f1', 'doop:revert', {
      html: accepted ? first : before,
      docToken: safeZoneDocumentToken('f1', accepted ? first : before),
    })
  })

  it('waits for the replacing send before resolving coalesced saves', async () => {
    const before = liveHtml()
    const gates: Array<{ resolve: (v: Frame) => void; reject: (e: unknown) => void }> = []
    updateFrame.mockImplementation(() => new Promise<Frame>((resolve, reject) => gates.push({ resolve, reject })))
    const save = (html: string, previous: string) =>
      enqueueHtmlSave({
        frameId: 'f1',
        html,
        before: previous,
        refusedNotice: 'Nicht gespeichert',
      })
    const first = save('first', before)
    let coalescedSettled = false
    const coalesced = save('middle', 'first').then(() => {
      coalescedSettled = true
    })
    const latest = save('last', 'middle')
    await flush()
    const settledBeforeSend = coalescedSettled
    gates[0]!.resolve({} as Frame)
    await flush()
    const settledWhilePending = coalescedSettled
    gates[1]!.resolve({} as Frame)
    await Promise.all([first, coalesced, latest])
    expect(settledBeforeSend).toBe(false)
    expect(settledWhilePending).toBe(false)
    expect(coalescedSettled).toBe(true)
  })

  it('recovers confirmed content after more than fifty coalesced edits', async () => {
    const before = liveHtml()
    const gates: Array<{ resolve: (v: Frame) => void; reject: (e: unknown) => void }> = []
    updateFrame.mockImplementation(() => new Promise<Frame>((resolve, reject) => gates.push({ resolve, reject })))
    for (let i = 0; i < 61; i++) {
      saveFrameHtml(frame(liveHtml()), before.replace('<p>A</p>', `<p>edit-${i}</p>`))
    }
    gates[0]!.reject(new Error('Forbidden'))
    await flush()
    gates[1]!.reject(new Error('Forbidden'))
    await flush()
    expect(liveHtml()).toBe(before)
  })

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
    expect(requestFrame).toHaveBeenCalledWith('f1', 'doop:revert', {
      html: before,
      docToken: safeZoneDocumentToken('f1', before),
    })
  })

  it('stamps the rollback revert so measurement recovers after a denied save', async () => {
    const before = liveHtml()
    updateFrame.mockRejectedValueOnce(new Error('Forbidden'))
    saveFrameHtml(frame(before), before.replace('<p>A</p>', '<p>B</p>'))
    await flush()
    expect(liveHtml()).toBe(before)
    // The runtime adopts the token only for the exact rendered document:
    // a numeric stamp for the rollback target lets the next render
    // notification confirm the desired HTML instead of stranding it.
    const calls = requestFrame.mock.calls as unknown as Array<[string, string, { html: string; docToken: unknown }]>
    const revert = calls.find(([, type]) => type === 'doop:revert')?.[2]
    expect(revert?.html).toBe(before)
    expect(revert?.docToken).toBe(safeZoneDocumentToken('f1', before))
  })

  it('leaves the live document alone when the server accepts the save', async () => {
    const before = liveHtml()
    saveFrameHtml(frame(before), before.replace('<p>A</p>', '<p>B</p>'))
    await flush()
    expect(liveHtml()).toContain('<p>B</p>')
    expect(requestFrame).not.toHaveBeenCalled()
  })

  it('serializes overlapping saves and ignores the superseded rejection', async () => {
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
    saveFrameHtml(frame(liveHtml()), htmlA.replace('<p>B</p>', '<p>C</p>'))
    await flush()
    /* the second save coalesces behind the running first one */
    expect(updateFrame).toHaveBeenCalledTimes(1)
    expect(liveHtml()).toContain('<p>C</p>')
    requestFrame.mockClear()
    useStore.setState({ notice: null })
    /* refusing the superseded first save flushes the second and stays
       silent: the newer save judges */
    gates[0]!.reject(new Error('Forbidden'))
    await flush()
    await flush()
    expect(updateFrame).toHaveBeenCalledTimes(2)
    expect(liveHtml()).toContain('<p>C</p>')
    expect(requestFrame).not.toHaveBeenCalled()
    expect(useStore.getState().notice).toBeNull()
    gates[1]!.resolve({} as Frame)
    await flush()
    expect(liveHtml()).toContain('<p>C</p>')
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
    await flush()
    expect(updateFrame).toHaveBeenCalledTimes(1)
    gates[0]!.reject(new Error('Forbidden'))
    await flush()
    await flush()
    /* superseded: the newer save is flushed and still governs */
    expect(updateFrame).toHaveBeenCalledTimes(2)
    expect(liveHtml()).toContain('<p>C</p>')
    gates[1]!.reject(new Error('Forbidden'))
    await flush()
    await flush()
    /* both refused: back to the newest confirmed state, not the
       refused intermediate — in the store and live */
    expect(liveHtml()).toBe(before)
    expect(requestFrame).toHaveBeenLastCalledWith('f1', 'doop:revert', {
      html: before,
      docToken: safeZoneDocumentToken('f1', before),
    })
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
