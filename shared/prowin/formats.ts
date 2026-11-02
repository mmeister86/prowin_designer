export type Insets = { top: number; right: number; bottom: number; left: number }
const all = (n: number): Insets => ({ top: n, right: n, bottom: n, left: n })

export const FORMAT_PRESETS = {
  'ig-post': { label: 'Instagram Post', width: 1080, height: 1080, safe: all(50), exportScale: 1 },
  'ig-story': {
    label: 'Instagram Story',
    width: 1080,
    height: 1920,
    safe: { top: 200, right: 0, bottom: 250, left: 0 },
    exportScale: 1,
  },
  'wa-status': {
    label: 'WhatsApp Status',
    width: 1080,
    height: 1920,
    safe: { top: 150, right: 0, bottom: 200, left: 0 },
    exportScale: 1,
  },
  'fb-post': { label: 'Facebook Post', width: 1200, height: 630, safe: all(50), exportScale: 1 },
  a4: { label: 'A4 (Druck)', width: 794, height: 1123, safe: all(11), exportScale: 3.125 },
} as const satisfies Record<string, { label: string; width: number; height: number; safe: Insets; exportScale: number }>

export type FormatPresetId = keyof typeof FORMAT_PRESETS

export function isFormatPresetId(value: unknown): value is FormatPresetId {
  return typeof value === 'string' && Object.hasOwn(FORMAT_PRESETS, value)
}
