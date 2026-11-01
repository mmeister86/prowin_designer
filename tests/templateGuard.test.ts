import { describe, expect, it, vi } from 'vitest'
import type { Canvas } from '../shared/types.ts'

vi.mock('../server/prowin/accounts.ts', () => ({
  permissionIdentity: async (userId: string) => ({
    userId,
    creator: userId === 'creator',
    admin: false,
  }),
}))

import { withUserPermissions } from '../server/prowin/permissions.ts'
import { assertTemplateDelete, assertTemplateWrite, hasTemplateFields } from '../server/prowin/templateGuard.ts'

const canvas = { id: 'c1', ownerId: 'creator', frames: [] } as unknown as Canvas

type GuardError = Error & { status?: number }

async function writeError(user: string, prev: string, next: string): Promise<GuardError | null> {
  try {
    await withUserPermissions(user, () => assertTemplateWrite(canvas, prev, next))
    return null
  } catch (error) {
    return error as GuardError
  }
}

const UNLOCKED = '<p data-od-id="a" data-od-role="body">Hallo</p>'
const LOCKED = '<p data-od-id="b" data-od-role="body" data-od-locked>Fest</p>'
const wrap = (inner: string) => `<div>${inner}</div>`
const prev = wrap(`${UNLOCKED}${LOCKED}`)

describe('templateGuard write constraints', () => {
  it('rejects locked text changes for members (403) but allows creators', async () => {
    const next = prev.replace('>Fest<', '>Geändert<')
    expect((await writeError('member', prev, next))?.status).toBe(403)
    expect(await writeError('creator', prev, next)).toBeNull()
  })

  it('rejects locked attribute changes for members', async () => {
    const next = prev.replace('<p data-od-id="b"', '<p class="x" data-od-id="b"')
    expect((await writeError('member', prev, next))?.status).toBe(403)
  })

  it('rejects deletion of a locked field for members', async () => {
    const next = wrap(UNLOCKED)
    expect((await writeError('member', prev, next))?.status).toBe(403)
  })

  it('rejects deletion of an unlocked field for members (IDs are retained)', async () => {
    const next = wrap(LOCKED)
    expect((await writeError('member', prev, next))?.status).toBe(403)
  })

  it('rejects moving a field for members', async () => {
    const next = wrap(`${LOCKED}${UNLOCKED}`)
    expect((await writeError('member', prev, next))?.status).toBe(403)
  })

  it('rejects duplicate IDs with 400 for everyone', async () => {
    const next = prev.replace('</div>', `${UNLOCKED}</div>`)
    for (const user of ['member', 'creator']) {
      const error = await writeError(user, prev, next)
      expect(error?.status).toBe(400)
      expect(error?.message).toContain('Doppelte Template-ID "a"')
    }
  })

  it('rejects renamed IDs for members and invalid metadata with 400 even for creators', async () => {
    const renamed = prev.replace('data-od-id="a"', 'data-od-id="neu"')
    expect((await writeError('member', prev, renamed))?.status).toBe(403)
    const badRole = prev.replace('data-od-role="body">Hallo', 'data-od-role="hero">Hallo')
    for (const user of ['member', 'creator']) {
      const error = await writeError(user, prev, badRole)
      expect(error?.status).toBe(400)
      expect(error?.message).toContain('Ungültige Template-Rolle "hero"')
    }
  })

  it('accepts safe unlocked text edits from members', async () => {
    expect(await writeError('member', prev, prev.replace('>Hallo<', '>Hallo Welt<'))).toBeNull()
  })

  it('accepts equivalent attribute order and lock presence', async () => {
    const next = prev
      .replace(
        'data-od-id="b" data-od-role="body" data-od-locked',
        'data-od-locked="" data-od-role="body" data-od-id="b"',
      )
      .replace('data-od-id="a" data-od-role="body"', 'data-od-role="body" data-od-id="a"')
    expect(await writeError('member', prev, next)).toBeNull()
  })

  it('rejects CSS, inline style, script and overlay changes outside a field', async () => {
    const styled = `<style>p{color:red}</style>${prev}`
    expect((await writeError('member', styled, styled.replace('color:red', 'color:blue')))?.status).toBe(403)
    expect((await writeError('member', prev, prev.replace('<div>', '<div style="color:red">')))?.status).toBe(403)
    const scripted = `<script>var x = 1</script>${prev}`
    expect((await writeError('member', scripted, scripted.replace('var x = 1', 'var x = 2')))?.status).toBe(403)
    const overlay = prev.replace('</div>', '<div style="position:absolute;inset:0"></div></div>')
    expect((await writeError('member', prev, overlay))?.status).toBe(403)
  })

  it('protects SVG namespace content outside fields', async () => {
    const svg = `<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>${prev}`
    expect(await writeError('member', svg, svg)).toBeNull()
    expect((await writeError('member', svg, svg.replace('r="4"', 'r="9"')))?.status).toBe(403)
  })

  it('protects locked fields inside template elements', async () => {
    const tpl = `<template><div>${LOCKED}</div></template>${UNLOCKED}`
    expect(hasTemplateFields(tpl)).toBe(true)
    expect((await writeError('member', tpl, tpl.replace('>Fest<', '>Neu<')))?.status).toBe(403)
  })

  it('treats a parent lock as freezing nested editable fields', async () => {
    const nested = wrap(
      '<section data-od-id="p" data-od-role="body" data-od-locked>Fest <em data-od-id="k" data-od-role="body">Kind</em></section>',
    )
    expect((await writeError('member', nested, nested.replace('>Kind<', '>Neu<')))?.status).toBe(403)
  })

  it('keeps ordinary HTML freely editable but forbids fresh metadata for members', async () => {
    const plain = '<div><p>Hallo</p></div>'
    expect(hasTemplateFields(plain)).toBe(false)
    expect(await writeError('member', plain, plain.replace('Hallo', 'Welt'))).toBeNull()
    const fresh = plain.replace('<p>Hallo</p>', UNLOCKED)
    expect((await writeError('member', plain, fresh))?.status).toBe(403)
    expect(await writeError('creator', plain, fresh)).toBeNull()
  })

  it('counts max-length in Unicode codepoints', async () => {
    const limited = wrap('<p data-od-id="m" data-od-role="body" data-od-max-length="2">ok</p>')
    expect(await writeError('member', limited, limited.replace('>ok<', '>😀a<'))).toBeNull()
    expect((await writeError('member', limited, limited.replace('>ok<', '>😀ab<')))?.status).toBe(403)
  })

  it('counts decoded entities as single codepoints and accepts equivalent spellings', async () => {
    const limited = wrap('<p data-od-id="m" data-od-role="body" data-od-max-length="1">x</p>')
    expect(await writeError('member', limited, limited.replace('>x<', '>&amp;<'))).toBeNull()
    expect((await writeError('member', limited, limited.replace('>x<', '>&amp;&amp;<')))?.status).toBe(403)
    const entity = wrap('<p data-od-id="a" data-od-role="body">A &amp; B</p>')
    expect(await writeError('member', entity, entity.replace('&amp;', '&#38;'))).toBeNull()
  })

  it('preserves whitespace: outside changes rejected, inside counted verbatim', async () => {
    expect((await writeError('member', prev, prev.replace('</p><p', '</p> <p')))?.status).toBe(403)
    const limited = wrap('<p data-od-id="m" data-od-role="body" data-od-max-length="2">ok</p>')
    expect((await writeError('member', limited, limited.replace('>ok<', '>a  <')))?.status).toBe(403)
  })

  it('resaves unchanged legacy over-limit text', async () => {
    const legacy = wrap('<p data-od-id="m" data-od-role="body" data-od-max-length="1">viel zu lang</p>')
    expect(await writeError('member', legacy, legacy)).toBeNull()
  })

  it('enforces inherited token constraints on nested formatting', async () => {
    const colored = wrap(
      '<section data-od-id="s" data-od-role="body" data-od-allowed-colors="prowin-ci-blau"><p data-od-id="a" data-od-role="body">Hallo <span>.\n</span></p></section>'.replace(
        '.\n',
        '.',
      ),
    )
    const hex = colored.replace('<span>.', '<span style="color:#ff0000">.')
    expect((await writeError('member', colored, hex))?.status).toBe(403)
    const token = colored.replace('<span>.', '<span style="color:var(--prowin-ci-blau)">.')
    expect(await writeError('member', colored, token)).toBeNull()
  })

  it('accepts token colors but rejects hex, fallbacks and custom-property redefinitions', async () => {
    const field = wrap('<p data-od-id="a" data-od-role="body" data-od-allowed-colors="prowin-ci-blau">Hallo</p>')
    const token = field.replace('<p data-od-id', '<p style="color:var(--prowin-ci-blau)" data-od-id')
    expect(await writeError('member', field, token)).toBeNull()
    const hex = field.replace('<p data-od-id', '<p style="color:#2492d1" data-od-id')
    expect((await writeError('member', field, hex))?.status).toBe(403)
    const fallback = field.replace('<p data-od-id', '<p style="color:var(--prowin-ci-blau, red)" data-od-id')
    expect((await writeError('member', field, fallback))?.status).toBe(403)
    const redefined = field.replace('<p data-od-id', '<p style="--prowin-ci-blau:red" data-od-id')
    expect((await writeError('member', field, redefined))?.status).toBe(403)
  })

  it('allows safe font-size changes but rejects style overlays', async () => {
    const bigger = prev.replace('<p data-od-id="a"', '<p style="font-size:20px" data-od-id="a"')
    expect(await writeError('member', prev, bigger)).toBeNull()
    for (const style of [
      'position:absolute',
      'visibility:hidden',
      'float:left',
      'background-image:url(x.png)',
      'color:red !important',
      'color:/*x*/red',
      'color:\\72 ed',
    ]) {
      const next = prev.replace('<p data-od-id="a"', `<p style="${style}" data-od-id="a"`)
      expect((await writeError('member', prev, next))?.status, style).toBe(403)
    }
  })

  it('rejects unsafe elements, event attributes and nested metadata in unlocked fields', async () => {
    const linked = prev.replace('>Hallo<', '><a href="https://x">Hallo</a><')
    expect((await writeError('member', prev, linked))?.status).toBe(403)
    const scripted = prev.replace('>Hallo<', '><script>alert(1)</script>Hallo<')
    expect((await writeError('member', prev, scripted))?.status).toBe(403)
    const events = prev.replace('<p data-od-id="a"', '<p onclick="x()" data-od-id="a"')
    expect((await writeError('member', prev, events))?.status).toBe(403)
    const nested = prev.replace('>Hallo<', '><span data-od-id="neu">Hallo</span><')
    expect((await writeError('member', prev, nested))?.status).toBe(403)
  })

  it('permits image src/alt changes only on image fields', async () => {
    const image = wrap('<figure data-od-id="i" data-od-role="image"><img src="a.png" alt="A"></figure>')
    const swapped = image.replace('src="a.png" alt="A"', 'src="b.png" alt="B"')
    expect(await writeError('member', image, swapped)).toBeNull()
    const textImage = prev.replace('>Hallo<', '><img src="b.png" alt="B">Hallo<')
    expect((await writeError('member', prev, textImage))?.status).toBe(403)
  })

  it('accepts a DOM-reserialized editor-style save', async () => {
    const { Window } = await import('happy-dom')
    const window = new Window()
    window.document.body.innerHTML = prev
    const reserialized = window.document.body.innerHTML
    await window.close()
    expect(await writeError('member', prev, reserialized)).toBeNull()
  })
})

describe('templateGuard document wrappers', () => {
  const doc = (bodyInner: string, htmlAttrs = 'lang="en"', bodyAttrs = 'class="x"') =>
    `<!DOCTYPE html><html ${htmlAttrs}><head><title>T</title></head><body ${bodyAttrs}>${bodyInner}</body></html>`
  const docPrev = doc(wrap(`${UNLOCKED}${LOCKED}`))

  it('rejects html lang changes for members but allows creators', async () => {
    const next = docPrev.replace('<html lang="en">', '<html lang="fr">')
    expect((await writeError('member', docPrev, next))?.status).toBe(403)
    expect(await writeError('creator', docPrev, next)).toBeNull()
  })

  it('rejects body class and style changes for members', async () => {
    expect((await writeError('member', docPrev, docPrev.replace('<body class="x">', '<body class="y">')))?.status).toBe(
      403,
    )
    expect(
      (await writeError('member', docPrev, docPrev.replace('<body class="x">', '<body class="x" style="color:red">')))
        ?.status,
    ).toBe(403)
  })

  it('rejects head attribute changes for members', async () => {
    const next = docPrev.replace('<head>', '<head data-brand="v2">')
    expect((await writeError('member', docPrev, next))?.status).toBe(403)
  })

  it('rejects doctype name, publicId and systemId changes for members', async () => {
    const qualified = docPrev.replace(
      '<!DOCTYPE html>',
      '<!DOCTYPE html PUBLIC "-//Example//EN" "https://example.com/dtd">',
    )
    expect((await writeError('member', docPrev, qualified))?.status).toBe(403)
    const publicChanged = qualified.replace('-//Example//EN', '-//Other//EN')
    expect((await writeError('member', qualified, publicChanged))?.status).toBe(403)
    const systemChanged = qualified.replace('https://example.com/dtd', 'https://example.com/other')
    expect((await writeError('member', qualified, systemChanged))?.status).toBe(403)
    expect(await writeError('creator', docPrev, qualified)).toBeNull()
  })

  it('accepts identical full-document saves and unlocked text edits inside documents', async () => {
    expect(await writeError('member', docPrev, docPrev)).toBeNull()
    expect(await writeError('member', docPrev, docPrev.replace('>Hallo<', '>Hallo Welt<'))).toBeNull()
  })

  it('accepts a browser-built full-document reserialization', async () => {
    const { Window } = await import('happy-dom')
    const window = new Window()
    window.document.documentElement.setAttribute('lang', 'en')
    window.document.title = 'T'
    window.document.body.setAttribute('class', 'x')
    window.document.body.innerHTML = wrap(`${UNLOCKED}${LOCKED}`)
    const reserialized = `<!DOCTYPE html>${window.document.documentElement.outerHTML}`
    await window.close()
    expect(await writeError('member', docPrev, reserialized)).toBeNull()
  })
})

describe('templateGuard deletion', () => {
  it('forbids member deletion of template-bearing frames, allows creators and plain frames', async () => {
    const attempt = async (user: string, html: string) => {
      try {
        await withUserPermissions(user, () => assertTemplateDelete(canvas, html))
        return null
      } catch (error) {
        return error as GuardError
      }
    }
    expect((await attempt('member', prev))?.status).toBe(403)
    expect(await attempt('creator', prev)).toBeNull()
    expect(await attempt('member', '<div><p>Hallo</p></div>')).toBeNull()
  })
})

describe('templateGuard event handler and metadata value freeze (F1)', () => {
  const HANDLER = wrap('<p data-od-id="a" data-od-role="body">Hallo <span onclick="legacy()">Klick</span></p>')

  it('rejects changing an existing handler value for members but allows creators', async () => {
    const changed = HANDLER.replace('onclick="legacy()"', 'onclick="evil()"')
    expect((await writeError('member', HANDLER, changed))?.status).toBe(403)
    expect(await writeError('creator', HANDLER, changed)).toBeNull()
  })

  it('resaves unchanged legacy handlers with text edits and allows handler removal', async () => {
    expect(await writeError('member', HANDLER, HANDLER.replace('>Hallo <', '>Hallo Welt <'))).toBeNull()
    expect(await writeError('member', HANDLER, HANDLER.replace(' onclick="legacy()"', ''))).toBeNull()
  })

  it('freezes data-od-* value changes in editable interiors', async () => {
    const tagged = wrap('<p data-od-id="a" data-od-role="body">Hallo <span data-od-foo="a">X</span></p>')
    expect((await writeError('member', tagged, tagged.replace('data-od-foo="a"', 'data-od-foo="b"')))?.status).toBe(403)
    expect(await writeError('member', tagged, tagged.replace('>Hallo <', '>Hallo Welt <'))).toBeNull()
  })
})

describe('templateGuard constrained color removal (F2)', () => {
  const FROZEN =
    '<style>p{color:red}</style><p data-od-id="a" data-od-role="body" data-od-allowed-colors="prowin-ci-blau" style="color:var(--prowin-ci-blau)">Text</p>'
  const MIXED =
    '<style>p{color:red}</style><p data-od-id="a" data-od-role="body" data-od-allowed-colors="prowin-ci-blau" style="color:var(--prowin-ci-blau);font-size:20px">Text</p>'

  it('rejects dropping the whole style attribute to expose a frozen forbidden color', async () => {
    const dropped = FROZEN.replace(' style="color:var(--prowin-ci-blau)"', '')
    expect((await writeError('member', FROZEN, dropped))?.status).toBe(403)
    expect(await writeError('creator', FROZEN, dropped)).toBeNull()
  })

  it('rejects dropping only the constrained color property but allows typography-only removal', async () => {
    const droppedColor = MIXED.replace('color:var(--prowin-ci-blau);', '')
    expect((await writeError('member', MIXED, droppedColor))?.status).toBe(403)
    const droppedType = MIXED.replace(';font-size:20px', '')
    expect(await writeError('member', MIXED, droppedType)).toBeNull()
  })

  it('rejects unwrapping, replacing and removing a nested color-bearing wrapper', async () => {
    const nested = wrap(
      '<section data-od-id="s" data-od-role="body" data-od-allowed-colors="prowin-ci-blau"><p data-od-id="a" data-od-role="body">Rest <span style="color:var(--prowin-ci-blau)">Farbe</span></p></section>',
    )
    const unwrapped = nested.replace('<span style="color:var(--prowin-ci-blau)">Farbe</span>', 'Farbe')
    expect((await writeError('member', nested, unwrapped))?.status).toBe(403)
    const replaced = nested.replace('<span style="color:var(--prowin-ci-blau)">Farbe</span>', '<b>Farbe</b>')
    expect((await writeError('member', nested, replaced))?.status).toBe(403)
    const stripped = nested.replace('<span style="color:var(--prowin-ci-blau)">', '<span>')
    expect((await writeError('member', nested, stripped))?.status).toBe(403)
    const removed = nested.replace(' <span style="color:var(--prowin-ci-blau)">Farbe</span>', '')
    expect((await writeError('member', nested, removed))?.status).toBe(403)
    expect(await writeError('creator', nested, unwrapped)).toBeNull()
  })

  it('rejects dropping class/id attributes under a color constraint', async () => {
    const classed = FROZEN.replace('<p data-od-id', '<p class="frozen" id="x" data-od-id')
    expect((await writeError('member', classed, classed.replace(' class="frozen"', '')))?.status).toBe(403)
    expect((await writeError('member', classed, classed.replace(' id="x"', '')))?.status).toBe(403)
    expect(await writeError('creator', classed, classed.replace(' class="frozen"', ''))).toBeNull()
  })

  it.each([
    'background:var(--prowin-ci-blau)',
    'border:1px solid var(--prowin-ci-blau)',
    'outline:1px solid var(--prowin-ci-blau)',
  ])('preserves existing color-bearing shorthand %s under constraints', async (declaration) => {
    const style = `${declaration};font-size:20px`
    const wrapper = `<span style="${style}">Text</span>`
    const before = `<style>span{background:red;border:1px solid red;outline:1px solid red}</style><p data-od-id="a" data-od-allowed-colors="prowin-ci-blau">${wrapper}</p>`
    for (const after of [
      before.replace(` style="${style}"`, ''),
      before.replace(`${declaration};`, ''),
      before.replace(wrapper, 'Text'),
    ]) {
      expect((await writeError('member', before, after))?.status).toBe(403)
      expect(await writeError('creator', before, after)).toBeNull()
    }
    expect(await writeError('member', before, before.replace('font-size:20px', 'font-size:24px'))).toBeNull()
  })

  it('preserves legitimate edits: text, unconstrained removals and safe typography', async () => {
    expect(await writeError('member', FROZEN, FROZEN.replace('>Text<', '>Neuer Text<'))).toBeNull()
    const free = wrap('<p data-od-id="a" data-od-role="body" class="x" style="font-size:20px">Hallo</p>')
    expect(await writeError('member', free, free.replace(' style="font-size:20px"', ''))).toBeNull()
    expect(await writeError('member', free, free.replace(' class="x"', ''))).toBeNull()
  })

  it('allows decoration typography without smuggling an unapproved decoration color', async () => {
    const before = FROZEN.replace('>Text<', '><span style="text-decoration:underline">Text</span><')
    expect(
      (await writeError('member', before, before.replace('text-decoration:underline', 'text-decoration:underline red')))
        ?.status,
    ).toBe(403)
    expect(
      await writeError(
        'member',
        before,
        before.replace('text-decoration:underline', 'text-decoration:line-through dotted'),
      ),
    ).toBeNull()
    expect(
      await writeError('creator', before, before.replace('text-decoration:underline', 'text-decoration:underline red')),
    ).toBeNull()
  })
})

describe('templateGuard own-review regressions', () => {
  it.each(['script', 'style'])('does not remove a frozen %s through an editable wrapper', async (tag) => {
    const wrapper = `<span><em><${tag}>legacy</${tag}></em>Text</span>`
    const before = `<p data-od-id="edit">${wrapper}<b>Other</b></p>`
    for (const replacement of ['', 'Text', '<b>Text</b>']) {
      const after = before.replace(wrapper, replacement)
      expect((await writeError('member', before, after))?.status).toBe(403)
      expect(await writeError('creator', before, after)).toBeNull()
    }
    expect(await writeError('member', before, before.replace('>Other<', '>Updated<'))).toBeNull()
  })

  it.each([
    ['script', 'console.log("safe")', 'document.querySelector("[data-od-locked]").textContent="changed"'],
    ['style', '.locked{color:blue}', '.locked{color:red}'],
  ])('freezes existing %s descendants of an editable field', async (tag, original, injected) => {
    const element = `<${tag}>${original}</${tag}>`
    const before = `<div data-od-id="edit">${element}<span>Hallo</span></div>${LOCKED}`
    for (const after of [
      before.replace(original, injected),
      before.replace(element, '<span>Replacement</span>'),
      before.replace(element, ''),
    ]) {
      expect((await writeError('member', before, after))?.status).toBe(403)
      expect(await writeError('creator', before, after)).toBeNull()
    }
    expect(await writeError('member', before, before.replace('>Hallo<', '>Hallo Welt<'))).toBeNull()
  })

  it.each(['script', 'style'])('does not expose a %s field root as a code editor', async (tag) => {
    const before = `<${tag} data-od-id="code">original</${tag}>${LOCKED}`
    expect((await writeError('member', before, before.replace('original', 'changed')))?.status).toBe(403)
    expect(await writeError('member', before, before)).toBeNull()
    expect(await writeError('creator', before, before.replace('original', 'changed'))).toBeNull()
  })

  it.each([
    ['color:var(--prowin-ci-blau)', 'color:red!important;color:var(--prowin-ci-blau)'],
    ['color:var(--prowin-ci-blau)', 'COLOR:red!important;color:var(--prowin-ci-blau)'],
    ['font-size:20px', 'font-size:9000px!important;font-size:20px'],
  ])('rejects duplicate CSS declarations hiding priority: %s', async (style, injected) => {
    const before = `<p data-od-id="edit" data-od-allowed-colors="prowin-ci-blau" style="${style}">Text</p>`
    const after = before.replace(style, injected)
    expect((await writeError('member', before, after))?.status).toBe(403)
    expect(await writeError('creator', before, after)).toBeNull()
    // Unchanged legacy declarations stay resavable while their text is edited.
    expect(await writeError('member', after, after.replace('>Text<', '>Neuer Text<'))).toBeNull()
  })

  it('compares locked SVG attribute namespaces without href/xlink:href collisions', async () => {
    const before =
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image data-od-id="logo" data-od-locked href="/safe.png" xlink:href="/safe.png"/></svg>'
    const changed = before.replace(' href="/safe.png"', ' href="/changed.png"')
    expect((await writeError('member', before, changed))?.status).toBe(403)
    expect(await writeError('creator', before, changed)).toBeNull()

    const plainHref = before.replace(' xlink:href="/safe.png"', '')
    const namespacedHref = plainHref.replace(' href="/safe.png"', ' xlink:href="/safe.png"')
    expect((await writeError('member', plainHref, namespacedHref))?.status).toBe(403)
  })

  it('resaves and reorders distinct href/xlink:href values on a locked SVG', async () => {
    const before =
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image data-od-id="logo" data-od-locked href="/primary.png" xlink:href="/fallback.png"/></svg>'
    const reordered = before.replace(
      'href="/primary.png" xlink:href="/fallback.png"',
      'xlink:href="/fallback.png" href="/primary.png"',
    )
    expect(await writeError('member', before, before)).toBeNull()
    expect(await writeError('member', before, reordered)).toBeNull()
  })

  it('accepts the actual editor doctype when saving a stored fragment', async () => {
    const { Window } = await import('happy-dom')
    const window = new Window()
    try {
      window.document.write(prev)
      window.document.querySelector('[data-od-id="a"]')!.textContent = 'Hallo Welt'
      const serialized = '<!doctype html>\n' + window.document.documentElement.outerHTML
      expect(await writeError('member', prev, serialized)).toBeNull()
      expect((await writeError('member', prev, serialized.replace('<body>', '<body class="injected">')))?.status).toBe(
        403,
      )
    } finally {
      await window.close()
    }
  })

  it('retains existing doctype protection when allowing an additive standard doctype', async () => {
    const standard = `<!doctype html>${prev}`
    const custom = `<!doctype html PUBLIC "-//Example//EN" "https://example.com/dtd">${prev}`
    expect((await writeError('member', prev, custom))?.status).toBe(403)
    expect((await writeError('member', standard, prev))?.status).toBe(403)
    expect((await writeError('member', standard, custom))?.status).toBe(403)
  })
})
