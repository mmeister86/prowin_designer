import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import type Anthropic from '@anthropic-ai/sdk'
import {
  _internal,
  IMAGE_OMITTED_NOTE,
  requestyConfig,
  runChatCompletionsTurn,
} from '../server/chatCompletionsAgent.ts'
import { IMAGE_NOTE, ModelAuthError, ModelUnavailableError } from '../server/openaiAgent.ts'

/**
 * The Chat Completions transport speaks the same Anthropic message shape the
 * agent loop is written in. These tests pin the mapping in both directions,
 * the degraded no-vision path (images become text notes), and the fixed
 * request/headers — without ever calling OpenRouter or Google.
 */

const { toMessages, toTools, fromCompletion } = _internal

const TOOL: Anthropic.Tool = {
  name: 'create_frame',
  description: 'Make a frame',
  input_schema: { type: 'object', properties: { name: { type: 'string' } } },
}

const PNG = 'iVBORw0KGgoAAAANSUhEUg=='

function toolResultWithImage(): Anthropic.MessageParam {
  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: 'toolu_1',
        content: [
          { type: 'text', text: 'screenshot of Hero' },
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } },
        ],
      },
    ],
  }
}

beforeEach(() => stubEnv('REQUESTY_API_KEY', 'requesty-test-key'))
afterEach(() => {
  vi.restoreAllMocks()
  unstubAllEnvs()
})

describe('toMessages', () => {
  it('puts the system prompt first and round-trips tool calls under one id', () => {
    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: 'make a hero' },
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'On it.' },
          { type: 'tool_use', id: 'call_9', name: 'create_frame', input: { name: 'Hero' } },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'call_9', content: 'created' }] },
    ]
    const out = toMessages('be a designer', messages, true)
    expect(out[0]).toEqual({ role: 'system', content: 'be a designer' })
    expect(out[1]).toEqual({ role: 'user', content: 'make a hero' })
    expect(out[2]).toMatchObject({
      role: 'assistant',
      content: 'On it.',
      tool_calls: [
        { id: 'call_9', type: 'function', function: { name: 'create_frame', arguments: '{"name":"Hero"}' } },
      ],
    })
    expect(out[3]).toEqual({ role: 'tool', tool_call_id: 'call_9', content: 'created' })
  })

  it('re-attaches tool-result images as a following user message', () => {
    const out = toMessages('sys', [toolResultWithImage()], true)
    const tool = out[1] as { role: string; content: string }
    expect(tool.role).toBe('tool')
    expect(tool.content).toContain('[image returned — see the attached image below]')
    const trailing = out[2] as { role: string; content: { type: string; image_url?: { url: string }; text?: string }[] }
    expect(trailing.role).toBe('user')
    expect(trailing.content[0]).toMatchObject({ type: 'image_url' })
    expect(trailing.content[0]!.image_url!.url).toContain(PNG)
    expect(trailing.content.at(-1)).toEqual({ type: 'text', text: IMAGE_NOTE })
  })

  it('replaces every image with a text note for a model without vision', () => {
    const out = toMessages(
      'sys',
      [
        toolResultWithImage(),
        {
          role: 'user',
          content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: PNG } }],
        },
      ],
      false,
    )
    expect(JSON.stringify(out)).not.toContain('image_url')
    const tool = out[1] as { content: string }
    expect(tool.content).toContain(IMAGE_OMITTED_NOTE)
    const user = out[2] as { content: { type: string; text?: string }[] }
    expect(user.content[0]).toEqual({ type: 'text', text: IMAGE_OMITTED_NOTE })
    /* and no trailing image message is emitted at all */
    expect(out).toHaveLength(3)
  })
})

describe('toTools', () => {
  it('nests the schema under function{}, the Chat Completions shape', () => {
    expect(toTools([TOOL])).toEqual([
      {
        type: 'function',
        function: { name: 'create_frame', description: 'Make a frame', parameters: TOOL.input_schema },
      },
    ])
  })
})

describe('fromCompletion', () => {
  it('maps text, tool calls and finish reasons', () => {
    const res = fromCompletion(
      {
        choices: [
          {
            finish_reason: 'tool_calls',
            message: {
              content: 'Adding it now.',
              tool_calls: [{ id: 'call_1', function: { name: 'create_frame', arguments: '{"name":"Hero"}' } }],
            },
          },
        ],
      },
      'OpenRouter',
    )
    expect(res.stop_reason).toBe('tool_use')
    expect(res.content[0]).toEqual({ type: 'text', text: 'Adding it now.' })
    expect(res.content[1]).toMatchObject({
      type: 'tool_use',
      id: 'call_1',
      name: 'create_frame',
      input: { name: 'Hero' },
    })
  })

  it('degrades malformed tool arguments to an empty call', () => {
    const res = fromCompletion(
      { choices: [{ message: { tool_calls: [{ id: 'c', function: { name: 'create_frame', arguments: '{oops' } }] } }] },
      'OpenRouter',
    )
    expect(res.content[0]).toMatchObject({ type: 'tool_use', input: {} })
  })

  it('reports a truncated turn as max_tokens', () => {
    const res = fromCompletion({ choices: [{ finish_reason: 'length', message: { content: 'partial…' } }] }, 'X')
    expect(res.stop_reason).toBe('max_tokens')
  })

  it('reports truncation even when the response contains a partial tool call', () => {
    const res = fromCompletion(
      {
        choices: [
          {
            finish_reason: 'length',
            message: {
              tool_calls: [
                { id: 'partial', function: { name: 'distill_result', arguments: '{"has_rule":true,"rule":"- Blue"}' } },
              ],
            },
          },
        ],
      },
      'Requesty EU',
    )
    expect(res.stop_reason).toBe('max_tokens')
  })

  it('reports a refusal', () => {
    const res = fromCompletion({ choices: [{ message: { content: 'no', refusal: 'cannot do that' } }] }, 'X')
    expect(res.stop_reason).toBe('refusal')
  })

  it('makes an empty response a visible failure', () => {
    expect(() => fromCompletion({ choices: [{ message: {} }] }, 'OpenRouter')).toThrow(/empty response/)
  })

  it('surfaces an in-body error object, classified like an HTTP error', () => {
    expect(() => fromCompletion({ error: { message: 'No endpoints found for this model' } }, 'OpenRouter')).toThrow(
      ModelUnavailableError,
    )
    expect(() => fromCompletion({ error: { message: 'internal blip' } }, 'OpenRouter')).toThrow(/internal blip/)
  })
})

describe('the request', () => {
  const req = {
    system: 'sys',
    tools: [TOOL],
    messages: [{ role: 'user' as const, content: 'hi' }],
    maxTokens: 16000,
  }

  it.each(['', ' \n '])('omits an empty system prompt from Requesty requests (%j)', async (system) => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ choices: [{ message: { content: 'ok' } }] }))
    await runChatCompletionsTurn(requestyConfig('policy/prowin-text-gen')!, { ...req, system, tools: [] })
    const body = JSON.parse(String(fetchSpy.mock.calls[0]![1]!.body))
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
  })

  it('sends the fixed Requesty EU URL with server auth', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), { status: 200 }))
    await runChatCompletionsTurn(requestyConfig('policy/prowin-layout-gen')!, req)
    const [url, init] = fetchSpy.mock.calls[0]!
    expect(String(url)).toBe('https://router.eu.requesty.ai/v1/chat/completions')
    const headers = init!.headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer requesty-test-key')
    const body = JSON.parse(String(init!.body)) as Record<string, unknown>
    expect(body.model).toBe('policy/prowin-layout-gen')
    expect(body.max_tokens).toBe(16000)
    expect(body.tool_choice).toBe('auto')
  })

  it('classifies a 401 as a dead credential and a missing model as unavailable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('nope', { status: 401 }))
    await expect(runChatCompletionsTurn(requestyConfig('policy/prowin-layout-gen')!, req)).rejects.toThrow(
      ModelAuthError,
    )
    vi.restoreAllMocks()
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('{"error":{"message":"kimi-k9 is not a valid model ID"}}', { status: 400 }),
    )
    await expect(runChatCompletionsTurn(requestyConfig('policy/missing')!, req)).rejects.toThrow(ModelUnavailableError)
  })
})
