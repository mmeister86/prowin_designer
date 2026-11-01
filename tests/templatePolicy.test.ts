// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'

/* Breaks caught here: presence-based template locks (incl. empty value)
   not blocking nested content for non-creators; creators losing edit
   access; legacy locks leaking into the template policy; frozen areas in
   template frames offered as editable; plain frames restricted; nested
   color bounds not intersected; stale selectors not reported as null. */
import { templatePolicyOf } from '../src/prowin/templatePolicy'

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const SECTION = 'body:nth-of-type(1) > section:nth-of-type(1)'
const SPAN = 'body:nth-of-type(1) > section:nth-of-type(1) > h1:nth-of-type(1) > span:nth-of-type(1)'

const LOCKED = page(
  '<section data-od-id="hero" data-od-role="headline" data-od-locked="true"><h1><span>Hi</span></h1></section><p>B</p>',
)
const EMPTY_LOCK = page('<section data-od-id="hero" data-od-locked><h1><span>Hi</span></h1></section>')
const FROZEN = page('<section data-od-id="hero"><h1>Titel</h1></section><div><p>A</p></div>')
const PLAIN = page('<section><p>A</p></section><p>B</p>')

describe('templatePolicyOf', () => {
  it('blocks a locked field and its nested span for non-creators', () => {
    expect(templatePolicyOf(LOCKED, SECTION, false)).toEqual({
      template: true,
      locked: true,
      readOnly: true,
      allowedColors: null,
    })
    expect(templatePolicyOf(LOCKED, SPAN, false)?.locked).toBe(true)
    expect(templatePolicyOf(LOCKED, SPAN, false)?.readOnly).toBe(true)
  })

  it('counts a present-but-empty data-od-locked as locked', () => {
    expect(templatePolicyOf(EMPTY_LOCK, SECTION, false)?.locked).toBe(true)
    expect(templatePolicyOf(EMPTY_LOCK, SPAN, false)?.locked).toBe(true)
  })

  it('lets creators pick and edit template locks', () => {
    expect(templatePolicyOf(LOCKED, SECTION, true)).toEqual({
      template: true,
      locked: false,
      readOnly: false,
      allowedColors: null,
    })
    expect(templatePolicyOf(LOCKED, SPAN, true)?.locked).toBe(false)
    expect(templatePolicyOf(EMPTY_LOCK, SPAN, true)?.readOnly).toBe(false)
  })

  it('ignores legacy locks: no template mark means no template policy', () => {
    const legacy = page('<section data-doop-locked="true"><p>A</p></section>')
    expect(templatePolicyOf(legacy, SECTION, false)).toEqual({
      template: false,
      locked: false,
      readOnly: false,
      allowedColors: null,
    })
  })

  it('marks unmarked areas of template frames selectable but read-only', () => {
    const div = 'body:nth-of-type(1) > div:nth-of-type(1)'
    expect(templatePolicyOf(FROZEN, SECTION, false)).toEqual({
      template: true,
      locked: false,
      readOnly: false,
      allowedColors: null,
    })
    expect(templatePolicyOf(FROZEN, div, false)).toEqual({
      template: true,
      locked: false,
      readOnly: true,
      allowedColors: null,
    })
  })

  it('leaves plain frames fully editable', () => {
    expect(templatePolicyOf(PLAIN, SECTION, false)).toEqual({
      template: false,
      locked: false,
      readOnly: false,
      allowedColors: null,
    })
  })

  it('returns null for a stale selector', () => {
    expect(templatePolicyOf(LOCKED, 'body > nav:nth-of-type(9)', false)).toBeNull()
    expect(templatePolicyOf(LOCKED, 'body > nav:nth-of-type(9)', true)).toBeNull()
  })

  it('intersects allowed colors across nested fields', () => {
    const html = page(
      '<section data-od-id="a" data-od-allowed-colors="prowin-ci-blau, prowin-ci-rot">' +
        '<p data-od-id="b" data-od-allowed-colors="prowin-ci-rot,prowin-ci-gruen">x</p></section>',
    )
    const p = 'body:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)'
    expect(templatePolicyOf(html, p, false)?.allowedColors).toEqual(['prowin-ci-rot'])
    expect(templatePolicyOf(html, SECTION, false)?.allowedColors).toEqual(['prowin-ci-blau', 'prowin-ci-rot'])
  })

  it('reports null colors when unrestricted and [] when no token is permitted', () => {
    const open = page('<section data-od-id="a"><p data-od-id="b">x</p></section>')
    const p = 'body:nth-of-type(1) > section:nth-of-type(1) > p:nth-of-type(1)'
    expect(templatePolicyOf(open, p, false)?.allowedColors).toBeNull()
    const disjoint = page(
      '<section data-od-id="a" data-od-allowed-colors="prowin-ci-blau">' +
        '<p data-od-id="b" data-od-allowed-colors="prowin-ci-rot">x</p></section>',
    )
    expect(templatePolicyOf(disjoint, p, false)?.allowedColors).toEqual([])
    const empty = page('<section data-od-id="a" data-od-allowed-colors=""><p>x</p></section>')
    expect(templatePolicyOf(empty, SECTION, false)?.allowedColors).toEqual([])
  })
})
