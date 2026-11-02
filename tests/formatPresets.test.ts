import { expect, it } from 'vitest'
import { FORMAT_PRESETS, isFormatPresetId } from '../shared/prowin/formats.ts'

it('provides the five format definitions from the proWIN specification', () => {
  expect(FORMAT_PRESETS).toEqual({
    'ig-post': {
      label: 'Instagram Post',
      width: 1080,
      height: 1080,
      safe: { top: 50, right: 50, bottom: 50, left: 50 },
      exportScale: 1,
    },
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
    'fb-post': {
      label: 'Facebook Post',
      width: 1200,
      height: 630,
      safe: { top: 50, right: 50, bottom: 50, left: 50 },
      exportScale: 1,
    },
    a4: {
      label: 'A4 (Druck)',
      width: 794,
      height: 1123,
      safe: { top: 11, right: 11, bottom: 11, left: 11 },
      exportScale: 3.125,
    },
  })
})

it.each(['ig-post', 'ig-story', 'wa-status', 'fb-post', 'a4'])('accepts the own catalog key %s', (value) => {
  expect(isFormatPresetId(value)).toBe(true)
})

it.each(['toString', 'constructor', '__proto__', 'unknown', '', null, undefined, 1, {}, ['ig-post']])(
  'rejects non-catalog input %j',
  (value) => {
    expect(isFormatPresetId(value)).toBe(false)
  },
)
