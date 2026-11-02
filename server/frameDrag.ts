import type { ClientMessage, Frame } from '../shared/types.ts'
import { canAccessCanvas } from './access.ts'
import { assertFrameGeometry } from './actions.ts'
import { CreatorPermissionError, withUserPermissions } from './prowin/permissions.ts'
import { store } from './store.ts'

const latestDrag = new WeakMap<Frame, symbol>()

/** Validate a live drag against the current session, frame and Creator scope. */
export async function relayFrameDrag(
  canvasId: string,
  msg: Extract<ClientMessage, { type: 'frame:drag' }>,
  getSession: () => Promise<{ user: { id: string } } | null>,
  relay: () => void,
): Promise<void> {
  const canvas = store.getCanvas(canvasId)
  const frame = store.getFrame(msg.frameId)
  if (!canvas || !frame || frame.canvasId !== canvasId) return
  // Capture before either lookup: later drags and committed saves supersede this message.
  const version = frame.updatedAt
  const sequence = Symbol()
  latestDrag.set(frame, sequence)
  const session = await getSession().catch(() => null)
  if (!session || !canAccessCanvas(session.user.id, canvas)) return
  try {
    await withUserPermissions(session.user.id, () => assertFrameGeometry(canvas, frame, msg))
  } catch (error) {
    if (error instanceof CreatorPermissionError) return
    console.error('[ws] drag permission check failed', error)
    return
  }
  if (
    latestDrag.get(frame) !== sequence ||
    frame.updatedAt !== version ||
    store.getCanvas(canvasId) !== canvas ||
    store.getFrame(msg.frameId) !== frame ||
    !canAccessCanvas(session.user.id, canvas)
  )
    return
  relay()
}
