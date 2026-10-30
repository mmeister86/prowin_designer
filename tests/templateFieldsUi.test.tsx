// @vitest-environment happy-dom
import { expect, it, vi, afterEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Frame } from '../shared/types'

const mocks = vi.hoisted(() => ({ manageLocks: false }))
vi.mock('../src/prowin/canvasPermissions', () => ({
  useCanvasCapabilities: () => ({ manageLocks: mocks.manageLocks }),
}))

const { TemplateFieldsSection } = await import('../src/prowin/TemplateFieldsSection')

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
