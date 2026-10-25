import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import type Anthropic from '@anthropic-ai/sdk'
import { env } from '../server/env.ts'
import { pickModel, serverTierInfo, ModelAuthError, ModelUnavailableError } from '../server/agentModel.ts'
import { retryModelTurn } from '../server/modelTurnRetry.ts'
import { requestyConfig, runChatCompletionsTurn } from '../server/chatCompletionsAgent.ts'
import { stubEnv, unstubAllEnvs } from './envStub.ts'

const accounts = vi.hoisted(() => ({ get: vi.fn(), preference: vi.fn() }))
vi.mock('../server/prowin/accounts.ts', () => ({ permissionIdentity: async () => ({ creator: true }) }))
vi.mock('../server/localAgentPreferences.ts', () => ({ getLocalAgentPreference: accounts.preference }))
vi.mock('../server/localAgentRuns.ts', () => ({ localAgentRuns: { online: () => false } }))
const EU_URL = 'https://router.eu.requesty.ai/v1/chat/completions'
const tool: Anthropic.Tool = {
  name: 'screenshot_frame',
  description: 'Inspect a frame',
  input_schema: { type: 'object', properties: { frameId: { type: 'string' } } },
}
const request = {
  system: [{ text: 'Design an event card', cache: true }, { text: 'Review the screenshot' }],
  tools: [tool],
  messages: [{ role: 'user', content: 'Inspect frame-1' }] as Anthropic.MessageParam[],
  maxTokens: 512,
}

beforeEach(() => {
  vi.stubEnv('DOOP_AGENT_PROVIDER', undefined)
  vi.stubEnv('DOOP_AGENT_MODEL', undefined)
  vi.stubEnv('REQUESTY_CHAT_URL', undefined)
  stubEnv('REQUESTY_API_KEY', 'requesty-test-key')
  accounts.preference.mockResolvedValue({ enabled: false, model: 'opus' })
  accounts.get.mockResolvedValue(null)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  unstubAllEnvs()
})

describe('Requesty server provider', () => {
  it('rejects redirects without forwarding prompts to their destination', async () => {
    let forwarded = 0
    const target = createServer((_req, res) => {
      forwarded++
      res.end(JSON.stringify({ choices: [{ message: { content: 'unexpected' } }] }))
    })
    const redirect = createServer((_req, res) => {
      res.writeHead(307, { Location: `http://127.0.0.1:${(target.address() as AddressInfo).port}` })
      res.end()
    })
    try {
      await new Promise<void>((resolve) => target.listen(0, '127.0.0.1', resolve))
      await new Promise<void>((resolve) => redirect.listen(0, '127.0.0.1', resolve))
      const config = requestyConfig('policy/prowin-layout-gen')!
      // Override only inside this test to exercise native Fetch redirect handling.
      config.url = `http://127.0.0.1:${(redirect.address() as AddressInfo).port}`
      await expect(
        runChatCompletionsTurn(config, { ...request, system: 'Synthetic canvas contents' }),
      ).rejects.toThrow()
      expect(forwarded).toBe(0)
    } finally {
      for (const server of [redirect, target]) {
        server.closeAllConnections()
        await new Promise<void>((resolve) => server.close(() => resolve()))
      }
    }
  })

  it('runs a tool/vision round-trip through the default EU policy, including a policy fallback response', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch')
    fetcher.mockResolvedValueOnce(
      Response.json({
        model: 'bedrock/claude-sonnet-5-5@eu-central-1',
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'call-shot',
                  type: 'function',
                  function: { name: 'screenshot_frame', arguments: '{"frameId":"frame-1"}' },
                },
              ],
            },
          },
        ],
      }),
    )
    const model = await pickModel('alice')
    expect(model).toMatchObject({ provider: 'requesty', label: 'Requesty EU (policy/prowin-layout-gen)' })
    expect(model?.userId).toBeUndefined()
    expect(serverTierInfo()).toEqual({ provider: 'requesty', ready: true })
    const first = await model!.run(request)
    expect(first).toEqual({
      content: [{ type: 'tool_use', id: 'call-shot', name: 'screenshot_frame', input: { frameId: 'frame-1' } }],
      stop_reason: 'tool_use',
    })
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe(EU_URL)
    expect(init?.redirect).toBe('error')
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer requesty-test-key' })
    expect(JSON.parse(init!.body as string)).toMatchObject({
      model: 'policy/prowin-layout-gen',
      max_tokens: 512,
      tool_choice: 'auto',
      messages: [
        { role: 'system', content: 'Design an event card\n\nReview the screenshot' },
        { role: 'user', content: 'Inspect frame-1' },
      ],
      tools: [{ type: 'function', function: { name: 'screenshot_frame', parameters: tool.input_schema } }],
    })
    fetcher.mockResolvedValueOnce(
      Response.json({
        model: 'azure/gpt-5.4@germanywestcentral',
        choices: [{ finish_reason: 'stop', message: { content: 'Frame reviewed' } }],
      }),
    )
    const result = await model!.run({
      ...request,
      messages: [
        ...request.messages,
        { role: 'assistant', content: first.content as Anthropic.ContentBlockParam[] },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'call-shot',
              content: [
                { type: 'text', text: 'Frame screenshot' },
                { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'synthetic-png' } },
              ],
            },
          ],
        },
      ],
    })
    expect(result).toEqual({ content: [{ type: 'text', text: 'Frame reviewed' }], stop_reason: 'end_turn' })
    const second = JSON.parse(fetcher.mock.calls[1]![1]!.body as string)
    expect(second.model).toBe('policy/prowin-layout-gen')
    expect(second.messages[3]).toMatchObject({ role: 'tool', tool_call_id: 'call-shot' })
    expect(second.messages[4].role).toBe('user')
    expect(second.messages[4].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/png;base64,synthetic-png' },
    })
    expect(fetcher.mock.calls.every(([target]) => target === EU_URL)).toBe(true)
  })

  it('uses the operator model override', async () => {
    stubEnv('DOOP_AGENT_MODEL', 'policy/test-eu-agent')
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }))
    await (await pickModel())!.run(request)
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).model).toBe('policy/test-eu-agent')
  })

  it('disables the server tier without a Requesty key, even when legacy provider keys exist', async () => {
    stubEnv('ANTHROPIC_API_KEY', 'legacy-key')
    stubEnv('AZURE_OPENAI_API_KEY', 'legacy-key')
    stubEnv('REQUESTY_API_KEY', '')
    const fetcher = vi.spyOn(globalThis, 'fetch')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    expect(await pickModel('alice')).toBeNull()
    expect(serverTierInfo()).toEqual({ provider: 'requesty', ready: false })
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('keeps the local preference ahead of the server and pauses when offline', async () => {
    expect(await pickModel('alice')).toMatchObject({ provider: 'requesty' })
    accounts.preference.mockResolvedValue({ enabled: true, model: 'opus' })
    expect(await pickModel('alice')).toBeNull()
  })

  it.each([401, 403, 404, 402, 429, 502])('surfaces HTTP %s without retrying or switching provider', async (status) => {
    const message =
      status === 404 ? 'model not found' : status === 402 ? 'Monthly spend limit exceeded' : 'Request failed'
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: { message } }, { status }))
    const model = (await pickModel())!
    const failure = await retryModelTurn(() => model.run(request), {
      isCanceled: () => false,
      onRetry: () => {},
    }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).toContain('Requesty EU')
    expect((failure as Error).message).not.toMatch(/reconnect|connected account/i)
    expect(failure).not.toBeInstanceOf(ModelAuthError)
    expect(failure).not.toBeInstanceOf(ModelUnavailableError)
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(fetcher.mock.calls[0]![0]).toBe(EU_URL)
  })

  it('keeps explicit Anthropic installations on their existing default model', async () => {
    stubEnv('DOOP_AGENT_PROVIDER', 'anthropic')
    stubEnv('ANTHROPIC_API_KEY', 'test-key')
    expect(await pickModel()).toMatchObject({ provider: 'anthropic', label: 'Doop (claude-opus-5)' })
  })

  it('rejects a global or private Requesty URL before any request can run', () => {
    expect(() => stubEnv('REQUESTY_CHAT_URL', 'https://router.requesty.ai/v1/chat/completions')).toThrow(
      /REQUESTY_CHAT_URL/,
    )
    expect(() => stubEnv('REQUESTY_CHAT_URL', 'http://127.0.0.1/private')).toThrow(/REQUESTY_CHAT_URL/)
    stubEnv('REQUESTY_CHAT_URL', EU_URL)
    expect(env.REQUESTY_CHAT_URL).toBe(EU_URL)
  })
})
