// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Canvas, Frame } from '../shared/types'

/* Breaks caught here: non-creator template fields offering free hex/RGB/
   alpha/border color controls that the server necessarily rejects; token
   allowlists not intersected across nested fields; empty intersections
   still editable; color writes not using the exact `var(--token)` form;
   server-forbidden geometry/HTML controls still offered in template
   fields; creators or plain frames losing the full editor. Hand-derived
   literals; the policy comes from the real templatePolicyOf. */
const mocks = vi.hoisted(() => ({
  manageLocks: false,
  info: null as unknown,
  style: vi.fn((_id: string, _sel: string, _patch: unknown) => Promise.resolve(null)),
}))
vi.mock('../src/prowin/canvasPermissions', () => ({
  useCanvasCapabilities: () => ({ manageLocks: mocks.manageLocks, localAgent: false, publish: false }),
}))
vi.mock('../src/lib/frameBridge', () => ({
  inspectElement: () => Promise.resolve(mocks.info),
  styleElement: (...args: unknown[]) => (mocks.style as (...a: unknown[]) => unknown)(...args) as Promise<null>,
  editElementGeometry: () => Promise.resolve(null),
  styleGesture: () => Promise.resolve(null),
  onFrameChange: () => () => {},
  requestFrame: () => Promise.resolve(null),
}))
vi.mock('../src/lib/api', () => ({
  api: { updateFrame: () => Promise.resolve({} as Frame) },
  errorMessage: (_err: unknown, fallback: string) => fallback,
}))

const { useStore } = await import('../src/lib/store')
const { templatePolicyOf, templateCodepoints, templateMaxLengthsOf } = await import('../src/prowin/templatePolicy')
const { ElementPanel } = await import('../src/components/ElementPanel')
const { TooltipProvider } = await import('../src/components/ui/tooltip')
import type { ElementInfo } from '../src/lib/frameBridge'

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const SECTION = 'body:nth-of-type(1) > section:nth-of-type(1)'
const FIELD = 'body:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)'
const PLAIN = 'body:nth-of-type(1) > section:nth-of-type(1)'

const CONSTRAINED = page(
  '<section data-od-id="hero" data-od-role="headline"><p data-od-id="titel" data-od-role="headline" data-od-allowed-colors="prowin-ci-blau,prowin-ci-orange">Hallo</p></section>',
)
const NESTED = page(
  '<section data-od-id="a" data-od-role="body" data-od-allowed-colors="prowin-ci-blau,prowin-ci-orange">' +
    '<p data-od-id="b" data-od-role="body" data-od-allowed-colors="prowin-ci-orange,prowin-ci-hellblau">x</p></section>',
)
const DISJOINT = page(
  '<section data-od-id="a" data-od-role="body" data-od-allowed-colors="prowin-ci-blau">' +
    '<p data-od-id="b" data-od-role="body" data-od-allowed-colors="prowin-ci-orange">x</p></section>',
)

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

function makeInfo(html: string, selector: string): ElementInfo {
  const policy = templatePolicyOf(html, selector, mocks.manageLocks)
  if (!policy) throw new Error('stale selector in test setup')
  return {
    tag: 'p',
    id: '',
    classes: [],
    parent: null,
    index: 1,
    count: 1,
    inline: {},
    hasText: true,
    rect: { x: 0, y: 0, width: 100, height: 20 },
    geometry: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, enabled: true, canAlign: true },
    scale: { x: 1, y: 1 },
    position: 'static',
    display: 'block',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'flex-start',
    alignItems: 'stretch',
    writingMode: 'horizontal-tb',
    width: 100,
    height: 20,
    widthValue: '100px',
    heightValue: '20px',
    flexGrow: 0,
    boxSizing: 'content-box',
    boxExtras: { width: 0, height: 0 },
    aspectRatio: 'auto',
    naturalAspectRatio: null,
    minWidth: '0px',
    rowGap: 0,
    columnGap: 0,
    padding: [0, 0, 0, 0],
    opacity: 1,
    visibility: 'visible',
    clipsContent: false,
    backgroundColor: 'rgb(255, 255, 255)',
    borderWidths: [0, 0, 0, 0],
    borderStyle: 'none',
    borderColor: 'rgb(0, 0, 0)',
    borderRadius: 0,
    color: 'rgb(0, 0, 0)',
    fontSize: 16,
    fontWeight: '400',
    fontFamily: 'Arial, sans-serif',
    fontFamilies: [],
    textAlign: 'left',
    direction: 'ltr',
    policy,
  } as ElementInfo
}

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

describe('template text helpers', () => {
  it('counts decoded Unicode codepoints, not UTF-16 units', () => {
    expect(templateCodepoints('A😀B')).toBe(3)
    expect(templateCodepoints('A😀BC')).toBe(4)
    expect(templateCodepoints('')).toBe(0)
  })

  it('reports every applicable ancestor limit for an edit', () => {
    const html = page(
      '<section data-od-id="a" data-od-max-length="3"><p data-od-id="b" data-od-max-length="8">x</p></section>',
    )
    expect(templateMaxLengthsOf(html, FIELD)).toEqual([8, 3])
    expect(templateMaxLengthsOf(html, SECTION)).toEqual([3])
    expect(templateMaxLengthsOf(page('<section data-od-id="a"><p data-od-id="b">x</p></section>'), FIELD)).toEqual([])
    expect(templateMaxLengthsOf(html, 'body > nav:nth-of-type(9)')).toBeNull()
  })
})

describe('ElementPanel template color constraints', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mocks.manageLocks = false
    mocks.style.mockClear()
    try {
      localStorage.setItem('doop:element-panel-tab', 'design')
    } catch {
      /* private mode: the choice just doesn't stick */
    }
    const canvas: Canvas = { id: 'c1', name: 'Canvas', frames: [frame(CONSTRAINED)] } as Canvas
    useStore.setState({ canvas, notice: null })
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => root.unmount())
    container.remove()
  })

  async function show(html: string, selector: string, inline?: Record<string, string>) {
    useStore.setState({ canvas: { id: 'c1', name: 'Canvas', frames: [frame(html)] } as Canvas })
    mocks.info = makeInfo(html, selector)
    if (inline) (mocks.info as { inline: Record<string, string> }).inline = inline
    /* sync act for the mount (async act swallows the panel's debounced
       re-read timer); the sleep outside act lets it fire */
    act(() => {
      root.render(
        <TooltipProvider>
          <ElementPanel frame={frame(html)} selector={selector} />
        </TooltipProvider>,
      )
    })
    await new Promise((r) => setTimeout(r, 300))
    act(() => {})
  }

  function tokenOptions(label: string): string[] {
    const select = container.querySelector(`select[aria-label="${label}"]`) as HTMLSelectElement | null
    if (!select) throw new Error(`missing select ${label}`)
    return [...select.options].map((o) => o.value)
  }

  it('offers only the allowed tokens and writes the exact var() form', async () => {
    await show(CONSTRAINED, FIELD)
    expect(tokenOptions('Füllfarbe (Vorlage)')).toEqual(['', 'prowin-ci-blau', 'prowin-ci-orange'])
    expect(tokenOptions('Rahmenfarbe (Vorlage)')).toEqual(['', 'prowin-ci-blau', 'prowin-ci-orange'])
    expect(tokenOptions('Textfarbe (Vorlage)')).toEqual(['', 'prowin-ci-blau', 'prowin-ci-orange'])
    /* no free hex/RGB/alpha escape routes for any of the three colors */
    expect(container.querySelector('input[type="color"]')).toBeNull()
    expect(container.querySelector('input[aria-label="Füllfarbe"]')).toBeNull()
    expect(container.querySelector('input[aria-label="Deckkraft der Füllung"]')).toBeNull()

    const select = container.querySelector('select[aria-label="Textfarbe (Vorlage)"]') as HTMLSelectElement
    await act(async () => {
      select.value = 'prowin-ci-blau'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(mocks.style).toHaveBeenCalledWith('f1', FIELD, { color: 'var(--prowin-ci-blau)' })
  })

  it('intersects nested allowlists to their joint tokens', async () => {
    await show(NESTED, FIELD)
    expect(tokenOptions('Textfarbe (Vorlage)')).toEqual(['', 'prowin-ci-orange'])
  })

  it('disables color changes when nested allowlists share no token', async () => {
    await show(DISJOINT, FIELD)
    expect(container.querySelector('select[aria-label="Textfarbe (Vorlage)"]')).toBeNull()
    expect(container.querySelector('select[aria-label="Füllfarbe (Vorlage)"]')).toBeNull()
    expect(container.querySelector('select[aria-label="Rahmenfarbe (Vorlage)"]')).toBeNull()
    expect(container.textContent).toContain('Keine Farbe erlaubt')
    expect(container.querySelector('input[type="color"]')).toBeNull()
    expect(mocks.style).not.toHaveBeenCalled()
  })

  it('suppresses server-forbidden geometry and HTML editing inside template fields', async () => {
    await show(CONSTRAINED, FIELD)
    expect(container.querySelector('input[aria-label="X-Position"]')).toBeNull()
    expect(container.querySelector('select[aria-label="Darstellung"]')).toBeNull()
    /* the HTML tab offers no free markup editing in template fields */
    act(() => {
      root.unmount()
    })
    try {
      localStorage.setItem('doop:element-panel-tab', 'html')
    } catch {
      /* private mode: the choice just doesn't stick */
    }
    root = createRoot(container)
    act(() => {
      root.render(
        <TooltipProvider>
          <ElementPanel frame={frame(CONSTRAINED)} selector={FIELD} />
        </TooltipProvider>,
      )
    })
    await new Promise((r) => setTimeout(r, 300))
    act(() => {})
    const code = container.querySelector('textarea')
    expect(code?.disabled).toBe(true)
  })

  it('keeps the full free editor for creators', async () => {
    mocks.manageLocks = true
    await show(CONSTRAINED, FIELD)
    expect(container.querySelector('input[type="color"]')).not.toBeNull()
    expect(container.querySelector('input[aria-label="Deckkraft der Füllung"]')).not.toBeNull()
    expect(container.querySelector('input[aria-label="X-Position"]')).not.toBeNull()
    expect(container.querySelector('select[aria-label="Textfarbe (Vorlage)"]')).toBeNull()
  })

  it('leaves plain frames fully editable for non-creators', async () => {
    const plain = page('<section><p>Hallo</p></section>')
    await show(plain, PLAIN)
    expect(container.querySelector('input[type="color"]')).not.toBeNull()
    expect(container.querySelector('input[aria-label="X-Position"]')).not.toBeNull()
    expect(container.querySelector('select[aria-label="Textfarbe (Vorlage)"]')).toBeNull()
  })

  it('shows a non-token current color as disallowed instead of claiming a token', async () => {
    await show(CONSTRAINED, FIELD, { color: '#ff0000' })
    const select = container.querySelector('select[aria-label="Textfarbe (Vorlage)"]') as HTMLSelectElement | null
    expect(select).not.toBeNull()
    expect(select!.value).toBe('')
    expect(select!.options[0]!.textContent).toBe('Aktuelle Farbe nicht erlaubt')
    expect(select!.options[0]!.disabled).toBe(true)
    expect([...select!.options].map((o) => o.value)).toEqual(['', 'prowin-ci-blau', 'prowin-ci-orange'])
  })

  it('keeps keyboard focus out of blocked controls', async () => {
    const locked = page(
      '<section data-od-id="hero" data-od-role="headline" data-od-locked="true"><h1>Hi</h1></section>',
    )
    await show(locked, SECTION)
    const dimmed = container.querySelector('div[aria-disabled="true"]') as HTMLElement | null
    expect(dimmed).not.toBeNull()
    expect(dimmed!.inert).toBe(true)
  })
})
