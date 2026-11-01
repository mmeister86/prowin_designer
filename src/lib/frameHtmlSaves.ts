import { api, errorMessage } from './api'
import { useStore } from './store'

/* One per-frame sequence for client-authored frame-HTML writes (inline
   typing, layer/HTML edits, template-field commits). Requests serialize:
   at most one PATCH is in flight per frame and a newer write coalesces
   behind it, so responses cannot overtake each other and no stale
   rejection can roll back newer edits. Only the governing failure rolls
   back — past predecessors the server already refused, never past
   confirmed content. Optimistic display is untouched: callers patch the
   store first, the pipeline only sends and settles. */

export interface SaveAttempt {
  html: string
  before: string
  rejected: boolean
}

/** Walk `before` back past refused predecessors to the newest confirmed state. */
export function rollbackTarget(attempts: SaveAttempt[], before: string): string {
  let target = before
  for (let i = 0; i <= attempts.length; i++) {
    const prior = attempts.find((a) => a.rejected && a.html === target)
    if (!prior) break
    target = prior.before
  }
  return target
}

export interface HtmlSaveRequest {
  frameId: string
  html: string
  /** store html the optimistic patch built on; undefined when the frame is gone */
  before: string | undefined
  refusedNotice: string
  /** bring the live document to the settled html (rollback target or current store) */
  resetLive?: (frameId: string, html: string) => void
}

interface PendingSave {
  req: HtmlSaveRequest
  attempt: SaveAttempt | null
  resolve: () => void
}

interface FrameSaveState {
  inflight: PendingSave | null
  queued: PendingSave | null
  attempts: SaveAttempt[]
}

const frames = new Map<string, FrameSaveState>()

function stateOf(frameId: string): FrameSaveState {
  let state = frames.get(frameId)
  if (!state) {
    state = { inflight: null, queued: null, attempts: [] }
    frames.set(frameId, state)
  }
  return state
}

/** Queue an HTML save; resolves once its fate is decided (never rejects). */
export function enqueueHtmlSave(req: HtmlSaveRequest): Promise<void> {
  return new Promise<void>((resolve) => {
    /* nothing to send: the store already holds this content */
    if (req.html === req.before) {
      resolve()
      return
    }
    const state = stateOf(req.frameId)
    const attempt: SaveAttempt | null =
      req.before === undefined ? null : { html: req.html, before: req.before, rejected: false }
    if (attempt) {
      state.attempts.push(attempt)
      /* bounded backstop; successes prune below, so only a long refused
         streak ever approaches this */
      if (state.attempts.length > 50) state.attempts.splice(0, state.attempts.length - 50)
    }
    const pending: PendingSave = { req, attempt, resolve }
    if (state.inflight) {
      /* coalesce behind the running request: the newest intent wins, and a
         superseded waiter resolves — its content lives on in the store and
         the replacing send settles its fate */
      if (state.queued) state.queued.resolve()
      state.queued = pending
      return
    }
    void send(req.frameId, pending)
  })
}

async function send(frameId: string, pending: PendingSave): Promise<void> {
  const state = stateOf(frameId)
  state.inflight = pending
  try {
    await api.updateFrame(frameId, { html: pending.req.html })
    if (pending.attempt) {
      /* confirmed: this content and everything it supersedes are moot for
         future walks — drop them so stale episodes cannot poison one */
      const at = state.attempts.indexOf(pending.attempt)
      if (at >= 0) state.attempts.splice(0, at + 1)
    }
  } catch (err) {
    onRefused(state, frameId, pending, err)
  }
  pending.resolve()
  state.inflight = null
  const next = state.queued
  state.queued = null
  if (next) void send(frameId, next)
}

function onRefused(state: FrameSaveState, frameId: string, pending: PendingSave, error: unknown): void {
  if (pending.attempt) pending.attempt.rejected = true
  const s = useStore.getState()
  const cur = s.canvas?.frames.find((f) => f.id === frameId)?.html
  if (cur !== undefined && cur === pending.req.html) {
    /* governing failure: roll back past refused predecessors to the
       newest confirmed state, in the store and live */
    const target =
      pending.attempt && pending.req.before !== undefined
        ? rollbackTarget(state.attempts, pending.req.before)
        : pending.req.html
    s.patchFrameLocal(frameId, { html: target })
    s.pushNotice(errorMessage(error, pending.req.refusedNotice))
    pending.req.resetLive?.(frameId, target)
  } else if (!state.queued) {
    /* displaced by external movement with nothing newer pending: keep
       the newer store, but reset the live session to it audibly */
    s.pushNotice(errorMessage(error, pending.req.refusedNotice))
    if (cur !== undefined) pending.req.resetLive?.(frameId, cur)
  }
  /* else: superseded by our own newer queued save — silent; it judges next */
}
