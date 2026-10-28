import { rewriteFrameHtml, type HtmlTag } from '../../shared/frameBrandHtml.ts'
import { env } from '../env.ts'
import { BRAND_FONTS, BRAND_TOKENS } from './brandTokens.ts'

export function brandStyle(origin = env.BETTER_AUTH_URL): string {
  const base = new URL(origin).origin
  const fonts = BRAND_FONTS.map(
    (font) =>
      `@font-face{font-family:'${font.family}';font-style:normal;font-weight:${font.weight};font-display:swap;src:url('${base}/fonts/${font.file}') format('woff2');unicode-range:${font.range}}`,
  ).join('\n')
  const tokens = Object.entries(BRAND_TOKENS)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
  return `<style data-od-brand>${fonts}\n:root{${tokens}}</style>`
}

function decodeAttribute(value: string): string {
  return value.replace(/&(#x[\da-f]+|#\d+|amp|colon|sol);/gi, (entity, code: string) => {
    if (code.toLowerCase() === 'amp') return '&'
    if (code.toLowerCase() === 'colon') return ':'
    if (code.toLowerCase() === 'sol') return '/'
    const point = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10)
    return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity
  })
}

function externalUrl(value: string): URL | undefined {
  try {
    const url = new URL(decodeAttribute(value), env.BETTER_AUTH_URL)
    if (url.origin !== new URL(env.BETTER_AUTH_URL).origin && /^https?:$/.test(url.protocol)) return url
  } catch {
    // A malformed URL is unrelated content; request policy belongs to TASK-27.
  }
  return undefined
}

function fontProvider(value: string): boolean {
  const host = externalUrl(value)?.hostname ?? ''
  return /^(?:fonts\.(?:googleapis|gstatic)\.com|fonts\.bunny\.net|(?:use|p)\.typekit\.net|fonts\.cdnfonts\.com)$/i.test(
    host,
  )
}

function externalFontLink(tag: HtmlTag): boolean {
  const href = tag.attrs.get('href') ?? ''
  return fontProvider(href) || (tag.attrs.get('as')?.toLowerCase() === 'font' && !!externalUrl(href))
}

/** Remove provider imports only in CSS code, preserving comments and string literals. */
function cleanFontImports(css: string): string {
  let result = ''
  let at = 0
  while (at < css.length) {
    const start = at
    if (css.startsWith('/*', at)) {
      const end = css.indexOf('*/', at + 2)
      at = end < 0 ? css.length : end + 2
    } else if (css[at] === '"' || css[at] === "'") {
      const quote = css[at++]
      while (at < css.length) {
        if (css[at] === '\\') at += 2
        else if (css[at++] === quote) break
      }
    } else if (/^@import\b/i.test(css.slice(at))) {
      let quote = ''
      let depth = 0
      at += 7
      while (at < css.length) {
        const ch = css[at++]
        if (ch === '\\') at++
        else if (quote) {
          if (ch === quote) quote = ''
        } else if (ch === '/' && css[at] === '*') {
          const end = css.indexOf('*/', at + 1)
          at = end < 0 ? css.length : end + 2
        } else if (ch === '"' || ch === "'") quote = ch
        else if (ch === '(') depth++
        else if (ch === ')') depth--
        else if (ch === ';' && depth === 0) break
      }
      const statement = css.slice(start, at)
      const url = /^@import(?:\s|\/\*[\s\S]*?\*\/)*(?:url\((?:\s|\/\*[\s\S]*?\*\/)*)?["']?([^\s"')]+)/i.exec(
        statement,
      )?.[1]
      if (url && fontProvider(url)) continue
    } else at++
    result += css.slice(start, at)
  }
  return result
}

export { withoutBrandStyle } from '../../shared/frameBrandHtml.ts'

export function normalizeFrameHtml(html: string, origin = env.BETTER_AUTH_URL): string {
  const cleaned = rewriteFrameHtml(html, { omitLink: externalFontLink, transformStyle: cleanFontImports })
  return cleaned.html.slice(0, cleaned.insertAt) + brandStyle(origin) + cleaned.html.slice(cleaned.insertAt)
}
