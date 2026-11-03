export const MAX_SAFE_ZONE_BOXES = 200

export interface SafeZoneBox {
  x: number
  y: number
  width: number
  height: number
}

export type SafeZoneStatus = 'ok' | 'incomplete' | 'unavailable'

export interface SafeZoneReply {
  status: SafeZoneStatus
  boxes: SafeZoneBox[]
  /** Frame-local CSS px viewport the boxes were measured in, if trusted. */
  viewport: { width: number; height: number } | null
  /** Rendered-document generation the measurement belongs to, if trusted. */
  generation: number | null
}

function finitePositive(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0
}

/** Parent-side validation of the iframe's advisory geometry. Only the
 *  recognized statuses (`ok`, `incomplete`, `unavailable`) with a finite
 *  positive viewport, finite box origins, finite positive box dimensions and
 *  a finite generation are trusted — `incomplete` keeps its (at most 200)
 *  advisory boxes so the warning stays on. Every other shape degrades to
 *  incomplete/unavailable and never yields trusted success. */
export function validateSafeZoneReply(reply: unknown): SafeZoneReply {
  const empty = (status: SafeZoneStatus): SafeZoneReply => ({ status, boxes: [], viewport: null, generation: null })
  if (!reply || typeof reply !== 'object') return empty('unavailable')
  const record = reply as Record<string, unknown>
  if (record.status === 'unavailable') return empty('unavailable')
  if (record.status !== 'ok' && record.status !== 'incomplete') return empty('incomplete')
  const viewport = record.viewport as { width?: unknown; height?: unknown } | null
  if (!viewport || !finitePositive(viewport.width) || !finitePositive(viewport.height)) {
    return empty('incomplete')
  }
  const generation = record.generation
  if (typeof generation !== 'number' || !Number.isFinite(generation)) return empty('incomplete')
  const rawBoxes = Array.isArray(record.boxes) ? record.boxes : null
  if (!rawBoxes) return empty('incomplete')
  const boxes: SafeZoneBox[] = []
  for (const entry of rawBoxes) {
    if (boxes.length >= MAX_SAFE_ZONE_BOXES) break
    if (!entry || typeof entry !== 'object') return empty('incomplete')
    const box = entry as Record<string, unknown>
    const { x, y, width, height } = box
    if (
      typeof x !== 'number' ||
      typeof y !== 'number' ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      !finitePositive(width) ||
      !finitePositive(height)
    ) {
      return empty('incomplete')
    }
    boxes.push({ x, y, width: width as number, height: height as number })
  }
  const cleanViewport = { width: viewport.width as number, height: viewport.height as number }
  /* a truncated payload (more boxes than the bound) is advisory, never
     trusted success: callers see incomplete and keep the warning on */
  if (rawBoxes.length > MAX_SAFE_ZONE_BOXES) return { status: 'incomplete', boxes, viewport: cleanViewport, generation }
  if (record.status !== 'ok') return { status: 'incomplete', boxes, viewport: cleanViewport, generation }
  return { status: 'ok', boxes, viewport: cleanViewport, generation }
}
