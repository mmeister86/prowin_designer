// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Frame } from '../shared/types'

const mocks = vi.hoisted(() => ({ manageLocks: false, apply: vi.fn(), mark: vi.fn() }))
vi.mock('../src/prowin/canvasPermissions', () => ({
  useCanvasCapabilities: () => ({ manageLocks: mocks.manageLocks }),
}))
vi.mock('../src/lib/layerEdits', () => ({
  applyTemplateField: (...args: unknown[]) => mocks.apply(...args),
  markTemplateField: (...args: unknown[]) => mocks.mark(...args),
}))

const { TemplateFieldsSection } = await import('../src/prowin/TemplateFieldsSection')
const { setTemplateField: realSetTemplateField } = await import('../src/lib/layers')
const { validateTemplateField } = await import('../shared/prowin/templateAttributes.ts')

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

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const SECTION = 'body:nth-of-type(1) > section:nth-of-type(1)'
const MARKED = page(
  '<section data-od-id="hero-title" data-od-role="headline" data-od-label="Titel" data-od-locked="true" data-od-max-length="60" data-od-allowed-colors="prowin-ci-blau"><p>A</p></section>',
)

afterEach(() => {
  mocks.manageLocks = false
  mocks.apply.mockClear()
  mocks.mark.mockClear()
})

it('renders nothing without manageLocks', () => {
  expect(renderToStaticMarkup(<TemplateFieldsSection frame={frame(MARKED)} selector={SECTION} />)).toBe('')
})

it('offers marking for an unmarked element', () => {
  mocks.manageLocks = true
  const html = renderToStaticMarkup(
    <TemplateFieldsSection frame={frame(page('<section><p>A</p></section>'))} selector={SECTION} />,
  )
  expect(html).toContain('Als Template-Feld markieren')
})

it('shows id, role, label, lock, max length and allowed colors for a marked field', () => {
  mocks.manageLocks = true
  const html = renderToStaticMarkup(<TemplateFieldsSection frame={frame(MARKED)} selector={SECTION} />)
  expect(html).toContain('hero-title')
  expect(html).toContain('Rolle')
  expect(html).toContain('Bezeichnung')
  expect(html).toContain('Gesperrt')
  expect(html).toContain('Max. Zeichen')
  expect(html).toContain('Erlaubte Farben')
})

it('clears Max. Zeichen back to unset and saves without data-od-max-length', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  mocks.manageLocks = true
  const container = document.createElement('div')
  const root = createRoot(container)
  try {
    await act(async () => root.render(<TemplateFieldsSection frame={frame(MARKED)} selector={SECTION} />))
    const clear = container.querySelector('button[aria-label="Maximallänge entfernen"]') as HTMLButtonElement | null
    expect(clear).not.toBeNull()
    await act(async () => clear!.click())
    expect(mocks.apply).toHaveBeenCalledWith(
      frame(MARKED),
      SECTION,
      expect.objectContaining({ id: 'hero-title', maxLength: null }),
    )
    const saved = mocks.apply.mock.calls[0]![2] as Parameters<typeof realSetTemplateField>[2]
    expect(validateTemplateField(saved)).toEqual([])
    expect(realSetTemplateField(MARKED, SECTION, saved)).not.toContain('data-od-max-length')
  } finally {
    await act(async () => root.unmount())
  }
})
