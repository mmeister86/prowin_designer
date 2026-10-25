import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import type { DesignDecision, Frame } from '../shared/types.ts'

/**
 * Q10 wiring: the resident (server agent) and the distiller must never send
 * original e-mail / phone / IBAN to the model. The resident is driven through
 * its real run loop with a scripted fake model (pickModel is the seam the
 * harness already uses to choose a provider); renderFrame / inspectFrame are
 * stubbed so the test can see exactly which HTML copy would be rendered.
 * Stored frames must always keep the originals.
 */

const mocks = vi.hoisted(() => ({
  pickModel: vi.fn(),
  renderFrame: vi.fn(),
  inspectFrame: vi.fn(),
  rendered: [] as string[],
  inspected: [] as string[],
}))

vi.mock('../server/db/persist.ts', () => ({
  saveCanvas: () => {},
  saveCanvasCopy: async () => {},
  saveMember: () => {},
  deleteMember: () => {},
  saveGuideline: () => {},
  deleteGuideline: () => {},
  saveGuidelineVersion: () => {},
  listGuidelineVersions: () => [],
  saveReference: () => {},
  deleteReference: () => {},
  saveDecision: () => {},
  saveProposal: () => {},
  savePageCopy: async () => {},
  saveFrame: () => {},
  saveFrameVersion: () => {},
  listFrameVersions: async () => [],
  getFrameVersion: async () => undefined,
  deleteCanvas: () => {},
  deleteFrame: () => {},
  saveTask: () => {},
  saveFeedback: () => {},
  saveComment: () => {},
  saveActivity: () => {},
  flush: async () => {},
  hydrate: async () => ({}),
  importLegacyJson: async () => null,
}))

vi.mock('../server/agentModel.ts', () => ({
  pickModel: mocks.pickModel,
  ModelAuthError: class extends Error {},
  ModelUnavailableError: class extends Error {},
}))

vi.mock('../server/screenshot.ts', () => ({
  renderFrame: mocks.renderFrame,
  inspectFrame: mocks.inspectFrame,
  findBrowserPath: () => null,
}))

import * as actions from '../server/actions.ts'
import { store } from '../server/store.ts'
import { onDecision } from '../server/distill.ts'
import '../server/resident.ts'

const EMAIL = 'max@example.de'
const PHONE = '+49 170 1234567'
const IBAN = 'DE89 3704 0044 0532 0130 00'
const REF_EMAIL = 'ref@example.de'
const REF_PHONE = '030 901820'

type Captured = { system: unknown; messages: unknown }
const tool = (id: string, name: string, input: Record<string, unknown>) => ({
  content: [{ type: 'tool_use', id, name, input }],
  stop_reason: 'tool_use',
})
const done = () => ({ content: [{ type: 'text', text: 'Erledigt.' }], stop_reason: 'end_turn' })

/** A scripted model: each entry answers one turn; every request is captured. */
function scriptedModel(steps: Array<(req: Captured) => unknown>, captured: Captured[]) {
  return {
    provider: 'claude-local',
    label: 'fake model',
    userId: 'alice',
    vision: true,
    run: async (req: Captured) => {
      const snapshot = JSON.parse(JSON.stringify(req)) as Captured
      captured.push(snapshot)
      const step = steps[captured.length - 1]
      return step ? step(snapshot) : done()
    },
  }
}

function freshCanvas() {
  const canvas = store.createCanvas('redact-wiring', undefined)
  actions.wire(
    () => {},
    () => {},
  )
  actions.hydrateLogs({
    tasks: new Map([[canvas.id, []]]),
    feedback: new Map([[canvas.id, []]]),
    comments: new Map([[canvas.id, []]]),
    activity: new Map([[canvas.id, []]]),
    decisions: new Map([[canvas.id, []]]),
    proposals: new Map([[canvas.id, []]]),
  })
  return canvas
}

function addFrame(canvasId: string, name: string, html: string): Frame {
  return store.createFrame(canvasId, { name, width: 800, height: 500, html }, 'alice')!
}

async function settle() {
  for (let i = 0; i < 5; i++) await new Promise<void>((resolve) => setImmediate(resolve))
}

beforeEach(() => {
  stubEnv('REQUESTY_API_KEY', '')
  stubEnv('ANTHROPIC_API_KEY', undefined)
  mocks.rendered.length = 0
  mocks.inspected.length = 0
  mocks.pickModel.mockReset()
  mocks.renderFrame.mockReset()
  mocks.renderFrame.mockImplementation(async (f: Frame) => {
    mocks.rendered.push(f.html)
    return Buffer.from(`screenshot of ${f.id}`)
  })
  mocks.inspectFrame.mockReset()
  mocks.inspectFrame.mockImplementation(async (f: Frame) => {
    mocks.inspected.push(f.html)
    return {
      document: { title: 'Kontakt', width: f.width, height: f.height, htmlChars: f.html.length },
      design: { colors: [], backgrounds: [], fonts: [], fontSizes: [], radii: [], shadows: [], cssVariables: {} },
      elements: [
        {
          selector: 'body > p',
          tag: 'p',
          text: f.html,
          rect: { x: 0, y: 0, width: 10, height: 10 },
          style: { color: '', background: '', font: '', fontSize: '', fontWeight: '' },
        },
      ],
    }
  })
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(async () => {
  await settle()
  vi.restoreAllMocks()
  unstubAllEnvs()
})

describe('resident redaction wiring', () => {
  it(
    '(a)+(b)+(d) sends only tokens/placeholders for frame HTML, vision, reference, kickoff and guidelines',
    { timeout: 20_000 },
    async () => {
      const canvas = freshCanvas()
      const frame = addFrame(
        canvas.id,
        'Kontakt',
        `<!doctype html><html><head><title>Kontakt</title></head><body><h1>Kontakt</h1><p>${EMAIL}</p><p>${PHONE}</p><p>${IBAN}</p></body></html>`,
      )
      const refFrame = addFrame(
        canvas.id,
        'Referenz',
        `<!doctype html><html><body><p>${REF_EMAIL}</p><p>${REF_PHONE}</p></body></html>`,
      )
      const ref = store.addReference(canvas.id, refFrame, 'alice')!
      store.setGuideline(canvas.id, 'kontakt', `Support: ${EMAIL}, Konto ${IBAN}`, 'alice')

      const captured: Captured[] = []
      mocks.pickModel.mockResolvedValue(
        scriptedModel(
          [
            () => ({
              content: [
                { type: 'tool_use', id: 't1', name: 'get_frame_html', input: { frame_id: frame.id } },
                { type: 'tool_use', id: 't2', name: 'inspect_frame', input: { frame_id: frame.id } },
                { type: 'tool_use', id: 't3', name: 'screenshot_frame', input: { frame_id: frame.id } },
                { type: 'tool_use', id: 't4', name: 'get_reference', input: { reference_id: ref.id } },
              ],
              stop_reason: 'tool_use',
            }),
            () =>
              tool('t5', 'edit_frame_html', {
                frame_id: frame.id,
                find: '<h1>Kontakt</h1>',
                replace: '<h1>Kontakt!</h1>',
              }),
            () => tool('t6', 'screenshot_frame', { frame_id: frame.id }),
            () => done(),
          ],
          captured,
        ),
      )

      const card = actions.addQueuedCard(
        canvas.id,
        `Kontaktseite pflegen: ${EMAIL}, ${PHONE}`,
        'alice',
        undefined,
        undefined,
        undefined,
      )!
      await vi.waitFor(
        () => expect(actions.getTasks(canvas.id).find((t) => t.id === card.id)?.endedAt).toBeTypeOf('number'),
        { timeout: 10_000 },
      )

      /* (d) kickoff: card text and guideline markdown carry placeholders only */
      const kickoff = JSON.stringify(captured[0]!.messages)
      expect(kickoff).not.toContain(EMAIL)
      expect(kickoff).not.toContain(PHONE)
      expect(kickoff).toContain('[E-Mail entfernt]')
      expect(kickoff).toContain('[Telefon entfernt]')
      const system = JSON.stringify(captured[0]!.system)
      expect(system).not.toContain(EMAIL)
      expect(system).not.toContain(IBAN)
      expect(system).toContain('[IBAN entfernt]')

      /* (a) tool results of the first turn: tokens instead of originals */
      const results = JSON.stringify(captured[1]!.messages)
      for (const pii of [EMAIL, PHONE, IBAN, REF_EMAIL, REF_PHONE]) expect(results).not.toContain(pii)
      expect(results).toContain('[[PII-1]]')

      /* (b) vision + inspect rendered from the redacted copy */
      expect(mocks.rendered.length).toBeGreaterThan(0)
      for (const html of [...mocks.rendered, ...mocks.inspected]) {
        for (const pii of [EMAIL, PHONE, IBAN, REF_EMAIL, REF_PHONE]) expect(html).not.toContain(pii)
        expect(html).toContain('[[PII-')
      }

      /* the stored frame keeps the originals (and got the agent's edit) */
      const stored = store.getFrame(frame.id)!
      expect(stored.html).toContain(EMAIL)
      expect(stored.html).toContain(IBAN)
      expect(stored.html).toContain('<h1>Kontakt!</h1>')
      expect(store.getFrame(refFrame.id)!.html).toContain(REF_EMAIL)
    },
  )

  it('(c) restores tokens back to originals in every frame-write tool', { timeout: 20_000 }, async () => {
    const canvas = freshCanvas()
    const frame = addFrame(
      canvas.id,
      'Kontakt B',
      `<!doctype html><html><head><title>Kontakt B</title></head><body><p class="mail">${EMAIL}</p><p class="tel">${PHONE}</p><p>Bitte melden, wir freuen uns auf deine Nachricht und antworten schnell.</p></body></html>`,
    )
    const setDoc = `<!doctype html><html><head><title>Kontakt B</title></head><body><p class="mail">[[PII-1]]</p><p class="tel">[[PII-2]]</p><p>Per set_frame_html geändert, bitte weiterhin bei uns melden, danke.</p></body></html>`
    const rewriteDoc = `<!doctype html><html><head><title>Kontakt B</title></head><body><p class="mail">[[PII-1]]</p><p class="tel">[[PII-2]]</p><p>Per Rewrite geändert, bitte weiterhin bei uns melden, danke.</p></body></html>`

    const captured: Captured[] = []
    const snapshots: Array<string | undefined> = []
    const model = scriptedModel(
      [
        () => tool('t1', 'get_frame_html', { frame_id: frame.id }),
        () =>
          tool('t2', 'edit_frame_html', {
            frame_id: frame.id,
            find: '<p class="mail">[[PII-1]]</p>',
            replace: '<p class="mail">[[PII-1]]!</p>',
          }),
        () => tool('t3', 'set_frame_html', { frame_id: frame.id, html: setDoc }),
        () => tool('t4', 'begin_frame_rewrite', { frame_id: frame.id }),
        () => tool('t5', 'append_frame_rewrite', { frame_id: frame.id, chunk: rewriteDoc }),
        () => tool('t6', 'commit_frame_rewrite', { frame_id: frame.id }),
        () =>
          tool('t7', 'create_frame', {
            name: 'Kopie',
            width: 800,
            height: 500,
            html: `<!doctype html><html><head><title>Kopie</title></head><body><p>[[PII-1]]</p><p>Neue Kopie mit Kontakt und genug Text zum Speichern hier.</p></body></html>`,
          }),
        (req) => {
          const createdId = JSON.stringify(req.messages).match(/created frame (\S+)/)?.[1]
          return {
            content: [
              { type: 'tool_use', id: 't8', name: 'screenshot_frame', input: { frame_id: frame.id } },
              { type: 'tool_use', id: 't9', name: 'screenshot_frame', input: { frame_id: createdId } },
            ],
            stop_reason: 'tool_use',
          }
        },
        () => done(),
      ],
      captured,
    )
    const innerRun = model.run
    model.run = async (req: Captured) => {
      snapshots.push(store.getFrame(frame.id)?.html)
      return innerRun(req)
    }
    mocks.pickModel.mockResolvedValue(model)

    const card = actions.addQueuedCard(canvas.id, 'Kontaktseite umbauen', 'alice', undefined, undefined, undefined)!
    await vi.waitFor(
      () => expect(actions.getTasks(canvas.id).find((t) => t.id === card.id)?.endedAt).toBeTypeOf('number'),
      { timeout: 10_000 },
    )

    /* edit_frame_html: find+replace were restored before touching the store */
    expect(snapshots[2]).toContain(`${EMAIL}!`)
    expect(snapshots[2]).not.toContain('[[PII-')
    /* set_frame_html restored the whole document */
    expect(snapshots[3]).toContain(EMAIL)
    expect(snapshots[3]).toContain(PHONE)
    expect(snapshots[3]).not.toContain('[[PII-')
    /* commit_frame_rewrite restored the draft */
    expect(snapshots[6]).toContain(EMAIL)
    expect(snapshots[6]).toContain(PHONE)
    expect(snapshots[6]).not.toContain('[[PII-')
    /* create_frame restored the new frame, which is also the final state */
    const created = store.getCanvas(canvas.id)!.frames.find((f) => f.name === 'Kopie')!
    expect(created.html).toContain(EMAIL)
    expect(created.html).not.toContain('[[PII-')
    expect(store.getFrame(frame.id)!.html).toContain(EMAIL)
  })

  it(
    '(d) redacts comment text with placeholders and the element snippet with a session token',
    { timeout: 20_000 },
    async () => {
      const canvas = freshCanvas()
      const frame = addFrame(
        canvas.id,
        'Kontakt C',
        `<!doctype html><html><body><p class="mail">${EMAIL}</p><p>Genug Text, damit das Dokument vollständig wirkt und bleibt.</p></body></html>`,
      )
      const captured: Captured[] = []
      mocks.pickModel.mockResolvedValue(scriptedModel([() => done()], captured))

      const comment = actions.addElementComment(
        frame.id,
        {
          selector: '.mail',
          snippet: `<p class="mail">${EMAIL}</p>`,
          text: `@doop Bitte ${PHONE} anrufen und an ${EMAIL} schreiben`,
        },
        'alice',
        undefined,
      )!
      await vi.waitFor(
        () => expect(actions.getComments(canvas.id).find((c) => c.id === comment.id)?.resolvedAt).toBeTypeOf('number'),
        {
          timeout: 10_000,
        },
      )

      const kickoff = JSON.stringify(captured[0]!.messages)
      expect(kickoff).not.toContain(EMAIL)
      expect(kickoff).not.toContain(PHONE)
      expect(kickoff).toContain('[Telefon entfernt]')
      expect(kickoff).toContain('[E-Mail entfernt]')
      /* snippet is frame HTML: session token, not the one-way placeholder */
      expect(kickoff).toContain('[[PII-1]]')
      expect(store.getFrame(frame.id)!.html).toContain(EMAIL)
    },
  )
})

describe('distiller redaction wiring', () => {
  it('(e) sends redacted decision texts in summarize and distill prompts', async () => {
    stubEnv('REQUESTY_API_KEY', 'requesty-test-key')
    stubEnv('DOOP_DISTILL_MODEL', undefined)
    const canvasId = 'redact-distill'
    const decision: DesignDecision = {
      id: 'd-redact',
      text: `Bitte immer ${EMAIL} und ${PHONE} im Footer zeigen`,
      source: 'chat',
      from: 'Alice',
      at: 1,
    }
    actions.hydrateLogs({
      tasks: new Map(),
      feedback: new Map(),
      comments: new Map(),
      activity: new Map(),
      decisions: new Map([[canvasId, [decision]]]),
      proposals: new Map([[canvasId, []]]),
    })
    vi.spyOn(store, 'getGuidelines').mockReturnValue([])

    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'Footer-Kontakt zeigen' } }] }))
      .mockResolvedValueOnce(
        Response.json({
          choices: [
            {
              finish_reason: 'tool_calls',
              message: {
                tool_calls: [
                  { id: 'r1', type: 'function', function: { name: 'distill_result', arguments: '{"has_rule":false}' } },
                ],
              },
            },
          ],
        }),
      )
    onDecision(canvasId, decision.id)
    await settle()

    expect(fetcher).toHaveBeenCalledTimes(2)
    for (const [, init] of fetcher.mock.calls) {
      const body = String(init!.body)
      expect(body).not.toContain(EMAIL)
      expect(body).not.toContain(PHONE)
    }
    expect(String(fetcher.mock.calls[0]![1]!.body)).toContain('[E-Mail entfernt]')
    expect(String(fetcher.mock.calls[0]![1]!.body)).toContain('[Telefon entfernt]')
    expect(decision.summary).toBe('Footer-Kontakt zeigen')
  })
})
