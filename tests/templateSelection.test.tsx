// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Canvas, Frame } from '../shared/types'

/* Breaks caught here: template-locked elements editable/deletable/
   movable/duplicable by non-creators; creators locked out of template
   locks; legacy locks losing their refusal once template marks appear;
   frozen frame areas edited by non-creators; Layers rows selecting locked
   content by mouse or keyboard; stale picks surviving as live selections. */
const mocks = vi.hoisted(() => ({ manageLocks: false }))
vi.mock('../src/prowin/canvasPermissions', () => ({
  canManageFrameLocks: () => mocks.manageLocks,
  useCanvasCapabilities: () => ({ manageLocks: mocks.manageLocks, localAgent: false, publish: false }),
}))
const updateFrame = vi.fn((_id: string, _patch: Partial<Frame>) => Promise.resolve())
vi.mock('../src/lib/api', () => ({
  api: { updateFrame: (id: string, patch: Partial<Frame>) => updateFrame(id, patch) },
  errorMessage: (_err: unknown, fallback: string) => fallback,
}))
const requestFrame = vi.fn(() => Promise.resolve(null))
vi.mock('../src/lib/frameBridge', () => ({
  requestFrame: (...args: unknown[]) => requestFrame(...(args as [])),
}))

const { useStore } = await import('../src/lib/store')
const { selectionBlockReason, canSelectTemplateElement } = await import('../src/prowin/templatePolicy')
const {
  deleteLayer,
  replaceLayerHtml,
  moveLayer,
  shiftLayer,
  duplicateLayer,
  dropTemplateBlockedSelection,
  setLayerHidden,
  toggleSelectionHidden,
} = await import('../src/lib/layerEdits')
const { LayersPanel } = await import('../src/components/LayersPanel')
const { TooltipProvider } = await import('../src/components/ui/tooltip')

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const SECTION = 'body:nth-of-type(1) > section:nth-of-type(1)'
const SPAN = 'body:nth-of-type(1) > section:nth-of-type(1) > h1:nth-of-type(1) > span:nth-of-type(1)'
const DIV = 'body:nth-of-type(1) > div:nth-of-type(1)'

const LOCKED_BODY =
  '<section data-od-id="hero" data-od-role="headline" data-od-locked="true"><h1><span>Hi</span></h1></section><div><p>A</p></div>'
const EMPTY_LOCK_BODY = '<section data-od-id="hero" data-od-locked><h1><span>Hi</span></h1></section>'

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

function seed(html: string) {
  updateFrame.mockClear()
  requestFrame.mockClear()
  const canvas: Canvas = { id: 'c1', name: 'Canvas', frames: [frame(html)] } as Canvas
  useStore.getState().setCanvas(canvas)
  useStore.setState({
    selectedId: 'f1',
    selectedIds: ['f1'],
    selectedElement: null,
    elementPanelOpen: false,
    notice: null,
  })
}

function notice(): string | null {
  return useStore.getState().notice?.text ?? null
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('template selection policy', () => {
  beforeEach(() => {
    mocks.manageLocks = false
  })

  it('reports locked and stale picks as unselectable', () => {
    const html = page(LOCKED_BODY)
    expect(selectionBlockReason(html, SECTION, false)).toBe('locked')
    expect(selectionBlockReason(html, SPAN, false)).toBe('locked')
    expect(selectionBlockReason(html, 'body > nav:nth-of-type(9)', false)).toBe('stale')
    expect(selectionBlockReason(html, DIV, false)).toBeNull()
    expect(canSelectTemplateElement(html, DIV, false)).toBe(true)
    expect(canSelectTemplateElement(html, SECTION, true)).toBe(true)
  })

  it('refuses content edits on locked fields and their nested spans, pick staying put', () => {
    seed(page(LOCKED_BODY))
    const f = frame(page(LOCKED_BODY))
    useStore.getState().pickElement({ frameId: 'f1', selector: SECTION })
    expect(deleteLayer(f, SECTION)).toBe(false)
    expect(deleteLayer(f, SPAN)).toBe(false)
    expect(replaceLayerHtml(f, SPAN, '<span>changed</span>')).toBe(false)
    expect(moveLayer(f, SECTION, { selector: DIV, place: 'before' })).toBe(false)
    expect(shiftLayer(f, SECTION, 1)).toBe(false)
    duplicateLayer(f, SPAN)
    expect(updateFrame).not.toHaveBeenCalled()
    expect(useStore.getState().selectedElement).toEqual({ frameId: 'f1', selector: SECTION })
    expect(notice()).toContain('gesperrt')
  })

  it('refuses edits under an empty lock value too', () => {
    seed(page(EMPTY_LOCK_BODY))
    expect(deleteLayer(frame(page(EMPTY_LOCK_BODY)), SPAN)).toBe(false)
    expect(updateFrame).not.toHaveBeenCalled()
    expect(notice()).toContain('gesperrt')
  })

  it('lets creators edit template locks', () => {
    mocks.manageLocks = true
    seed(page(LOCKED_BODY))
    expect(deleteLayer(frame(page(LOCKED_BODY)), SECTION)).toBe(true)
    expect(updateFrame).toHaveBeenCalledTimes(1)
  })

  it.each([SECTION, SPAN, DIV])('refuses hiding protected template content: %s', (selector) => {
    const html = page(LOCKED_BODY)
    seed(html)
    expect(setLayerHidden(frame(html), selector, true)).toBe(false)
    expect(updateFrame).not.toHaveBeenCalled()
    expect(requestFrame).not.toHaveBeenCalled()
    expect(useStore.getState().canvas?.frames[0]?.html).toBe(html)
    expect(notice()).toContain(selector === DIV ? 'schreibgeschützt' : 'gesperrt')
  })

  it('refuses the hide shortcut on a frozen picked element', () => {
    seed(page(LOCKED_BODY))
    useStore.getState().pickElement({ frameId: 'f1', selector: DIV })
    expect(toggleSelectionHidden()).toBe(true)
    expect(updateFrame).not.toHaveBeenCalled()
    expect(requestFrame).not.toHaveBeenCalled()
    expect(notice()).toContain('schreibgeschützt')
  })

  it('keeps Creator hiding available for template content', () => {
    mocks.manageLocks = true
    seed(page(LOCKED_BODY))
    expect(setLayerHidden(frame(page(LOCKED_BODY)), SECTION, true)).toBe(true)
    expect(updateFrame).toHaveBeenCalledTimes(1)
    expect(requestFrame).toHaveBeenCalledTimes(1)
  })

  it('keeps legacy locks refusing even for creators on template-marked elements', () => {
    mocks.manageLocks = true
    const html = page('<section data-od-id="hero" data-doop-locked="true"><p>A</p></section>')
    seed(html)
    expect(deleteLayer(frame(html), SECTION)).toBe(false)
    expect(updateFrame).not.toHaveBeenCalled()
  })

  it('refuses non-creator edits on frozen areas with read-only feedback', () => {
    seed(page(LOCKED_BODY))
    expect(deleteLayer(frame(page(LOCKED_BODY)), DIV)).toBe(false)
    expect(notice()).toContain('schreibgeschützt')
    mocks.manageLocks = true
    expect(deleteLayer(frame(page(LOCKED_BODY)), DIV)).toBe(true)
  })

  it('treats a stale selector as refused without saving', () => {
    seed(page(LOCKED_BODY))
    expect(deleteLayer(frame(page(LOCKED_BODY)), 'body > nav:nth-of-type(9)')).toBe(false)
    expect(updateFrame).not.toHaveBeenCalled()
  })

  it('drops a locked pick on capability change, keeping frozen and stale picks', () => {
    seed(page(LOCKED_BODY))
    const f = frame(page(LOCKED_BODY))
    useStore.getState().pickElement({ frameId: 'f1', selector: SECTION })
    expect(dropTemplateBlockedSelection(f, false)).toBe(true)
    expect(useStore.getState().selectedElement).toBeNull()
    expect(notice()).toContain('gesperrt')

    useStore.getState().pickElement({ frameId: 'f1', selector: SECTION })
    expect(dropTemplateBlockedSelection(f, true)).toBe(false)
    expect(useStore.getState().selectedElement).toEqual({ frameId: 'f1', selector: SECTION })

    useStore.getState().pickElement({ frameId: 'f1', selector: DIV })
    expect(dropTemplateBlockedSelection(f, false)).toBe(false)

    useStore.getState().pickElement({ frameId: 'f1', selector: 'body > nav:nth-of-type(9)' })
    expect(dropTemplateBlockedSelection(f, false)).toBe(false)

    useStore.getState().pickElement({ frameId: 'other', selector: SECTION })
    expect(dropTemplateBlockedSelection(f, false)).toBe(false)
  })
})

describe('LayersPanel template locks', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mocks.manageLocks = false
    seed(page(LOCKED_BODY))
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    act(() =>
      root.render(
        <TooltipProvider>
          <LayersPanel onAddFrame={() => {}} />
        </TooltipProvider>,
      ),
    )
    /* open the frame's rows (as a pick inside the frame would), then clear
       the pick so each test starts unselected */
    act(() => useStore.getState().pickElement({ frameId: 'f1', selector: DIV }))
    act(() => useStore.getState().pickElement(null))
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  function row(key: string): HTMLElement {
    const el = container.querySelector<HTMLElement>(`[data-row-key="${key}"]`)
    if (!el) throw new Error(`row ${key} not rendered`)
    return el
  }

  it('shows a lock on the template-locked row', () => {
    const lock = row(`f1|${SECTION}`).querySelector('button[aria-label="Sperren"], button[aria-label="Entsperren"]')
    expect(lock).not.toBeNull()
  })

  it('refuses mouse selection of locked content with German feedback', () => {
    act(() => {
      row(`f1|${SECTION}`).click()
    })
    expect(useStore.getState().selectedElement).toBeNull()
    expect(notice()).toContain('gesperrt')
  })

  it('selects frozen rows read-only by mouse', () => {
    act(() => {
      row(`f1|${DIV}`).click()
    })
    expect(useStore.getState().selectedElement).toEqual({ frameId: 'f1', selector: DIV })
    expect(useStore.getState().elementPanelOpen).toBe(true)
  })

  it('refuses keyboard selection of locked content', () => {
    /* no element picked: the frame row is current, ArrowDown walks onto the
       locked section row */
    expect(useStore.getState().selectedElement).toBeNull()
    const tree = container.querySelector<HTMLElement>('[role="tree"]')!
    act(() => {
      tree.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    })
    expect(useStore.getState().selectedElement).toBeNull()
    expect(notice()).toContain('gesperrt')
  })

  it('lets creators select locked rows', () => {
    mocks.manageLocks = true
    act(() => {
      row(`f1|${SECTION}`).click()
    })
    expect(useStore.getState().selectedElement).toEqual({ frameId: 'f1', selector: SECTION })
  })
})
