import { describe, expect, it } from 'vitest'
import { FORMAT_PRESETS } from '../shared/prowin/formats.ts'
import { effectiveSafeZone, isSafeZoneOverride, safeZoneFits, safeZoneIntrudes } from '../shared/prowin/safeZones.ts'

describe('isSafeZoneOverride', () => {
  it('accepts exact four-sided integer insets including zeroes', () => {
    expect(isSafeZoneOverride({ top: 50, right: 50, bottom: 50, left: 50 })).toBe(true)
    expect(isSafeZoneOverride({ top: 0, right: 0, bottom: 0, left: 0 })).toBe(true)
  })
  it.each([
    ['partial', { top: 1, right: 1, bottom: 1 }],
    ['extra key', { top: 1, right: 1, bottom: 1, left: 1, extra: 1 }],
    ['NaN', { top: NaN, right: 0, bottom: 0, left: 0 }],
    ['negative', { top: -1, right: 0, bottom: 0, left: 0 }],
    ['fraction', { top: 1.5, right: 0, bottom: 0, left: 0 }],
    ['string', { top: '1', right: 0, bottom: 0, left: 0 }],
    ['null', null],
    ['array', [1, 2, 3, 4]],
  ])('rejects %s input', (_label, value) => {
    expect(isSafeZoneOverride(value)).toBe(false)
  })
})

describe('effectiveSafeZone', () => {
  it.each([
    ['ig-post', { top: 50, right: 50, bottom: 50, left: 50 }],
    ['ig-story', { top: 200, right: 0, bottom: 250, left: 0 }],
    ['wa-status', { top: 150, right: 0, bottom: 200, left: 0 }],
    ['fb-post', { top: 50, right: 50, bottom: 50, left: 50 }],
    ['a4', { top: 11, right: 11, bottom: 11, left: 11 }],
  ])('returns preset default for %s', (preset, safe) => {
    expect(effectiveSafeZone({ preset: preset as keyof typeof FORMAT_PRESETS })).toEqual(safe)
  })
  it('returns null without a preset and replaces defaults with the override', () => {
    expect(effectiveSafeZone({})).toBeNull()
    expect(effectiveSafeZone({ preset: 'ig-post' })).toEqual({ top: 50, right: 50, bottom: 50, left: 50 })
    expect(
      effectiveSafeZone({ preset: 'ig-post', safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } }),
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
  })
})

describe('safeZoneFits', () => {
  it('requires positive inner width and height', () => {
    expect(safeZoneFits({ top: 50, right: 50, bottom: 50, left: 50 }, 1080, 1080)).toBe(true)
    expect(safeZoneFits({ top: 0, right: 0, bottom: 0, left: 0 }, 1080, 1080)).toBe(true)
    expect(safeZoneFits({ top: 540, right: 0, bottom: 540, left: 0 }, 1080, 1080)).toBe(false)
    expect(safeZoneFits({ top: 0, right: 540, bottom: 0, left: 540 }, 1080, 1080)).toBe(false)
  })
})

describe('safeZoneIntrudes', () => {
  const insets = { top: 50, right: 50, bottom: 50, left: 50 }
  it('allows inner-boundary contact but flags crossing and outside rects', () => {
    // fully inside
    expect(safeZoneIntrudes({ x: 100, y: 100, width: 200, height: 200 }, insets, 1080, 1080)).toBe(false)
    // touching the inner boundary is allowed
    expect(safeZoneIntrudes({ x: 50, y: 50, width: 200, height: 200 }, insets, 1080, 1080)).toBe(false)
    // crossing the margin
    expect(safeZoneIntrudes({ x: 10, y: 100, width: 200, height: 200 }, insets, 1080, 1080)).toBe(true)
    expect(safeZoneIntrudes({ x: 100, y: 100, width: 950, height: 200 }, insets, 1080, 1080)).toBe(true)
    // fully outside the frame
    expect(safeZoneIntrudes({ x: 2000, y: 2000, width: 50, height: 50 }, insets, 1080, 1080)).toBe(true)
  })
})
