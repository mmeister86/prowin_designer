/* Expected-document identity for advisory safe-zone measurement. The parent
   posts HTML to the frame through a throttle (and withholds it while editing
   or while a save settles), so the store's frame.html can run ahead of the
   document the runtime actually rendered. An exact per-posting token — never
   a hash — tells the desired HTML apart from the last rendered one: the
   poster attaches it to `doop:html`, the runtime echoes it on
   `doop:frame-updated` and `doop:safe-zones-result`, and the measuring hook
   trusts only replies stamped with the currently desired token. Same-document
   layout/resource notifications carry the old token, so they can never
   confirm a pending different HTML. */
const tokens = new Map<string, { html: string; token: number }>()
let nextToken = 0

export function safeZoneDocumentToken(frameId: string, html: string): number {
  const entry = tokens.get(frameId)
  if (entry && entry.html === html) return entry.token
  nextToken += 1
  tokens.set(frameId, { html, token: nextToken })
  return nextToken
}
