import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { capture, captureThrottled } from '../server/analytics.ts'
import { installAiEgress } from './fixtures/ai-egress.mjs'
import { createEgressDirectory } from './egressJournal.ts'

const endpoint = 'https://router.eu.requesty.ai/v1/chat/completions'
let directory: string
let journal: string

beforeEach(() => {
  directory = createEgressDirectory()
  journal = join(directory, 'requests.jsonl')
})

afterEach(() => {
  vi.unstubAllGlobals()
  rmSync(directory, { recursive: true, force: true })
})

it.each([endpoint, new URL(endpoint), new Request(endpoint, { redirect: 'error' })])(
  'journals the exact EU endpoint before responding for %s',
  async (input) => {
    const transport = vi.fn<typeof fetch>(async () => {
      expect(JSON.parse(readFileSync(journal, 'utf8'))).toEqual({
        origin: 'https://router.eu.requesty.ai',
        pathname: '/v1/chat/completions',
        allowed: true,
      })
      return Response.json({ ok: true })
    })
    const guarded = installAiEgress(transport, journal)
    expect(await (await guarded(input, { redirect: 'error' })).json()).toEqual({ ok: true })
    expect(transport).toHaveBeenCalledWith(input, { redirect: 'error' })
  },
)

it.each([
  'https://router.requesty.ai/v1/chat/completions',
  'https://router.eu.requesty.ai.attacker.test/v1/chat/completions',
  'http://router.eu.requesty.ai/v1/chat/completions',
  'https://router.eu.requesty.ai/v1/responses',
  'https://router.eu.requesty.ai:444/v1/chat/completions',
  endpoint + '?api_key=query-secret',
  endpoint + '#fragment',
  'https://userinfo:password@router.eu.requesty.ai/v1/chat/completions',
  'https://api.anthropic.com/v1/messages',
  'https://api.openai.com/v1/responses',
  'https://generativelanguage.googleapis.com/v1beta/models',
  'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations',
  'https://synthetic.openai.azure.com/openai/deployments/model',
  'https://eu.i.posthog.com/capture',
  'https://us.i.posthog.com/capture',
  'https://api.stripe.com/v1/customers',
  'https://api.magnific.ai/v1/images',
  'https://api.freepik.com/v1/ai/text-to-image',
  'not-a-url',
])('blocks and journals %s without contacting the transport', async (input) => {
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }))
  await expect(installAiEgress(transport, journal)(input, { redirect: 'error' })).rejects.toThrow('AI egress rejected')
  expect(transport).not.toHaveBeenCalled()
  expect(JSON.parse(readFileSync(journal, 'utf8'))).toMatchObject({ allowed: false })
})

it.each([undefined, 'follow', 'manual'] as const)(
  'rejects redirect mode %s even on the EU endpoint',
  async (redirect) => {
    const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }))
    await expect(installAiEgress(transport, journal)(endpoint, { redirect })).rejects.toThrow('AI egress rejected')
    expect(transport).not.toHaveBeenCalled()
  },
)

it('retains a caught violation without logging credentials, queries, bodies or headers', async () => {
  const guarded = installAiEgress(vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true })), journal)
  const error = await guarded('https://user-secret:password-secret@api.openai.com/body-secret?key=query-secret', {
    method: 'POST',
    redirect: 'error',
    headers: { Authorization: 'Bearer header-secret' },
    body: 'message-secret',
  }).catch((caught: unknown) => caught)
  const log = readFileSync(journal, 'utf8')
  expect(JSON.parse(log)).toEqual({ origin: 'https://api.openai.com', pathname: '[blocked]', allowed: false })
  for (const secret of [
    'user-secret',
    'password-secret',
    'body-secret',
    'query-secret',
    'header-secret',
    'message-secret',
  ]) {
    expect(log).not.toContain(secret)
    expect(String(error)).not.toContain(secret)
  }
})

it('keeps server analytics inert', () => {
  const network = vi.fn<typeof fetch>()
  vi.stubGlobal('fetch', network)
  capture('synthetic-user', 'synthetic-event', { text: 'synthetic-content' })
  captureThrottled('synthetic-user', 'synthetic-event')
  expect(network).not.toHaveBeenCalled()
})
