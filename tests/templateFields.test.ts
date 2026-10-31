// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

const { duplicateElement, mintTemplateField, moveElement, setTemplateField, templateFieldOf, unmarkTemplateField } =
  await import('../src/lib/layers')
const { extractTemplateFields } = await import('../shared/prowin/templateAttributes.ts')

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const SECTION = 'body:nth-of-type(1) > section:nth-of-type(1)'
const INNER = 'body:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)'

const field = {
  id: 'hero-title',
  role: 'headline' as const,
  label: 'Titel',
  locked: true,
  maxLength: 60,
  allowedColors: ['prowin-ci-blau'],
}

describe('template field read/write', () => {
  it('writes all attributes and keeps content and other attributes', () => {
    const html = page('<section class="hero" id="s"><p>Hello</p></section>')
    const next = setTemplateField(html, SECTION, field)!
    expect(next).toContain('data-od-id="hero-title"')
    expect(next).toContain('data-od-role="headline"')
    expect(next).toContain('data-od-label="Titel"')
    expect(next).toContain('data-od-locked')
    expect(next).toContain('data-od-max-length="60"')
    expect(next).toContain('data-od-allowed-colors="prowin-ci-blau"')
    expect(next).toContain('class="hero"')
    expect(next).toContain('<p>Hello</p>')
    expect(templateFieldOf(next, SECTION)).toEqual(field)
  })

  it('returns null when renaming onto an id taken by another element', () => {
    const html = page('<section><p>A</p></section><p>B</p>')
    const marked = setTemplateField(html, SECTION, field)!
    const other = 'body:nth-of-type(1) > p:nth-of-type(1)'
    const otherMarked = setTemplateField(marked, other, { ...field, id: 'other-id' })!
    expect(setTemplateField(otherMarked, other, { ...field, id: 'hero-title' })).toBeNull()
    // same element keeping its own id is fine
    expect(setTemplateField(otherMarked, other, { ...field, id: 'other-id', label: 'Neu' })).not.toBeNull()
  })

  it('returns null for an invalid role and for a stale selector', () => {
    const html = page('<section><p>A</p></section>')
    expect(setTemplateField(html, SECTION, { ...field, role: 'nope' as never })).toBeNull()
    expect(setTemplateField(html, 'body > nav:nth-of-type(9)', field)).toBeNull()
    expect(templateFieldOf(html, 'body > nav:nth-of-type(9)')).toBeNull()
    expect(templateFieldOf(html, SECTION)).toBeNull()
  })

  it('mints a valid frame-unique id on an unmarked element and changes nothing else', () => {
    const html = page('<section class="hero"><p>A</p></section>')
    const next = mintTemplateField(html, SECTION)!
    const got = templateFieldOf(next, SECTION)!
    expect(got.id).toMatch(/^[A-Za-z][A-Za-z0-9_-]{0,63}$/)
    expect(next).toContain('class="hero"')
    expect(next).toContain('<p>A</p>')
    // a second element mints a different id
    const other = 'body:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)'
    const next2 = mintTemplateField(next, other)!
    expect(templateFieldOf(next2, other)!.id).not.toBe(got.id)
    // minting on an already marked element leaves html unchanged
    expect(mintTemplateField(next2, SECTION)).toBe(next2)
  })

  it('unmarks by removing all six attributes', () => {
    const html = setTemplateField(page('<section><p>A</p></section>'), SECTION, field)!
    const next = unmarkTemplateField(html, SECTION)!
    for (const attr of [
      'data-od-id',
      'data-od-role',
      'data-od-label',
      'data-od-locked',
      'data-od-max-length',
      'data-od-allowed-colors',
    ])
      expect(next).not.toContain(attr)
    expect(next).toContain('<p>A</p>')
    expect(templateFieldOf(next, SECTION)).toBeNull()
    expect(unmarkTemplateField(html, 'body > nav:nth-of-type(9)')).toBeNull()
  })

  it('remints every copied data-od-id on duplicate, leaving originals alone', () => {
    const html = setTemplateField(page('<section><p>A</p><p>B</p></section>'), SECTION, field)!
    const inner2 = 'body:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(2)'
    const html2 = setTemplateField(html, inner2, { ...field, id: 'second' })!
    const before = extractTemplateFields(html2).map((f) => f.id)
    const next = duplicateElement(html2, SECTION)!
    const after = extractTemplateFields(next).map((f) => f.id)
    // originals still present with same ids
    for (const id of before) expect(after).toContain(id)
    // copies add the same count of fresh unique ids
    expect(after).toHaveLength(before.length * 2)
    expect(new Set(after).size).toBe(after.length)
  })

  it('keeps the id across moveElement', () => {
    const html = setTemplateField(page('<section><p>A</p></section><p>B</p>'), SECTION, field)!
    const moved = moveElement(html, SECTION, {
      selector: 'body:nth-of-type(1) > p:nth-of-type(1)',
      place: 'after',
    })!
    expect(templateFieldOf(moved.html, moved.selector)?.id).toBe('hero-title')
    expect(extractTemplateFields(moved.html).map((f) => f.id)).toEqual(['hero-title'])
    expect(templateFieldOf(moved.html, INNER)).toBeNull()
  })
})
