// @vitest-environment happy-dom
import { expect, it } from 'vitest'
import { validateSafeZoneReply, MAX_SAFE_ZONE_BOXES } from '../src/lib/safeZoneMeasure.ts'
import { FRAME_BOOTSTRAP } from '../src/lib/frameRuntime.ts'

it('bounded 200-box payload with numeric validation and unavailable status', async () => {
  expect(MAX_SAFE_ZONE_BOXES).toBe(200)
  const good = validateSafeZoneReply({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport: { width: 1080, height: 1920 },
    generation: 1,
  })
  expect(good.status).toBe('ok')
  const bad = validateSafeZoneReply({
    status: 'ok',
    boxes: [{ x: NaN, y: 0, width: 10, height: 10 }],
    viewport: { width: 1080, height: 1920 },
    generation: 1,
  })
  expect(bad.status).toBe('incomplete')
  const huge = validateSafeZoneReply({
    status: 'ok',
    boxes: Array.from({ length: 250 }, () => ({ x: 0, y: 0, width: 1, height: 1 })),
    viewport: { width: 1080, height: 1920 },
    generation: 1,
  })
  expect(huge.status).toBe('incomplete')
  expect(huge.boxes.length).toBeLessThanOrEqual(200)
  expect(validateSafeZoneReply(null).status).toBe('unavailable')
  expect(validateSafeZoneReply({ status: 'unavailable', boxes: [], viewport: null }).status).toBe('unavailable')
})

it('rejects untrusted success: explicit status, finite positive viewport and box dimensions', () => {
  const viewport = { width: 1080, height: 1920 }
  const box = { x: 0, y: 0, width: 10, height: 10 }
  // missing or non-string status is never trusted success
  expect(validateSafeZoneReply({ boxes: [box], viewport }).status).toBe('incomplete')
  expect(validateSafeZoneReply({ status: 1, boxes: [box], viewport }).status).toBe('incomplete')
  expect(validateSafeZoneReply({ status: 'ok ', boxes: [box], viewport }).status).toBe('incomplete')
  // missing or non-positive viewport is never trusted success
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box] }).status).toBe('incomplete')
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box], viewport: null }).status).toBe('incomplete')
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box], viewport: { width: 0, height: 1920 } }).status).toBe(
    'incomplete',
  )
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box], viewport: { width: -5, height: 1920 } }).status).toBe(
    'incomplete',
  )
  expect(
    validateSafeZoneReply({ status: 'ok', boxes: [box], viewport: { width: 1080, height: Number.NaN } }).status,
  ).toBe('incomplete')
  // zero or negative box dimensions are never trusted success
  expect(validateSafeZoneReply({ status: 'ok', boxes: [{ ...box, width: 0 }], viewport }).status).toBe('incomplete')
  expect(validateSafeZoneReply({ status: 'ok', boxes: [{ ...box, height: -1 }], viewport }).status).toBe('incomplete')
  expect(
    validateSafeZoneReply({ status: 'ok', boxes: [{ ...box, x: Number.POSITIVE_INFINITY }], viewport }).status,
  ).toBe('incomplete')
  // malformed generation is never trusted success; a finite one passes through
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box], viewport }).status).toBe('incomplete')
  const stamped = validateSafeZoneReply({ status: 'ok', boxes: [box], viewport, generation: 3 })
  expect(stamped.status).toBe('ok')
  expect(stamped.generation).toBe(3)
})

it('keeps advisory boxes on a well-formed runtime incomplete (truncation)', () => {
  const viewport = { width: 1080, height: 1920 }
  const kept = validateSafeZoneReply({
    status: 'incomplete',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport,
    generation: 2,
  })
  expect(kept.status).toBe('incomplete')
  expect(kept.boxes).toHaveLength(1)
  expect(kept.generation).toBe(2)
  // ...but a malformed incomplete carries no trusted geometry
  const dropped = validateSafeZoneReply({
    status: 'incomplete',
    boxes: [{ x: 0, y: 0, width: 0, height: 10 }],
    viewport,
  })
  expect(dropped.status).toBe('incomplete')
  expect(dropped.boxes).toHaveLength(0)
})

it('carries the expected-document token for render-identity matching', () => {
  const viewport = { width: 1080, height: 1920 }
  const box = { x: 0, y: 0, width: 10, height: 10 }
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box], viewport, generation: 3, docToken: 9 }).docToken).toBe(9)
  expect(validateSafeZoneReply({ status: 'ok', boxes: [box], viewport, generation: 3 }).docToken).toBe(null)
  expect(validateSafeZoneReply(null).docToken).toBe(null)
})

it('the iframe runtime stamps replies and render notifications with the document token', () => {
  // The runtime ships as a source string; these pins guard the wiring the
  // hook's render-identity check depends on end to end (a reply without the
  // stamp can never confirm the desired document).
  expect(FRAME_BOOTSTRAP).toContain('docToken: measured.docToken')
  expect(FRAME_BOOTSTRAP).toContain(
    "type: 'doop:frame-updated', generation: safeZoneGeneration, docToken: safeZoneDocument",
  )
  expect(FRAME_BOOTSTRAP).toContain('safeZoneDocument = typeof d.docToken')
})
