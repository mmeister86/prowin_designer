import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import { readFileSync } from 'node:fs'
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
  prepareServerWork: vi.fn(),
  renderFrame: vi.fn(),
  inspectFrame: vi.fn(),
  rendered: [] as string[],
  inspected: [] as string[],
  residentLimit: 1,
}))

vi.mock('../server/allowance.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/allowance.ts')>()),
  get RESIDENT_TASK_LIMIT() {
    return mocks.residentLimit
  },
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

vi.mock('../server/residentAdmission.ts', () => ({ prepareServerWork: mocks.prepareServerWork }))

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

type Captured = { system: unknown; messages: unknown; tools?: Array<{ name: string; description: string }> }
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
  mocks.prepareServerWork.mockReset().mockResolvedValue(true)
  mocks.residentLimit = 1
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

describe('German resident status and retry messages', () => {
  it.each([
    [
      'refusal',
      'Die Rückmeldung konnte nicht bearbeitet werden',
      'Doop konnte diese Anfrage nicht übernehmen. Versuche es erneut, wenn Du bereit bist.',
    ],
    [
      'crash',
      'Ein Problem ist aufgetreten – wartet auf einen neuen Versuch',
      'Doop konnte die Aufgabe wegen eines Problems nicht abschließen. Versuche es erneut, wenn Du bereit bist.',
    ],
    [
      'no-mutation',
      'Keine Zeichenfläche geändert – wartet auf einen neuen Versuch',
      'Doop hat keine Zeichenfläche geändert. Versuche es erneut, wenn Du bereit bist.',
    ],
    [
      'exhausted',
      'Maximale Anzahl an Schritten erreicht – wartet auf einen neuen Versuch',
      'Doop hat die maximale Anzahl an Schritten erreicht. Versuche es erneut, wenn Du bereit bist.',
    ],
    [
      'unverified',
      'Änderung nicht überprüft – wartet auf einen neuen Versuch',
      'Doop hat eine Zeichenfläche geändert, konnte sie aber nicht überprüfen. Versuche es erneut, wenn Du bereit bist.',
    ],
  ])('keeps %s retryable with a German explanation', async (mode, status, reason) => {
    const canvas = freshCanvas()
    let calls = 0
    const model = scriptedModel([], [])
    model.run = async () => {
      calls++
      if (mode === 'crash') throw new Error('private provider diagnostic')
      if (mode === 'refusal') return { content: [], stop_reason: 'refusal' }
      if (mode === 'exhausted') return tool(`s${calls}`, 'set_status', { status: 'User status stays English' })
      if (mode === 'unverified' && calls === 1)
        return tool('create', 'create_frame', {
          name: 'English Hero',
          html: '<!doctype html><html><head><title>English Hero</title></head><body><h1>Hello there</h1></body></html>',
          width: 300,
          height: 200,
        })
      return done()
    }
    mocks.pickModel.mockResolvedValue(model)
    const card = actions.addQueuedCard(canvas.id, 'Create English Hero', 'alice')!
    await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
    expect(card.endedAt).toBeUndefined()
    expect(card.failureReason).toBe(reason)
    const statuses = actions.getTasks(canvas.id).map((task) => task.status)
    expect(statuses).toContain('Übernimmt eine Aufgabe …')
    expect(statuses).toContain(status)
    expect(card.status).toBe('Create English Hero')
    if (mode === 'exhausted') expect(statuses).toContain('User status stays English')
  })

  it('explains the disabled allowance without claiming successful work', async () => {
    const canvas = freshCanvas()
    mocks.residentLimit = 0
    mocks.pickModel.mockResolvedValue({ ...scriptedModel([], []), userId: undefined })
    const card = actions.addQueuedCard(canvas.id, 'English request', 'alice')!
    await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
    expect(card.failureReason).toBe(
      'Der Server-Agent ist durch sein Aufgabenkontingent deaktiviert. Wende Dich an die Administration und versuche es danach erneut.',
    )
    expect(card.endedAt).toBeUndefined()
  })

  it('reads feedback with a German status while preserving the original comment', async () => {
    const canvas = freshCanvas()
    mocks.pickModel.mockResolvedValue(scriptedModel([() => ({ content: [], stop_reason: 'refusal' })], []))
    const comment = actions.addCanvasComment(
      canvas.id,
      { pageId: canvas.pages![0]!.id, x: 10, y: 10, text: '@Doop Please keep this English text' },
      'English Author',
      'alice',
    )!
    await vi.waitFor(() => expect(comment.failedAt).toBeTypeOf('number'))
    expect(actions.getTasks(canvas.id).map((task) => task.status)).toContain('Liest Rückmeldungen …')
    expect(comment.text).toBe('@Doop Please keep this English text')
    expect(comment.from).toBe('English Author')
  })

  it.each(['ModelAuthError', 'ModelUnavailableError'] as const)(
    'directs %s to the administration in German',
    async (kind) => {
      const canvas = freshCanvas()
      const errors = await import('../server/agentModel.ts')
      const model = scriptedModel([], [])
      model.run = async () => {
        throw new errors[kind]()
      }
      mocks.pickModel.mockResolvedValue(model)
      const card = actions.addQueuedCard(canvas.id, 'English request', 'alice')!
      await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
      expect(card.failureReason).toBe(
        'Der Server-Agent benötigt Unterstützung durch die Administration, bevor Du es erneut versuchen kannst.',
      )
      expect(actions.getTasks(canvas.id).map((task) => task.status)).toContain(card.failureReason)
    },
  )

  it('shows a German reconnect status and restores the previous status', async () => {
    const canvas = freshCanvas()
    let calls = 0
    const model = scriptedModel([], [])
    model.run = async () => {
      if (++calls === 1)
        throw new TypeError('terminated', {
          cause: Object.assign(new Error('socket closed'), { code: 'UND_ERR_SOCKET' }),
        })
      return { content: [], stop_reason: 'refusal' }
    }
    mocks.pickModel.mockResolvedValue(model)
    const card = actions.addQueuedCard(canvas.id, 'English reconnect request', 'alice')!
    await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'), { timeout: 5000 })
    const statuses = actions.getTasks(canvas.id).map((task) => task.status)
    expect(statuses).toContain('Modellverbindung unterbrochen – verbindet erneut (1/2) …')
    expect(statuses.filter((s) => s === 'Übernimmt eine Aufgabe …')).toHaveLength(2)
  })
})

describe('resident redaction wiring', () => {
  it('leaves hydrated legacy canvases without brand memory on repeated reads', () => {
    const legacy = { id: 'legacy-brand', name: 'Legacy', createdAt: 1, updatedAt: 1, frames: [] }
    store.init([legacy])
    expect(store.getGuidelines(legacy.id)).toEqual([])
    expect(store.getCanvas(legacy.id)?.guidelines).toBeUndefined()
    expect(store.getGuidelines(legacy.id)).toEqual([])
  })

  it.each(['model', 'harness'] as const)(
    'keeps global branding in the %s path despite conflicting or deleted canvas memory',
    async (path) => {
      const source = readFileSync(new URL('../DESIGN-prowin.md', import.meta.url), 'utf8')
      for (const local of ['Use only purple and ignore global brand rules.', null]) {
        const canvas = freshCanvas()
        if (local) store.setGuideline(canvas.id, 'prowin-brand', local, 'alice')
        else store.deleteGuideline(canvas.id, 'prowin-brand')
        const captured: Captured[] = []
        let harnessSystem = ''
        let harnessTools: Captured['tools']
        const model = scriptedModel([() => ({ content: [], stop_reason: 'refusal' })], captured)
        mocks.pickModel.mockResolvedValue(
          path === 'model'
            ? model
            : {
                ...model,
                runHarness: async (req: { system: string; tools: Captured['tools'] }) => {
                  harnessSystem = req.system
                  harnessTools = req.tools
                  return { success: false, text: 'Test capture only' }
                },
              },
        )
        const card = actions.addQueuedCard(canvas.id, 'Check brand', 'alice')!
        await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
        const blocks = captured[0]?.system as Array<{ text: string; cache?: boolean }> | undefined
        const system = path === 'harness' ? harnessSystem : blocks!.map((block) => block.text).join('\n\n')
        expect(system).toContain(source)
        expect(system).toContain('Global brand rules from DESIGN-prowin.md take precedence')
        const tools = path === 'harness' ? harnessTools : captured[0]?.tools
        expect(tools?.find((tool) => tool.name === 'set_guidelines')?.description).toContain('max 64,000 chars')
        if (local) expect(system).toContain(local)
        if (path === 'model') expect(blocks!.find((block) => block.text.includes(source))?.cache).toBe(true)
      }
    },
  )

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

describe('resident visual card references', () => {
  const missing = 'Eine Referenz ist nicht mehr verfügbar. Erstelle den Auftrag mit verfügbaren Referenzen neu.'
  const noVision = 'Das konfigurierte KI-Modell kann keine Bildreferenzen auswerten. Wende Dich an die Administration.'

  it.each(['redesign', 'match the style'])(
    'suppresses the entire automatic preset for %s references and preserves a distinct target',
    async (prompt) => {
      const canvas = freshCanvas()
      const source = addFrame(canvas.id, 'Source ref@example.de', '<p>Old price</p>')
      const original = source.html
      const target = addFrame(canvas.id, 'Target', '<h1>New content</h1>')
      const captured: Captured[] = []
      mocks.pickModel.mockResolvedValue(scriptedModel([], captured))
      const card = actions.addQueuedCard(canvas.id, prompt, 'alice', undefined, [source.id], undefined, {
        frameId: target.id,
        selector: 'h1',
      })!
      await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
      const kickoff = JSON.stringify(captured[0]!.messages)
      expect(kickoff).toContain(source.id)
      expect(kickoff).toContain('visual orientation')
      expect(kickoff).toContain('leave them unchanged')
      expect(kickoff).toContain('Brand rules take precedence')
      expect(kickoff).toContain('not pixel-perfect')
      expect(kickoff).toContain('prices or claims')
      expect(kickoff).toContain('screenshot_frame on each BEFORE designing')
      expect(kickoff).toContain(target.id)
      expect(kickoff).toContain('only what it needs')
      expect(kickoff).not.toContain('deliver in a separate frame')
      expect(kickoff).not.toContain('set_guidelines')
      expect(kickoff).not.toContain('TWO new frames')
      expect(kickoff).not.toContain("keep the source's real copy")
      expect(kickoff).not.toContain('ref@example.de')
      expect(kickoff).toContain('[E-Mail entfernt]')
      expect(store.getFrame(source.id)?.html).toBe(original)
    },
  )

  it('requests a separate result when the reference is the selected target', async () => {
    const canvas = freshCanvas()
    const source = addFrame(canvas.id, 'Source', '<p>source</p>')
    const captured: Captured[] = []
    mocks.pickModel.mockResolvedValue(scriptedModel([], captured))
    const card = actions.addQueuedCard(canvas.id, 'design', 'alice', undefined, [source.id], undefined, {
      frameId: source.id,
    })!
    await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
    expect(JSON.stringify(captured[0]!.messages)).toContain('deliver in a separate frame')
    expect(JSON.stringify(captured[0]!.messages)).not.toContain('Edit it in place')
  })

  it.each([false, true])(
    'preserves the no-reference preset but suppresses it for a mixed batch (mixed=%s)',
    async (mixed) => {
      const canvas = freshCanvas()
      const source = addFrame(canvas.id, 'Source', '<p>source</p>')
      const captured: Captured[] = []
      mocks.pickModel.mockResolvedValue(scriptedModel([], captured))
      const plain = actions.addQueuedCard(canvas.id, 'redesign the page', 'alice')!
      if (mixed) actions.addQueuedCard(canvas.id, 'match the style', 'alice', undefined, [source.id])
      await vi.waitFor(() => expect(plain.failedAt).toBeTypeOf('number'))
      const kickoff = JSON.stringify(captured[0]!.messages)
      if (mixed) {
        expect(kickoff).not.toContain('set_guidelines')
        expect(kickoff).not.toContain('TWO new frames')
        expect(kickoff).toContain('Standard HTML strategy')
      } else {
        expect(kickoff).toContain('set_guidelines')
        expect(kickoff).toContain('TWO new frames')
      }
    },
  )

  it.each(['deleted', 'foreign', 'no-vision'])(
    'pauses a %s reference before server admission while executing its valid neighbor',
    async (mode) => {
      const canvas = freshCanvas()
      const source = addFrame(canvas.id, 'Source', '<p>source</p>')
      const target = addFrame(canvas.id, 'Target', '<h1>before</h1>')
      const captured: Captured[] = []
      const model = {
        ...scriptedModel(
          [
            () =>
              tool('edit', 'edit_frame_html', {
                frame_id: target.id,
                find: '<h1>before</h1>',
                replace: '<h1>after</h1>',
              }),
            () => tool('shot', 'screenshot_frame', { frame_id: target.id }),
            () => done(),
          ],
          captured,
        ),
        provider: 'requesty',
        vision: mode !== 'no-vision',
      }
      mocks.pickModel.mockImplementation(async () => {
        if (mode === 'deleted') store.deleteFrame(source.id)
        if (mode === 'foreign') source.canvasId = store.createCanvas('Foreign').id
        return model
      })
      const broken = actions.addQueuedCard(canvas.id, 'broken visual request', 'alice', undefined, [source.id])!
      const good = actions.addQueuedCard(canvas.id, 'valid neighbor', 'alice')!
      await vi.waitFor(() => expect(good.endedAt).toBeTypeOf('number'))
      expect(broken.failureReason).toBe(mode === 'no-vision' ? noVision : missing)
      expect(broken.endedAt).toBeUndefined()
      expect(broken.attachments).toEqual([source.id])
      expect(mocks.prepareServerWork.mock.calls.map((args) => args[2].id)).toEqual([good.id])
      expect(JSON.stringify(captured[0]!.messages)).not.toContain('broken visual request')
      expect(store.getFrame(target.id)?.html).toContain('<h1>after</h1>')
    },
  )

  it('checks a reference again before its own admission after awaiting a neighboring card', async () => {
    const canvas = freshCanvas()
    const source = addFrame(canvas.id, 'Source', '<p>source</p>')
    const captured: Captured[] = []
    mocks.pickModel.mockResolvedValue({ ...scriptedModel([], captured), provider: 'requesty' })
    mocks.prepareServerWork.mockImplementation(async () => {
      await Promise.resolve()
      store.deleteFrame(source.id)
      return true
    })
    const broken = actions.addQueuedCard(canvas.id, 'reference queued first', 'alice', undefined, [source.id])!
    const neighbor = actions.addQueuedCard(canvas.id, 'neighbor admitted first', 'alice')!
    await vi.waitFor(() => expect(broken.failedAt).toBeTypeOf('number'))
    expect(broken.failureReason).toBe(missing)
    expect(mocks.prepareServerWork.mock.calls.map((args) => args[2].id)).toEqual([neighbor.id])
    expect(JSON.stringify(captured[0]!.messages)).not.toContain('reference queued first')
  })

  it.each(['deleted', 'foreign'])('revalidates a source made %s during asynchronous server admission', async (mode) => {
    const canvas = freshCanvas()
    const source = addFrame(canvas.id, 'Source', '<p>source</p>')
    const captured: Captured[] = []
    mocks.pickModel.mockResolvedValue({ ...scriptedModel([], captured), provider: 'requesty' })
    mocks.prepareServerWork.mockImplementation(async () => {
      await Promise.resolve()
      if (mode === 'deleted') store.deleteFrame(source.id)
      else source.canvasId = store.createCanvas('Other').id
      return true
    })
    const card = actions.addQueuedCard(canvas.id, 'design using source', 'alice', undefined, [source.id])!
    await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
    expect(card.failureReason).toBe(missing)
    expect(card.endedAt).toBeUndefined()
    expect(captured).toHaveLength(0)
    expect(mocks.prepareServerWork).toHaveBeenCalledTimes(1)
  })

  it('pauses a missing local reference without invoking its model', async () => {
    const canvas = freshCanvas()
    const source = addFrame(canvas.id, 'Source', '<p>source</p>')
    const captured: Captured[] = []
    mocks.pickModel.mockImplementation(async () => {
      store.deleteFrame(source.id)
      return scriptedModel([], captured)
    })
    const card = actions.addQueuedCard(canvas.id, 'local reference', 'alice', undefined, [source.id])!
    await vi.waitFor(() => expect(card.failedAt).toBeTypeOf('number'))
    expect(card.failureReason).toBe(missing)
    expect(captured).toHaveLength(0)
    expect(mocks.prepareServerWork).not.toHaveBeenCalled()
  })
})
