import { appendFileSync } from 'node:fs'

const { URL, Request } = globalThis

// Test-process boundary only: do not turn this into a production-wide host policy.
export function installAiEgress(fetch, journalPath) {
  return async (input, init) => {
    let url
    try {
      url = new URL(input instanceof Request ? input.url : input)
    } catch {
      // Invalid input must still leave evidence without echoing its contents.
    }
    const redirect = init?.redirect ?? (input instanceof Request ? input.redirect : 'follow')
    const allowed = url?.href === 'https://router.eu.requesty.ai/v1/chat/completions' && redirect === 'error'
    appendFileSync(
      journalPath,
      JSON.stringify({
        origin: url?.origin ?? '[invalid]',
        pathname: allowed ? url.pathname : '[blocked]',
        allowed,
      }) + '\n',
    )
    if (!allowed) throw new Error('AI egress rejected; see test journal')
    return fetch(input, init)
  }
}
