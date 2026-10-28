import { withoutBrandStyle } from './frameBrandHtml.ts'

/** Server-generated brand CSS alone is still an empty frame in the editor. */
export function hasFrameContent(html: string): boolean {
  return withoutBrandStyle(html).trim().length > 0
}
