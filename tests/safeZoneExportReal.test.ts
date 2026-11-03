import { afterAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { findBrowserPath, getBrowser, renderFrame } from '../server/screenshot'
import type { Frame } from '../shared/types'

/**
 * TASK-33 Task 3 Round 1: pixel evidence that the real export path carries
 * no overlay. The overlay lives in the parent DOM; the server renders only
 * the stored HTML, so a solid-color document must come back as that exact
 * color — with an override set, reset, or never present.
 */

const GROUND = { r: 0x12, g: 0x34, b: 0x56 }
const SOLID =
  '<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}</style></head>' +
  '<body style="margin:0;background:#123456">' +
  '<div style="width:100vw;height:100vh;background:#123456"></div></body></html>'

function frame(patch: Partial<Frame> = {}): Frame {
  return {
    id: 'solid',
    canvasId: 'ctx',
    name: 'Solid',
    x: 0,
    y: 0,
    width: 120,
    height: 80,
    html: SOLID,
    updatedAt: 1,
    updatedBy: 'test',
    ...patch,
  } as unknown as Frame
}

async function pixels(buf: Buffer): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
  return sharp(buf).raw().toBuffer({ resolveWithObject: true })
}

describe.skipIf(!findBrowserPath())('safe-zone export isolation in real Chromium', { timeout: 60_000 }, () => {
  afterAll(async () => {
    await getBrowser().then((b) => b.close().catch(() => {}))
  })

  it('renders stored HTML pixel-identical with the override set or reset', async () => {
    expect(SOLID).not.toContain('data-safe-zone')
    const pngPlain = await renderFrame(frame(), 1, { type: 'png' })
    const pngOverridden = await renderFrame(
      frame({ safeZoneOverride: { top: 200, right: 0, bottom: 250, left: 0 } }),
      1,
      { type: 'png' },
    )
    const a = await pixels(pngPlain)
    const b = await pixels(pngOverridden)
    expect(a.info.width).toBe(120)
    expect(a.info.height).toBe(80)
    expect(b.info).toMatchObject({ width: 120, height: 80, channels: a.info.channels })
    expect(Buffer.compare(a.data, b.data)).toBe(0)
    // Solid ground everywhere: no overlay band painted a single pixel.
    for (let i = 0; i < a.data.length; i += a.info.channels) {
      expect([a.data[i], a.data[i + 1], a.data[i + 2]]).toEqual([GROUND.r, GROUND.g, GROUND.b])
    }
  })

  it('paints no overlay tint into the JPG export either', async () => {
    const jpg = await renderFrame(frame(), 1, { type: 'jpeg', quality: 90 })
    const { data, info } = await pixels(jpg)
    expect(info.width).toBe(120)
    expect(info.height).toBe(80)
    let worst = 0
    for (let i = 0; i < data.length; i += info.channels) {
      worst = Math.max(
        worst,
        Math.abs(data[i]! - GROUND.r),
        Math.abs(data[i + 1]! - GROUND.g),
        Math.abs(data[i + 2]! - GROUND.b),
      )
    }
    expect(worst).toBeLessThan(12)
  })
})
