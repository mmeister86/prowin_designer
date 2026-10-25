import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { env } from '../server/env.ts'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import * as actions from '../server/actions.ts'
import { store } from '../server/store.ts'
import { maybeDistill, onDecision } from '../server/distill.ts'
import type { DesignDecision } from '../shared/types.ts'

vi.mock('../server/db/persist.ts', () => ({ saveDecision: () => {}, saveProposal: () => {} }))
vi.mock('../server/resident.ts', () => ({ onFeedback: () => {} }))

const EU_URL = 'https://router.eu.requesty.ai/v1/chat/completions'
const canvas = 'requesty-memory'
let decision: DesignDecision

function toolResponse(input: unknown, name = 'distill_result') {
  return Response.json({
    choices: [
      {
        finish_reason: 'tool_calls',
        message: {
          tool_calls: [{ id: 'result-1', type: 'function', function: { name, arguments: JSON.stringify(input) } }],
        },
      },
    ],
  })
}

// Drain the background promise chain without adding a production-only test API.
async function settle() {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  stubEnv('REQUESTY_API_KEY', 'requesty-test-key')
  stubEnv('ANTHROPIC_API_KEY', undefined)
  stubEnv('DOOP_DISTILL_MODEL', undefined)
  decision = { id: 'd1', text: 'Always use blue accents', source: 'chat', from: 'Alice', at: 1 }
  actions.hydrateLogs({
    tasks: new Map(),
    feedback: new Map(),
    comments: new Map(),
    activity: new Map(),
    decisions: new Map([[canvas, [decision]]]),
    proposals: new Map([[canvas, []]]),
  })
  actions.wire(
    () => {},
    () => {},
  )
  vi.spyOn(store, 'getGuidelines').mockReturnValue([])
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  await settle()
  vi.restoreAllMocks()
  unstubAllEnvs()
})

describe('Requesty memory distiller', () => {
  it('summarizes and proposes through the EU text policy, leaving human approval pending', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: '“Prefer blue accents.”' } }] }))
      .mockResolvedValueOnce(toolResponse({ has_rule: true, guide_name: 'Brand Notes', rule: '- Use blue accents' }))
    onDecision(canvas, decision.id)
    await settle()
    expect(decision.summary).toBe('Prefer blue accents')
    expect(actions.getProposals(canvas)).toMatchObject([
      { status: 'pending', guideName: 'brand-notes', rule: '- Use blue accents', basedOn: ['d1'] },
    ])
    expect(decision.distilledAt).toEqual(expect.any(Number))
    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [url, init] of fetcher.mock.calls) {
      expect(url).toBe(EU_URL)
      expect(init).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer requesty-test-key' } })
      expect(JSON.parse(init!.body as string).model).toBe('policy/prowin-text-gen')
    }
    const request = JSON.parse(fetcher.mock.calls[1]![1]!.body as string)
    expect(request.tool_choice).toEqual({ type: 'function', function: { name: 'distill_result' } })
    expect(request.tools[0].function.name).toBe('distill_result')
    expect(request.messages[0].role).toBe('user')
    expect(request.messages[0].content).toContain('Prefer blue accents')
  })

  it('honors the text policy override', async () => {
    stubEnv('DOOP_DISTILL_MODEL', 'policy/custom-text')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(toolResponse({ has_rule: false }))
    maybeDistill(canvas)
    await settle()
    expect(JSON.parse(fetcher.mock.calls[0]![1]!.body as string).model).toBe('policy/custom-text')
  })

  it('does no work without a Requesty key even when an Anthropic key exists', async () => {
    stubEnv('REQUESTY_API_KEY', '')
    stubEnv('ANTHROPIC_API_KEY', 'legacy-test-key')
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network'))
    onDecision(canvas, decision.id)
    maybeDistill(canvas)
    await settle()
    expect(fetcher).not.toHaveBeenCalled()
    expect(decision.summary).toBeUndefined()
    expect(decision.distilledAt).toBeUndefined()
    expect(actions.getProposals(canvas)).toEqual([])
  })

  it.each([
    [false, { has_rule: false }, 'distill_result'],
    [true, { has_rule: true, rule: '- Use blue accents' }, 'wrong_tool'],
    [true, { has_rule: true, rule: 42 }, 'distill_result'],
    [true, { has_rule: 'false', rule: '- Use blue accents' }, 'distill_result'],
    [true, { has_rule: true, rule: '- Blue', guide_name: 42 }, 'distill_result'],
    [true, { has_rule: true, rule: '- Blue', guide_title: null }, 'distill_result'],
    [true, { has_rule: true, rule: '- Blue', rationale: ['Blue'] }, 'distill_result'],
  ])('keeps evidence when no valid rule is returned (invalid=%s, input=%j)', async (_invalid, input, name) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(toolResponse(input, name))
    maybeDistill(canvas)
    await settle()
    expect(decision.distilledAt).toBeUndefined()
    expect(actions.getProposals(canvas)).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it.each(['refusal', 'length', 'malformed'])('keeps evidence for %s output', async (reason) => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: reason === 'length' ? 'length' : 'stop',
            message:
              reason === 'refusal'
                ? { refusal: 'declined', content: null }
                : {
                    tool_calls: [
                      {
                        id: 'bad',
                        function: {
                          name: 'distill_result',
                          arguments: reason === 'malformed' ? '{broken' : '{"has_rule":true,"rule":"- Blue"}',
                        },
                      },
                    ],
                  },
          },
        ],
      }),
    )
    maybeDistill(canvas)
    await settle()
    expect(decision.distilledAt).toBeUndefined()
    expect(actions.getProposals(canvas)).toEqual([])
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('does not duplicate concurrent runs or pile up pending proposals', async () => {
    const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(toolResponse({ has_rule: true, rule: '- Blue' }))
    maybeDistill(canvas)
    maybeDistill(canvas)
    await settle()
    decision.distilledAt = undefined
    maybeDistill(canvas)
    await settle()
    expect(fetcher).toHaveBeenCalledTimes(1)
    expect(actions.getProposals(canvas)).toHaveLength(1)
  })

  it('does not save a truncated summary even when text is present', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(
        Response.json({ choices: [{ finish_reason: 'length', message: { content: 'Prefer blue' } }] }),
      )
      .mockResolvedValueOnce(toolResponse({ has_rule: false }))
    onDecision(canvas, decision.id)
    await settle()
    expect(decision.summary).toBeUndefined()
    expect(decision.distilledAt).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it.each([402, 429, 502])('keeps evidence on HTTP %s and permits a later manual retry', async (status) => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ error: { message: 'Request failed' } }, { status }))
      .mockResolvedValueOnce(toolResponse({ has_rule: true, rule: '- Blue' }))
    maybeDistill(canvas)
    await settle()
    expect(decision.distilledAt).toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
    maybeDistill(canvas)
    await settle()
    expect(actions.getProposals(canvas)).toHaveLength(1)
    expect(fetcher.mock.calls.every(([url]) => url === EU_URL)).toBe(true)
  })

  it('defaults to the Requesty text policy independently of the agent provider', () => {
    stubEnv('DOOP_AGENT_PROVIDER', 'anthropic')
    expect(env.DOOP_DISTILL_MODEL).toBe('policy/prowin-text-gen')
  })
})
