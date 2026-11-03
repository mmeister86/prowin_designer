import { trackSave } from './history'

/* Shared per-frame geometry save queue for drag-resize/move (FrameView) and
   Inspector numeric commits. A gesture reserves its frames at pointer-down and
   holds them through save plus history record: a second gesture on a reserved
   frame never starts (it would inherit a possibly rejected optimistic rect),
   and Inspector commits queue behind the reservation so their baseline is
   read after resolution, never inside the uncommitted drag. The busy count
   covers save plus history record. */

const chains = new Map<string, Promise<void>>()
const pending = new Map<string, number>()
/* resolvers of still-open gesture gates, so a reset never leaves an undo
   barrier waiting forever */
const openGates = new Set<() => void>()

export function isGeometrySaving(frameId: string): boolean {
  return (pending.get(frameId) ?? 0) > 0
}

/** Test-only reset of module state. */
export function resetGeometrySaves(): void {
  chains.clear()
  pending.clear()
  for (const resolve of openGates) resolve()
  openGates.clear()
}

function tailFor(ids: string[]): Promise<void> {
  if (ids.length === 0) return Promise.resolve()
  return Promise.all(ids.map((id) => chains.get(id) ?? Promise.resolve())).then(() => undefined)
}

function release(ids: string[]): void {
  for (const id of ids) {
    const n = (pending.get(id) ?? 1) - 1
    if (n <= 0) pending.delete(id)
    else pending.set(id, n)
  }
}

/* A settled tail leaves the map only while nothing newer queued behind it:
   an older completion must never drop a newer tail. */
function dropTail(ids: string[], tail: Promise<void>): void {
  for (const id of ids) {
    if (chains.get(id) === tail) chains.delete(id)
  }
}

export function enqueueGeometrySave(frameIds: string[], run: () => Promise<void>): Promise<void> {
  const unique = [...new Set(frameIds)]
  const prev = tailFor(unique)
  for (const id of unique) pending.set(id, (pending.get(id) ?? 0) + 1)
  const next = prev.then(run)
  const settled = next.then(
    () => undefined,
    () => undefined,
  )
  for (const id of unique) chains.set(id, settled)
  trackSave(settled)
  const done = () => {
    release(unique)
    dropTail(unique, settled)
  }
  settled.then(done, done)
  return next
}

export interface GeometryGesture {
  /* Run the gesture finalization after the predecessors seen at reservation
     (never behind commits queued during the gesture itself) and release. */
  finish: (run: () => Promise<void>) => Promise<void>
  /* Abandon the gesture without running anything and release. Idempotent. */
  cancel: () => void
}

/* Reserve frames synchronously at gesture start (pointer-down) through the
   async save plus history finish. The finalization runs after the chain seen
   here, so commits that queued behind the reservation do not precede it. */
export function beginGeometryGesture(frameIds: string[]): GeometryGesture {
  const unique = [...new Set(frameIds)]
  const prev = tailFor(unique)
  for (const id of unique) pending.set(id, (pending.get(id) ?? 0) + 1)
  if (unique.length === 0) return { finish: (run) => prev.then(run), cancel: () => undefined }
  let resolveGate!: () => void
  const gate = new Promise<void>((resolve) => {
    resolveGate = resolve
  })
  const settled = gate.then(() => undefined)
  for (const id of unique) chains.set(id, settled)
  trackSave(settled)
  openGates.add(resolveGate)
  let done = false
  const settle = () => {
    if (done) return
    done = true
    openGates.delete(resolveGate)
    release(unique)
    dropTail(unique, settled)
    resolveGate()
  }
  return {
    finish: (run) => {
      const next = prev.then(run)
      next.then(settle, settle)
      return next
    },
    cancel: settle,
  }
}
