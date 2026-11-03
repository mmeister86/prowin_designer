// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { effectiveSafeZone, safeZoneIntrudes } from '../shared/prowin/safeZones.ts'

it('placeholder: overlay geometry uses nonoverlapping bands (RED)', async () => {
  const { bandRects } = await import('../src/prowin/SafeZoneOverlay.tsx')
  const insets = { top: 200, right: 0, bottom: 250, left: 0 }
  const rects = bandRects(insets, 1080, 1920)
  // top + bottom full width, sides only between them: no overlap
  expect(rects.top).toEqual({ x: 0, y: 0, width: 1080, height: 200 })
  expect(rects.bottom).toEqual({ x: 0, y: 1670, width: 1080, height: 250 })
  expect(rects.left).toEqual({ x: 0, y: 200, width: 0, height: 1470 })
  expect(rects.right).toEqual({ x: 1080, y: 200, width: 0, height: 1470 })
  const total = rects.top.height * rects.top.width + rects.bottom.height * rects.bottom.width
  expect(total).toBe(200 * 1080 + 250 * 1080)
})

it('boundary contact is allowed, crossing counts', () => {
  const insets = { top: 50, right: 50, bottom: 50, left: 50 }
  expect(safeZoneIntrudes({ x: 50, y: 50, width: 100, height: 100 }, insets, 1080, 1080)).toBe(false)
  expect(safeZoneIntrudes({ x: 49, y: 50, width: 100, height: 100 }, insets, 1080, 1080)).toBe(true)
  expect(effectiveSafeZone({ preset: undefined })).toBe(null)
})
