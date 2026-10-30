import { describe, expect, it } from 'vitest'
import {
  extractTemplateFields,
  validateTemplateField,
  diffTemplateMeta,
  mintTemplateId,
  type TemplateField,
} from '../shared/prowin/templateAttributes'

const field = (patch: Partial<TemplateField> = {}): TemplateField => ({
  id: 'titel',
  role: 'headline',
  label: 'Titel',
  locked: false,
  maxLength: null,
  allowedColors: [],
  ...patch,
})

describe('templateAttributes', () => {
  it('extracts fields from real tags only', () => {
    const html = `<html><head><style data-od-brand>:root{}</style></head><body>
      <!-- <h1 data-od-id="fake">x</h1> -->
      <script>var s = '<p data-od-id="fake2">'</script>
      <h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel" data-od-locked data-od-max-length="80" data-od-allowed-colors="prowin-ci-blau, prowin-ci-orange">Hallo</h1>
    </body></html>`
    expect(extractTemplateFields(html)).toEqual([
      {
        id: 'titel',
        role: 'headline',
        label: 'Titel',
        locked: true,
        maxLength: 80,
        allowedColors: ['prowin-ci-blau', 'prowin-ci-orange'],
      },
    ])
  })

  it('validates id, role, maxLength and color tokens strictly', () => {
    expect(validateTemplateField(field())).toEqual([])
    expect(validateTemplateField(field({ id: '1x' })).length).toBeGreaterThan(0)
    expect(validateTemplateField(field({ role: 'admin' as TemplateField['role'] })).length).toBeGreaterThan(0)
    expect(validateTemplateField(field({ maxLength: 0 })).length).toBeGreaterThan(0)
    expect(validateTemplateField(field({ maxLength: 2.5 })).length).toBeGreaterThan(0)
    expect(validateTemplateField(field({ allowedColors: ['#fff'] })).length).toBeGreaterThan(0)
    expect(validateTemplateField(field({ allowedColors: ['primary'] })).length).toBeGreaterThan(0)
  })

  it('diffs semantically: locked="" equals locked="true", content edits do not count', () => {
    const prev = `<h1 data-od-id="titel" data-od-locked>Alt</h1>`
    const next = `<h1 data-od-locked="true" data-od-id="titel">Neu</h1>`
    expect(diffTemplateMeta(prev, next)).toEqual({ changed: false, duplicates: [], invalid: [] })
    expect(diffTemplateMeta(prev, `<h1 data-od-id="titel">Neu</h1>`).changed).toBe(true)
    expect(
      diffTemplateMeta(prev, `<h1 data-od-id="titel" data-od-locked>Neu</h1><p data-od-id="titel">x</p>`).duplicates,
    ).toEqual(['titel'])
  })

  it('mints unique valid ids', () => {
    const taken = new Set(['feld-aaaaaaaa'])
    const ids = ['aaaaaaaa', 'bbbbbbbb']
    expect(mintTemplateId(taken, () => ids.shift()!)).toBe('feld-bbbbbbbb')
  })

  it('returns validation messages, not ids, for invalid fields', () => {
    const prev = `<h1 data-od-id="titel">Alt</h1>`
    const next = `<h1 data-od-id="titel" data-od-role="admin" data-od-allowed-colors="primary">Neu</h1>`
    const result = diffTemplateMeta(prev, next)
    expect(result.invalid.length).toBeGreaterThan(0)
    expect(result.invalid[0]).toContain('admin')
    expect(result.invalid.some((message) => message.includes('primary'))).toBe(true)
  })
})
