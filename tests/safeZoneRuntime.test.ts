// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { validateSafeZoneReply, MAX_SAFE_ZONE_BOXES } from '../src/lib/safeZoneMeasure.ts'

it('bounded 200-box payload with numeric validation and unavailable status', async () => {
  expect(MAX_SAFE_ZONE_BOXES).toBe(200)
  const good = validateSafeZoneReply({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport: { width: 1080, height: 1920 },
  })
  expect(good.status).toBe('ok')
  const bad = validateSafeZoneReply({
    status: 'ok',
    boxes: [{ x: NaN, y: 0, width: 10, height: 10 }],
    viewport: { width: 1080, height: 1920 },
  })
  expect(bad.status).toBe('incomplete')
  const huge = validateSafeZoneReply({
    status: 'ok',
    boxes: Array.from({ length: 250 }, () => ({ x: 0, y: 0, width: 1, height: 1 })),
    viewport: { width: 1080, height: 1920 },
  })
  expect(huge.status).toBe('incomplete')
  expect(huge.boxes.length).toBeLessThanOrEqual(200)
  expect(validateSafeZoneReply(null).status).toBe('unavailable')
  expect(validateSafeZoneReply({ status: 'unavailable', boxes: [], viewport: null }).status).toBe('unavailable')
})
