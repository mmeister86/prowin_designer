import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as actions from '../server/actions.ts'
import * as persist from '../server/db/persist.ts'
import { store } from '../server/store.ts'
import { normalizeFrameHtml } from '../server/prowin/frameBrand.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import type { Actor, Canvas } from '../shared/types.ts'

/**
 * TASK-30 Task 2 RED: atomic append drafts. Raw chunks buffer for all roles
 * until done; the committed frame, timestamps and history stay unchanged
 * before commit. Foreign users cannot append/restart/cancel; concurrent
 * saves conflict with 409; invalid finals, timeouts and own restarts
 * discard the draft without saving partial HTML.
 */

vi.mock('../server/db/persist.ts', () => ({
  saveFrame: vi.fn(),
  saveCanvas: vi.fn(),
  saveActivity: vi.fn(),
  saveTask: vi.fn(),
  saveFrameVersion: vi.fn(),
  getFrameVersion: vi.fn(),
  saveCanvasCopy: vi.fn(),
  savePageCopy: vi.fn(),
  deleteCanvas: vi.fn(),
  deleteFrame: vi.fn(),
}))
vi.mock('../server/resident.ts', () => ({ onFeedback: () => {} }))
vi.mock('../server/distill.ts', () => ({ onDecision: () => {} }))
vi.mock('../server/prowin/accounts.ts', () => ({
  permissionIdentity: async (userId: string) => ({ userId, admin: false, creator: userId === 'creator-id' }),
}))

const mate: Actor = { name: 'Mate', kind: 'user', color: '#000' }
const creator: Actor = { name: 'Creator', kind: 'user', color: '#111' }

const FIELD = '<h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel">Hallo</h1>'
const LOCKED = '<p data-od-id="intro" data-od-role="body" data-od-locked="true">Text</p>'

function as(user: string, fn: () => unknown): Promise<unknown> {
  return withUserPermissions(user, async () => fn())
}

beforeEach(() => {
  vi.clearAllMocks()
  const canvas: Canvas = {
    id: 'stream-drafts',
    name: 'Drafts',
    ownerId: 'creator-id',
    createdAt: 1,
    updatedAt: 1,
    frames: [],
  }
  store.init([canvas])
})
afterEach(() => vi.useRealTimers())

function plainFrame(html = '<p>Stream Basis</p>') {
  return actions.createFrame('stream-drafts', { name: 'Plain', html }, mate)!
}

async function templateFrame(): Promise<{ id: string }> {
  let id = ''
  await as(
    'creator-id',
    () =>
      (id = actions.createFrame(
        'stream-drafts',
        { name: 'Template', html: `<div>${FIELD}${LOCKED}</div>` },
        creator,
      )!.id),
  )
  return { id }
}

describe('atomic append drafts', () => {
  it('buffers chunks: committed frame, timestamps and history stay unchanged', async () => {
    const frame = plainFrame()
    const before = store.getFrame(frame.id)!
    const at = before.updatedAt
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, '<section>Neu', mate, { start: true })
      actions.appendFrameHtml(frame.id, 'er Entwurf</section>', mate)
    })
    const current = store.getFrame(frame.id)!
    expect(current.html).toBe(before.html)
    expect(current.updatedAt).toBe(at)
    expect(persist.saveFrameVersion).not.toHaveBeenCalled()
    expect(actions.hasAppendDraft(frame.id)).toBe(true)
  })

  it('commits the full document once at done and files one version', async () => {
    const frame = plainFrame('<p>Alt</p>')
    const doc = '<!doctype html><html><body><main>Gamma</main></body></html>'
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, doc.slice(0, 17), mate, { start: true })
      const committed = actions.appendFrameHtml(frame.id, doc.slice(17), mate, { done: true })!
      expect(committed.html).toBe(normalizeFrameHtml(doc))
    })
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml(doc))
    expect(persist.saveFrameVersion).toHaveBeenCalledTimes(1)
    expect(actions.hasAppendDraft(frame.id)).toBe(false)
  })

  it.each([10, 41, 51, 83])('reassembles split tags across chunks (%i)', async (split) => {
    const frame = plainFrame()
    const doc = '<!doctype html><html><head><style>p{color:red}</style></head><body><p>Neu</p></body></html>'
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, doc.slice(0, split), mate, { start: true })
      actions.appendFrameHtml(frame.id, doc.slice(split), mate, { done: true })
    })
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml(doc))
  })

  it('keeps the escape latch for the whole stream', async () => {
    const frame = plainFrame()
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, '&lt;!doctype html&gt;&lt;html&gt;', mate, { start: true })
      actions.appendFrameHtml(frame.id, '&lt;body&gt;Text&lt;/body&gt;&lt;/html&gt;', mate, { done: true })
    })
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<!doctype html><html><body>Text</body></html>'))
  })

  it('rejects an invalid final candidate without changing the frame and discards the draft', async () => {
    const frame = await templateFrame()
    const stored = store.getFrame(frame.id)!
    const bad = stored.html.replace(' data-od-locked="true"', '')
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, bad.slice(0, 30), mate, { start: true })
      expect(() => actions.appendFrameHtml(frame.id, bad.slice(30), mate, { done: true })).toThrow()
    })
    expect(store.getFrame(frame.id)!.html).toBe(stored.html)
    expect(actions.hasAppendDraft(frame.id)).toBe(false)
    expect(persist.saveFrameVersion).not.toHaveBeenCalled()
  })

  it('rejects foreign appends and restarts while preserving the draft', async () => {
    const frame = plainFrame()
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '<p>Mate Entwurf', mate, { start: true }))
    await as('creator-id', () => {
      expect(() => actions.appendFrameHtml(frame.id, '<p>Fremd', creator)).toThrow()
      expect(() => actions.appendFrameHtml(frame.id, '<p>Neustart', creator, { start: true })).toThrow()
    })
    expect(actions.hasAppendDraft(frame.id)).toBe(true)
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '</p>', mate, { done: true }))
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<p>Mate Entwurf</p>'))
  })

  it('conflicts with 409 on a concurrent save and keeps the winner', async () => {
    const frame = plainFrame('<p>Basis</p>')
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '<p>Entwurf', mate, { start: true }))
    await as('creator-id', () => actions.updateFrame(frame.id, { html: '<p>Gewinner</p>' }, creator, { replace: true }))
    await as('mate-id', () => {
      expect(() => actions.appendFrameHtml(frame.id, '</p>', mate, { done: true })).toThrow(actions.FrameConflictError)
    })
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<p>Gewinner</p>'))
  })

  it('a successful full save by the same user discards its old draft', async () => {
    const frame = plainFrame('<p>Basis</p>')
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '<p>Alter Entwurf', mate, { start: true }))
    await as('mate-id', () => actions.updateFrame(frame.id, { html: '<p>Direkt</p>' }, mate, { replace: true }))
    expect(actions.hasAppendDraft(frame.id)).toBe(false)
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '<p>Nachsatz</p>', mate, { done: true }))
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<p>Direkt</p><p>Nachsatz</p>'))
  })

  it('a rejected full save preserves the draft and the frame', async () => {
    const frame = await templateFrame()
    const stored = store.getFrame(frame.id)!
    const good = stored.html.replace('>Hallo<', '>Hallo Welt<')
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, good.slice(0, 25), mate, { start: true })
      expect(() =>
        actions.updateFrame(frame.id, { html: stored.html.replace(' data-od-locked="true"', '') }, mate),
      ).toThrow()
      const committed = actions.appendFrameHtml(frame.id, good.slice(25), mate, { done: true })!
      expect(committed.html).toBe(normalizeFrameHtml(good))
    })
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml(good))
  })

  it('a timeout discards the draft without saving partial HTML', async () => {
    vi.useFakeTimers()
    const frame = plainFrame('<p>Basis</p>')
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '<p>Abgebrochen', mate, { start: true }))
    await vi.advanceTimersByTimeAsync(31_000)
    actions.discardIdleDrafts()
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<p>Basis</p>'))
    expect(actions.hasAppendDraft(frame.id)).toBe(false)
    await as('mate-id', () => actions.appendFrameHtml(frame.id, '<p>Frisch</p>', mate, { done: true }))
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<p>Basis</p><p>Frisch</p>'))
  })

  it('an authorized restart replaces the draft and commits only the new content', async () => {
    const frame = plainFrame()
    await as('mate-id', () => {
      actions.appendFrameHtml(frame.id, '<p>Verworfen', mate, { start: true })
      actions.appendFrameHtml(frame.id, '<p>Ersatz', mate, { start: true })
      actions.appendFrameHtml(frame.id, '</p>', mate, { done: true })
    })
    expect(store.getFrame(frame.id)!.html).toBe(normalizeFrameHtml('<p>Ersatz</p>'))
  })

  it('missing permission context fails closed on protected commits', async () => {
    const frame = await templateFrame()
    const stored = store.getFrame(frame.id)!
    const bad = stored.html.replace(' data-od-locked="true"', '')
    expect(() => actions.appendFrameHtml(frame.id, bad, mate, { start: true, done: true })).toThrow()
    expect(store.getFrame(frame.id)!.html).toBe(stored.html)
  })
})
