export type HtmlTag = { start: number; end: number; name: string; closing: boolean; attrs: Map<string, string> }

/** Read actual tags without reserializing HTML or interpreting tag-shaped script strings. */
function readTag(html: string, start: number): HtmlTag | undefined {
  const name = /^<(\/?)([a-z][\w:-]*)(?=[\s/>])/i.exec(html.slice(start))
  if (!name) return undefined
  let quote = ''
  let end = start + name[0].length
  for (; end < html.length; end++) {
    const ch = html[end]
    if (quote) {
      if (ch === quote) quote = ''
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === '>') break
  }
  if (end === html.length) return undefined
  const attrs = new Map<string, string>()
  const body = html.slice(start + name[0].length, end)
  for (const match of body.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    const key = match[1]!.toLowerCase()
    if (!attrs.has(key)) attrs.set(key, match[2] ?? match[3] ?? match[4] ?? '')
  }
  return { start, end: end + 1, name: name[2]!.toLowerCase(), closing: !!name[1], attrs }
}

const RAW_TEXT = new Set(['script', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'plaintext'])

export function rewriteFrameHtml(
  html: string,
  options: { omitLink?: (tag: HtmlTag) => boolean; transformStyle?: (css: string) => string } = {},
): { html: string; insertAt: number } {
  let result = ''
  let cursor = 0
  let insertAt: number | undefined
  let fallback = 0
  while (cursor < html.length) {
    const start = html.indexOf('<', cursor)
    if (start < 0) {
      result += html.slice(cursor)
      break
    }
    result += html.slice(cursor, start)
    if (html.startsWith('<!--', start)) {
      const end = html.indexOf('-->', start + 4)
      cursor = end < 0 ? html.length : end + 3
      result += html.slice(start, cursor)
      continue
    }
    if (html.startsWith('<![CDATA[', start)) {
      // SVG character data can contain literal tags; never normalize its text.
      const end = html.indexOf(']]>', start + 9)
      cursor = end < 0 ? html.length : end + 3
      result += html.slice(start, cursor)
      continue
    }
    const tag = readTag(html, start)
    if (!tag) {
      // Declarations are opaque, including quoted > or tag-shaped strings.
      const declaration = /^<![a-z]/i.test(html.slice(start))
      let end = start + 1
      if (declaration) {
        let quote = ''
        while (end < html.length) {
          const ch = html[end++]
          if (quote) {
            if (ch === quote) quote = ''
          } else if (ch === '"' || ch === "'") quote = ch
          else if (ch === '>') break
        }
      }
      result += html.slice(start, end)
      if (/^<!doctype\b/i.test(html.slice(start))) fallback = result.length
      cursor = end
      continue
    }
    cursor = tag.end
    if (!tag.closing && (tag.name === 'style' || RAW_TEXT.has(tag.name))) {
      const close = tag.name === 'plaintext' ? null : new RegExp(`</${tag.name}\\s*>`, 'gi')
      if (close) close.lastIndex = cursor
      const match = close?.exec(html)
      const contentEnd = match?.index ?? html.length
      const end = match ? match.index + match[0].length : html.length
      if (tag.name !== 'style' || !tag.attrs.has('data-od-brand')) {
        result += html.slice(start, tag.end)
        result +=
          options.transformStyle && tag.name === 'style'
            ? options.transformStyle(html.slice(tag.end, contentEnd))
            : html.slice(tag.end, contentEnd)
        result += html.slice(contentEnd, end)
      }
      cursor = end
      continue
    }
    if (!tag.closing && tag.name === 'link' && options.omitLink?.(tag)) continue
    result += html.slice(start, tag.end)
    if (!tag.closing && tag.name === 'html') fallback = result.length
    if (!tag.closing && tag.name === 'head' && insertAt === undefined) insertAt = result.length
  }
  return { html: result, insertAt: insertAt ?? fallback }
}

/** Strip only real brand style elements; comments and raw text remain untouched. */
export function withoutBrandStyle(html: string): string {
  return rewriteFrameHtml(html).html
}
