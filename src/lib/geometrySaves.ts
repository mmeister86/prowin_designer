import { trackSave } from './history'

/* Shared per-frame geometry save queue for drag-resize/move (FrameView) and
   Inspector numeric commits. A second geometry gesture must not start from a
   rejected optimistic rect: FrameView blocks pointer-down while any member is
   busy, Inspector queues behind the pending save so its baseline is read
   after resolution. The busy count covers save plus history record. */

const chains = new Map<string, Promise<void>>()
const pending = new Map<string, number>()

export function isGeometrySaving(frameId: string): boolean {
  return (pending.get(frameId) ?? 0) > 0
}

/** Test-only reset of module state. */
export function resetGeometrySaves(): void {
  chains.clear()
  pending.clear()
}

export function enqueueGeometrySave(frameIds: string[], run: () => Promise<void>): Promise<void> {
  const unique = [...new Set(frameIds)]
  const prev =
    unique.length === 0
      ? Promise.resolve()
      : Promise.all(unique.map((id) => chains.get(id) ?? Promise.resolve())).then(() => undefined)
  for (const id of unique) pending.set(id, (pending.get(id) ?? 0) + 1)
  const next = prev.then(run)
  const settled = next.then(
    () => undefined,
    () => undefined,
  )
  for (const id of unique) chains.set(id, settled)
  trackSave(settled)
  const done = () => {
    for (const id of unique) {
      const n = (pending.get(id) ?? 1) - 1
      if (n <= 0) pending.delete(id)
      else pending.set(id, n)
    }
  }
  settled.then(done, done)
  return next
}
