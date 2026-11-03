import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { findBrowserPath, getBrowser, renderFrame } from '../server/screenshot'
import { effectiveSafeZone } from '../shared/prowin/safeZones'
import { FORMAT_PRESETS } from '../shared/prowin/formats'
import * as actions from '../server/actions.ts'
import { withUserPermissions } from '../server/prowin/permissions.ts'
import { store } from '../server/store.ts'
import type { Canvas, Frame } from '../shared/types'

/**
 * TASK-33 Task 3 Round 2: pixel evidence that the real export path carries
 * no overlay. Every rendered fixture uses a real preset with canonical size
 * plus a valid nonzero override, so `effectiveSafeZone` is nonzero for BOTH
 * PNG and JPG — a renderer that paints an overlay only under a real
 * effective zone cannot pass. Set and reset are each rendered per format.
 */

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

const CREATOR = 'creator-id'
const creatorActor = { name: 'Creator', kind: 'user', color: '#111' } as const
const GROUND = { r: 0x12, g: 0x34, b: 0x56 }
const SOLID =
  '<!doctype html><html><head><style>*{margin:0;box-sizing:border-box}</style></head>' +
  '<body style="margin:0;background:#123456">' +
  '<div style="width:100vw;height:100vh;background:#123456"></div></body></html>'
const OVERRIDE = { top: 10, right: 20, bottom: 30, left: 40 }

function seedCanvas() {
  store.init([
    {
      id: 'ctx',
      name: 'Ctx',
      ownerId: CREATOR,
      memberIds: [],
      frames: [],
      createdAt: 1,
      updatedAt: 1,
    } as unknown as Canvas,
  ])
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

async function makeZonedFrame(): Promise<Frame> {
  let frame!: Frame
  await withUserPermissions(CREATOR, () => {
    frame = actions.createFrame('ctx', { name: 'Solid', preset: 'ig-post', html: SOLID }, { ...creatorActor })!
  })
  // Canonical preset size.
  expect(frame.width).toBe(FORMAT_PRESETS['ig-post'].width)
  expect(frame.height).toBe(FORMAT_PRESETS['ig-post'].height)
  await withUserPermissions(CREATOR, () => {
    actions.updateFrame(frame.id, { safeZoneOverride: { ...OVERRIDE } }, { ...creatorActor })
  })
  return store.getFrame(frame.id)!
}

function assertNonzeroZone(f: Frame) {
  const zone = effectiveSafeZone(f)
  expect(zone).not.toBeNull()
  expect(Object.values(zone!).reduce((sum, n) => sum + n, 0)).toBeGreaterThan(0)
  expect(f.html).not.toContain('data-safe-zone')
}

async function pixels(buf: Buffer): Promise<{ data: Buffer; info: sharp.OutputInfo }> {
  return sharp(buf).raw().toBuffer({ resolveWithObject: true })
}

function expectSolidGround(data: Buffer, channels: number) {
  for (let i = 0; i < data.length; i += channels) {
    expect([data[i], data[i + 1], data[i + 2]]).toEqual([GROUND.r, GROUND.g, GROUND.b])
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  seedCanvas()
})

describe.skipIf(!findBrowserPath())('safe-zone export isolation in real Chromium', { timeout: 120_000 }, () => {
  afterAll(async () => {
    await getBrowser().then((b) => b.close().catch(() => {}))
  })

  it('renders PNG pixel-identical with the override set vs reset under a valid zone', async () => {
    const frame = await makeZonedFrame()
    assertNonzeroZone(frame)
    expect(effectiveSafeZone(frame)).toEqual(OVERRIDE)
    const pngSet = await renderFrame({ ...frame }, 1, { type: 'png' })

    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(frame.id, { safeZoneOverride: null }, { ...creatorActor })
    })
    const reset = store.getFrame(frame.id)!
    // Reset falls back to the nonzero preset default — still a real zone.
    assertNonzeroZone(reset)
    expect(effectiveSafeZone(reset)).toEqual(FORMAT_PRESETS['ig-post'].safe)
    const pngReset = await renderFrame({ ...reset }, 1, { type: 'png' })

    const a = await pixels(pngSet)
    const b = await pixels(pngReset)
    expect(a.info.width).toBe(1080)
    expect(a.info.height).toBe(1080)
    expect(b.info).toMatchObject({ width: 1080, height: 1080, channels: a.info.channels })
    expect(Buffer.compare(a.data, b.data)).toBe(0)
    // Solid ground everywhere: no overlay band painted a single pixel.
    expectSolidGround(a.data, a.info.channels)
    expectSolidGround(b.data, b.info.channels)
  })

  it('paints no overlay tint into the JPG export with the override set and after reset', async () => {
    const frame = await makeZonedFrame()
    assertNonzeroZone(frame)
    expect(effectiveSafeZone(frame)).toEqual(OVERRIDE)
    const jpgSet = await renderFrame({ ...frame }, 1, { type: 'jpeg', quality: 90 })

    await withUserPermissions(CREATOR, () => {
      actions.updateFrame(frame.id, { safeZoneOverride: null }, { ...creatorActor })
    })
    const reset = store.getFrame(frame.id)!
    assertNonzeroZone(reset)
    const jpgReset = await renderFrame({ ...reset }, 1, { type: 'jpeg', quality: 90 })

    for (const buf of [jpgSet, jpgReset]) {
      const { data, info } = await pixels(buf)
      expect(info.width).toBe(1080)
      expect(info.height).toBe(1080)
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
    }
  })
})
