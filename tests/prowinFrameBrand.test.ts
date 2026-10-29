import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { brandStyle, normalizeFrameHtml, withoutBrandStyle } from '../server/prowin/frameBrand.ts'
import { hasFrameContent } from '../shared/frameContent.ts'

const origin = 'https://designer.example'

describe('frame brand normalization', () => {
  it.each(['', '<p>Hallo &amp; willkommen</p>', '<!doctype html><html><body>Hallo</body></html>'])(
    'adds fonts and tokens without changing content: %s',
    (html) => {
      const result = normalizeFrameHtml(html, origin)
      expect(result.match(/<style data-od-brand>/g)).toHaveLength(1)
      expect(withoutBrandStyle(result)).toBe(html)
      expect(normalizeFrameHtml(result, origin)).toBe(result)
      expect(result).toContain('--prowin-ci-hellblau:#19b4e9')
      expect(result).toContain(`${origin}/fonts/sofia-sans-latin-300-normal.woff2`)
      expect(result.match(/@font-face/g)).toHaveLength(15)
    },
  )

  it('uses the approved CI tokens and existing core WOFF2 files', () => {
    const source = readFileSync('DESIGN-prowin.md', 'utf8')
    const css = brandStyle(origin)
    const tokens = [...source.matchAll(/`(--prowin-ci-[\w-]+)`\s*\|\s*`(#[a-f\d]{6})`/gi)]
    expect(tokens).toHaveLength(13)
    for (const [, token, value] of tokens) expect(css).toContain(`${token}:${value}`)
    for (const [, file] of css.matchAll(/\/fonts\/([^']+)/g)) {
      expect(readFileSync(`public/fonts/${file}`).subarray(0, 4).toString()).toBe('wOF2')
    }
    expect(css).not.toMatch(/Lumios/)
  })

  it('replaces all old blocks and removes font links and imports, preserving unrelated HTML', () => {
    const html = `<!doctype html><html><head data-test=">">
<STYLE media="all" DATA-OD-BRAND="old">old</STYLE><style data-od-brand>duplicate</style>
<link href="https://fonts.googleapis.com/css2?family=Roboto" rel=stylesheet>
<link rel="preconnect" href="//fonts.gstatic.com">
<link rel="preload" as="font" href="https://cdn.example/a.woff2">
<link rel=stylesheet href="https://cdn.example/app.css">
<style>/* @import 'https://fonts.googleapis.com/keep'; */
@import url('https://fonts.googleapis.com/css2?family=Roboto');
p::after{content:"@import 'https://fonts.googleapis.com/keep';"}p{color:red}</style>
</head><body><h1>Unverändert</h1></body></html>`
    const result = normalizeFrameHtml(html, origin)
    expect(result.match(/<style data-od-brand>/g)).toHaveLength(1)
    expect(result).not.toContain('duplicate')
    expect(result).not.toContain('css2?family=Roboto')
    expect(result).not.toContain('cdn.example/a.woff2')
    expect(result).toContain('<link rel=stylesheet href="https://cdn.example/app.css">')
    expect(result).toContain("/* @import 'https://fonts.googleapis.com/keep'; */")
    expect(result).toContain('content:"@import \'https://fonts.googleapis.com/keep\';"')
    expect(normalizeFrameHtml(result, origin)).toBe(result)
  })

  it('does not rewrite comments, scripts, raw text, or tag-like strings in attributes', () => {
    const html = `<!-- <style data-od-brand>comment</style> -->
<script>const sample = '<style data-od-brand>string</style><link href="https://fonts.googleapis.com/css">';</script>
<textarea><style data-od-brand>text</style></textarea>
<div title='<style data-od-brand>attribute</style>'>Text</div>`
    expect(withoutBrandStyle(normalizeFrameHtml(html, origin))).toBe(html)
  })

  it('refreshes old CSS and origin deterministically', () => {
    const html = '<html><head></head><body>Text</body></html>'
    const old = normalizeFrameHtml(html, 'https://old.example')
    const result = normalizeFrameHtml(old, origin)
    expect(result).not.toContain('old.example')
    expect(result).toBe(normalizeFrameHtml(html, origin))
  })

  it('keeps branded placeholders empty for editor controls and MCP nudges', () => {
    expect(hasFrameContent(normalizeFrameHtml('', origin))).toBe(false)
    expect(hasFrameContent('<STYLE media="all" DATA-OD-BRAND="">generated</STYLE>')).toBe(false)
    expect(hasFrameContent(normalizeFrameHtml('<p>Content</p>', origin))).toBe(true)
    expect(hasFrameContent('<script>const sample="<style data-od-brand>text</style>"</script>')).toBe(true)
  })

  it('preserves declarations and text that only looks like a malformed tag', () => {
    const html =
      '<!DOCTYPE html PUBLIC "identifier > <style data-od-brand>keep</style>"><p>2 < style data-od-brand>Text</p>'
    expect(withoutBrandStyle(normalizeFrameHtml(html, origin))).toBe(html)
  })

  it('preserves tag-shaped character data in SVG', () => {
    const html =
      '<svg><text><![CDATA[<style data-od-brand>logo</style><link href="https://fonts.googleapis.com/css">]]></text></svg>'
    expect(withoutBrandStyle(normalizeFrameHtml(html, origin))).toBe(html)
    expect(hasFrameContent(html)).toBe(true)
  })

  it.each([
    '@import /* font; comment */ url("https://fonts.googleapis.com/css2?family=Roboto");',
    '@import url(/* font */ "https://fonts.googleapis.com/css2?family=Roboto");',
    '@import"https://fonts.googleapis.com/css2?family=Roboto";',
  ])('removes provider imports with CSS trivia: %s', (statement) => {
    const html = `<style>${statement}p{color:red}</style><p>Content</p>`
    expect(withoutBrandStyle(normalizeFrameHtml(html, origin))).toBe('<style>p{color:red}</style><p>Content</p>')
  })
})
