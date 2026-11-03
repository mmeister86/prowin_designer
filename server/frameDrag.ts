import type { ClientMessage, Frame } from '../shared/types.ts'
import { safeZoneFits } from '../shared/prowin/safeZones.ts'
import { canAccessCanvas } from './access.ts'
import { assertFrameGeometry } from './actions.ts'
import { CreatorPermissionError, withUserPermissions } from './prowin/permissions.ts'
import { store } from './store.ts'

let nextDragSequence = 0
const lastRelayedDrag = new WeakMap<Frame, number>()

/** Validate a live drag against the current session, frame and Creator scope. */
export async function relayFrameDrag(
  canvasId: string,
  msg: Extract<ClientMessage, { type: 'frame:drag' }>,
  getSession: () => Promise<{ user: { id: string } } | null>,
  relay: () => boolean | void,
): Promise<void> {
  const canvas = store.getCanvas(canvasId)
  const frame = store.getFrame(msg.frameId)
  if (!canvas || !frame || frame.canvasId !== canvasId) return
  // Snapshot before either lookup; only an already-relayed newer drag supersedes this one.
  const version = frame.updatedAt
  const sequence = ++nextDragSequence
  const session = await getSession().catch(() => null)
  if (!session || !canAccessCanvas(session.user.id, canvas)) return
  try {
    await withUserPermissions(session.user.id, () => assertFrameGeometry(canvas, frame, msg))
  } catch (error) {
    if (error instanceof CreatorPermissionError) return
    console.error('[ws] drag permission check failed', error)
    return
  }
  /* live positions relay freely, but a drag that shrinks the frame past its
     stored safe-zone override must never reach peers: the committed save
     will reject it, so relaying would leave every peer painting (and acting
     on) geometry the server will refuse. No override travels here — the
     stored server frame is the only policy source. */
  if (frame.safeZoneOverride !== undefined) {
    const width = msg.width ?? frame.width
    const height = msg.height ?? frame.height
    if ((width !== frame.width || height !== frame.height) && !safeZoneFits(frame.safeZoneOverride, width, height))
      return
  }
  if (
    sequence <= (lastRelayedDrag.get(frame) ?? 0) ||
    frame.updatedAt !== version ||
    store.getCanvas(canvasId) !== canvas ||
    store.getFrame(msg.frameId) !== frame ||
    !canAccessCanvas(session.user.id, canvas)
  )
    return
  // A disconnected/replaced socket returns false without broadcasting.
  if (relay() !== false) lastRelayedDrag.set(frame, sequence)
}
