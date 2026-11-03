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
}

/** Parent-side validation of the iframe's advisory geometry. Invalid
 *  numbers, missing viewport, oversized payloads or unknown shapes never
 *  produce trusted success — they degrade to incomplete/unavailable. */
export function validateSafeZoneReply(reply: unknown): SafeZoneReply {
  if (!reply || typeof reply !== 'object') return { status: 'unavailable', boxes: [] }
  const record = reply as Record<string, unknown>
  if (record.status === 'unavailable') return { status: 'unavailable', boxes: [] }
  const rawBoxes = Array.isArray(record.boxes) ? record.boxes : null
  if (!rawBoxes) return { status: 'incomplete', boxes: [] }
  const boxes: SafeZoneBox[] = []
  for (const entry of rawBoxes) {
    if (boxes.length >= MAX_SAFE_ZONE_BOXES) break
    if (!entry || typeof entry !== 'object') return { status: 'incomplete', boxes: [] }
    const box = entry as Record<string, unknown>
    const nums = [box.x, box.y, box.width, box.height]
    if (!nums.every((n) => typeof n === 'number' && Number.isFinite(n))) {
      return { status: 'incomplete', boxes: [] }
    }
    boxes.push({ x: box.x as number, y: box.y as number, width: box.width as number, height: box.height as number })
  }
  /* a truncated payload (more boxes than the bound) is advisory, never
     trusted success: callers see incomplete and keep the warning on */
  if (rawBoxes.length > MAX_SAFE_ZONE_BOXES) return { status: 'incomplete', boxes }
  if (typeof record.status === 'string' && record.status !== 'ok') {
    return { status: 'incomplete', boxes }
  }
  return { status: 'ok', boxes }
}
