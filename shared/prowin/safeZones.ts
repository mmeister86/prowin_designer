import { FORMAT_PRESETS, type FormatPresetId, type Insets } from './formats.ts'

const SIDES = ['top', 'right', 'bottom', 'left'] as const

/** Exact four-sided finite nonnegative integer insets; rejects partial, extra, NaN, negative and fractional input. */
export function isSafeZoneOverride(value: unknown): value is Insets {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const record = value as Record<string, unknown>
  if (SIDES.some((side) => !(side in record)) || Object.keys(record).length !== SIDES.length) return false
  return SIDES.every((side) => Number.isInteger(record[side]) && (record[side] as number) >= 0)
}

/** Side-by-side value equality — never JSON key order. Absent (undefined) and null both mean "no override". */
export function safeZoneEquals(a: Insets | null | undefined, b: Insets | null | undefined): boolean {
  const x = a ?? null
  const y = b ?? null
  if (x === null || y === null) return x === y
  return x.top === y.top && x.right === y.right && x.bottom === y.bottom && x.left === y.left
}
/** Where the effective insets come from: the preset default, a Creator override, or nothing without a preset. */
export function safeZoneSource(
  frame: Pick<{ preset?: FormatPresetId; safeZoneOverride?: Insets }, 'preset' | 'safeZoneOverride'>,
): 'preset' | 'override' | 'none' {
  if (frame.preset === undefined || !(frame.preset in FORMAT_PRESETS)) return 'none'
  return frame.safeZoneOverride !== undefined ? 'override' : 'preset'
}

/** One-line agent context, e.g. `safe-zone 50/50/50/50 (preset)` or `no safe-zone`. */
export function describeSafeZone(
  frame: Pick<{ preset?: FormatPresetId; safeZoneOverride?: Insets }, 'preset' | 'safeZoneOverride'>,
): string {
  const zone = effectiveSafeZone(frame)
  if (!zone) return 'no safe-zone'
  return `safe-zone ${zone.top}/${zone.right}/${zone.bottom}/${zone.left} (${safeZoneSource(frame)})`
}

/** The preset default, fully replaced by a valid override; null without a preset. */
export function effectiveSafeZone(
  frame: Pick<{ preset?: FormatPresetId; safeZoneOverride?: Insets }, 'preset' | 'safeZoneOverride'>,
): Insets | null {
  if (frame.preset === undefined || !(frame.preset in FORMAT_PRESETS)) return null
  if (frame.safeZoneOverride !== undefined) return frame.safeZoneOverride
  return FORMAT_PRESETS[frame.preset].safe
}

/** Overrides must leave positive inner width and height. */
export function safeZoneFits(insets: Insets, width: number, height: number): boolean {
  return insets.left + insets.right < width && insets.top + insets.bottom < height
}

/** Touching the inner boundary is allowed; crossing a margin or sitting outside counts. */
export function safeZoneIntrudes(
  rect: { x: number; y: number; width: number; height: number },
  insets: Insets,
  width: number,
  height: number,
): boolean {
  return (
    rect.x < insets.left ||
    rect.y < insets.top ||
    rect.x + rect.width > width - insets.right ||
    rect.y + rect.height > height - insets.bottom
  )
}
