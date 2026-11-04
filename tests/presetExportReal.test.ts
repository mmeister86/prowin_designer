// TASK-34 Task 1 RED: real-Chromium preset export dimensions via getImage.
// Fails on current code: getImage ignores preset/download (always req.scale).
import { afterAll, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import { FORMAT_PRESETS, type FormatPresetId } from '../shared/prowin/formats.ts'
import { effectiveSafeZone } from '../shared/prowin/safeZones.ts'
import * as actions from '../server/actions.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import { store } from '../server/store.ts'
import type { Canvas, Frame } from '../shared/types'

vi.mock('../server/db/persist.ts', () => ({
  saveFrame: vi.fn(),
  saveCanvas: vi.fn(),
  saveActivity: vi.fn(),
  saveTask: vi.fn(),
  saveFeedback: vi.fn(),
  saveComment: vi.fn(),
  saveDecision: vi.fn(),
  saveProposal: vi.fn(),
  saveGuideline: vi.fn(),
  deleteGuideline: vi.fn(),
  saveGuidelineVersion: vi.fn(),
  listGuidelineVersions: () => [],
  saveReference: vi.fn(),
  deleteReference: vi.fn(),
  saveFrameVersion: vi.fn(),
  listFrameVersions: async () => [],
  getFrameVersion: vi.fn(),
  saveCanvasCopy: vi.fn(),
  savePageCopy: vi.fn(),
  saveMember: vi.fn(),
  deleteMember: vi.fn(),
  deleteCanvas: vi.fn(),
  deleteFrame: vi.fn(),
  flush: async () => {},
  hydrate: async () => ({}),
  importLegacyJson: async () => null,
}))
vi.mock('../server/prowin/accounts.ts', () => ({
  permissionIdentity: async (userId: string) => ({ userId, admin: false, creator: userId === 'creator-id' }),
}))

import { getImage } from '../server/previews.ts'

const CREATOR = 'creator-id'
const creatorActor = { name: 'Creator', kind: 'user', color: '#111' } as const
const GROUND = { r: 0x12, g: 0x34, b: 0x56 }
const SOLID =
  '<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}</style></head>' +
  '<body style="margin:0;background:#123456">' +
  '<div style="width:100vw;height:100vh;background:#123456"></div></body></html>'

let seq = 0
function seedCanvas() {
  store.init([
    { id: 'ctx', name: 'Ctx', ownerId: CREATOR, memberIds: [], frames: [], createdAt: 1, updatedAt: 1 },
  ] as unknown as Canvas[])
  actions.wire(
    () => {},
    () => {},
  )
  actions.hydrateLogs({
    tasks: new Map([['ctx', []]]),
    feedback: new Map([['ctx', []]]),
    comments: new Map([['ctx', []]]),
    activity: new Map([['ctx', []]]),
    decisions: new Map([['ctx', []]]),
    proposals: new Map([['ctx', []]]),
  })
}

async function makeFrame(input: Record<string, unknown>): Promise<Frame> {
  let frame!: Frame
  await withUserPermissions(CREATOR, () => {
    frame = actions.createFrame('ctx', { name: 'Solid', html: SOLID, ...input }, { ...creatorActor })!
  })
  return store.getFrame(frame.id)!
}

async function renderDownload(f: Frame, ext: 'png' | 'jpg'): Promise<Buffer> {
  const r = await getImage(f, {
    ext,
    quality: 90,
    preview: false,
    download: true,
    ip: `real-${seq++}`,
    isAuthenticated: () => Promise.resolve(false),
  } as never)
  if (r.status !== 'ok') throw new Error(`render failed: ${r.status}`)
  return r.buf
}

async function dims(buf: Buffer): Promise<{ width: number; height: number }> {
  const { info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height }
}

/** Mean absolute deviation from ground + edge sample, one assertion pair. */
async function expectSolidGround(buf: Buffer, tolerance: number) {
  const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  const ch = info.channels
  let worst = 0
  let sum = 0
  const n = info.width * info.height
  for (let i = 0; i < data.length; i += ch) {
    const d = Math.max(
      Math.abs(data[i]! - GROUND.r),
      Math.abs(data[i + 1]! - GROUND.g),
      Math.abs(data[i + 2]! - GROUND.b),
    )
    if (d > worst) worst = d
    sum += d
  }
  expect(worst).toBeLessThanOrEqual(tolerance)
  expect(sum / n).toBeLessThanOrEqual(tolerance / 3)
  // edges: no overlay band or letterbox — sample first/last rows and columns
  const at = (x: number, y: number) => (y * info.width + x) * ch
  for (const [x, y] of [
    [0, 0],
    [info.width - 1, 0],
    [0, info.height - 1],
    [info.width - 1, info.height - 1],
    [Math.floor(info.width / 2), 0],
    [Math.floor(info.width / 2), info.height - 1],
  ] as const) {
    const o = at(x, y)
    expect(Math.abs(data[o]! - GROUND.r)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(data[o + 1]! - GROUND.g)).toBeLessThanOrEqual(tolerance)
    expect(Math.abs(data[o + 2]! - GROUND.b)).toBeLessThanOrEqual(tolerance)
  }
}

describe.skipIf(!findBrowserPath())('preset export dimensions in real Chromium', { timeout: 180_000 }, () => {
  afterAll(async () => {
    await getBrowser().then((b) => b.close().catch(() => {}))
  })

  const PRESETS = ['ig-post', 'ig-story', 'wa-status', 'fb-post', 'a4'] as const satisfies FormatPresetId[]

  it.each(PRESETS)('renders %s downloads at hardcoded export pixels (png+jpg)', async (preset) => {
    // Hardcoded export pixels per preset — not derived from production
    // constants, so a factor regression fails here rather than agreeing
    // with itself.
    const expected: Record<FormatPresetId, { width: number; height: number }> = {
      'ig-post': { width: 1080, height: 1080 },
      'ig-story': { width: 1080, height: 1920 },
      'wa-status': { width: 1080, height: 1920 },
      'fb-post': { width: 1200, height: 630 },
      a4: { width: 2481, height: 3509 },
    }
    seedCanvas()
    const f = await makeFrame({ preset })
    expect(f.width).toBe(FORMAT_PRESETS[preset].width)
    expect(f.height).toBe(FORMAT_PRESETS[preset].height)
    for (const ext of ['png', 'jpg'] as const) {
      const buf = await renderDownload(f, ext)
      const { width, height } = await dims(buf)
      expect(width).toBe(expected[preset].width)
      expect(height).toBe(expected[preset].height)
      await expectSolidGround(buf, ext === 'png' ? 0 : 12)
    }
  })

  it('renders A4 at exactly 2481×3509', async () => {
    seedCanvas()
    const f = await makeFrame({ preset: 'a4' })
    for (const ext of ['png', 'jpg'] as const) {
      const { width, height } = await dims(await renderDownload(f, ext))
      expect(width).toBe(2481)
      expect(height).toBe(3509)
    }
  })

  it('renders a free 101×77 frame at 202×154', async () => {
    seedCanvas()
    const f = await makeFrame({ width: 101, height: 77 })
    expect(f.preset).toBeUndefined()
    for (const ext of ['png', 'jpg'] as const) {
      const { width, height } = await dims(await renderDownload(f, ext))
      expect(width).toBe(202)
      expect(height).toBe(154)
    }
  })

  it('renders a fractional free 100.4×200.6 frame at 200×402 (png+jpg)', async () => {
    seedCanvas()
    const f = await makeFrame({ width: 100.4, height: 200.6 })
    expect(f.preset).toBeUndefined()
    expect(f.width).toBe(100.4)
    for (const ext of ['png', 'jpg'] as const) {
      const { width, height } = await dims(await renderDownload(f, ext))
      expect(width).toBe(200)
      expect(height).toBe(402)
    }
  })

  it('renders fractional creator-resized A4 at 313×628 (png+jpg)', async () => {
    seedCanvas()
    const f = await makeFrame({ preset: 'a4' })
    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(f.id, { width: 100.4, height: 200.6 }, { ...creatorActor })
    })
    const resized = store.getFrame(f.id)!
    expect(resized.preset).toBe('a4')
    expect(resized.width).toBe(100.4)
    for (const ext of ['png', 'jpg'] as const) {
      const { width, height } = await dims(await renderDownload(resized, ext))
      // viewport 100×201 × 3.125, per-axis rounded — not 314 from stored×scale
      expect(width).toBe(313)
      expect(height).toBe(628)
    }
  })

  it('exports creator-resized preset frames at actual stored geometry, not canonical', async () => {
    seedCanvas()
    const f = await makeFrame({ preset: 'ig-post' })
    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(f.id, { width: 500, height: 400 }, { ...creatorActor })
    })
    const resized = store.getFrame(f.id)!
    expect(resized.preset).toBe('ig-post')
    const { width, height } = await dims(await renderDownload(resized, 'png'))
    // actual stored geometry × factor (1), NOT the canonical 1080×1080
    expect(width).toBe(500)
    expect(height).toBe(400)
  })

  it('paints no overlay under a nonzero safeZoneOverride', async () => {
    seedCanvas()
    const f = await makeFrame({ preset: 'ig-post' })
    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(f.id, { safeZoneOverride: { top: 10, right: 20, bottom: 30, left: 40 } }, { ...creatorActor })
    })
    const zoned = store.getFrame(f.id)!
    const zone = effectiveSafeZone(zoned)
    expect(zone).not.toBeNull()
    expect(Object.values(zone!).reduce((s, n) => s + n, 0)).toBeGreaterThan(0)
    expect(zoned.html).not.toContain('data-safe-zone')
    await expectSolidGround(await renderDownload(zoned, 'png'), 0)
  })
})
