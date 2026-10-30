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
const { applyTemplateField, markTemplateField } = await import('../src/lib/layerEdits')

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

  it('marks with a fresh id', () => {
    expect(markTemplateField(frame(liveHtml()), SECTION)).toBe(true)
    expect(requestFrame).toHaveBeenCalledWith('f1', 'doop:template', {
      selector: SECTION,
      field: expect.objectContaining({ id: expect.any(String) }),
    })
  })
})
