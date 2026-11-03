// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { downloadFrameHtml } from '../src/lib/frameExport'
import { effectiveSafeZone } from '../shared/prowin/safeZones'
import type { Frame } from '../shared/types'

/**
 * TASK-33 Task 3 Round 2: exercise the application's actual HTML download
 * path (`Inspector` → `downloadFrameHtml(frame, draft)` → Blob bytes), not
 * the MCP `get_frame` transport. Both the default stored-HTML call and the
 * explicit draft argument must save byte-identical content with no overlay.
 */

const STORED = '<!doctype html><html><head><title>T</title></head><body><h1>Hi</h1></body></html>'
const DRAFT = '<!doctype html><html><head><title>T</title></head><body><h1>Hi edited</h1></body></html>'

const OVERRIDE = { top: 10, right: 20, bottom: 30, left: 40 }

function frame(): Frame {
  return {
    id: 'dl-frame',
    canvasId: 'ctx',
    name: 'Poster',
    x: 0,
    y: 0,
    width: 1080,
    height: 1080,
    preset: 'ig-post',
    safeZoneOverride: { ...OVERRIDE },
    html: STORED,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'me',
  } as unknown as Frame
}

let blobs: Blob[]
let clicked: HTMLAnchorElement[]

beforeEach(() => {
  blobs = []
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob)
    return 'blob:download'
  }) as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
})

it('saves the stored HTML by default under a valid nonzero effective zone with no overlay', async () => {
  const f = frame()
  // Real policy: preset + valid nonzero override means a nonzero effective zone.
  const zone = effectiveSafeZone(f)
  expect(zone).toEqual(OVERRIDE)
  expect(Object.values(zone!).some((n) => n > 0)).toBe(true)
  expect(f.html).not.toContain('data-safe-zone')

  downloadFrameHtml(f)

  expect(clicked).toHaveLength(1)
  expect(clicked[0]!.download).toBe('Poster.html')
  expect(clicked[0]!.href).toBe('blob:download')
  expect(blobs).toHaveLength(1)
  const bytes = await blobs[0]!.text()
  expect(bytes).toBe(STORED)
  expect(bytes).not.toContain('data-safe-zone')
})

it('saves the draft argument byte-identically when the Inspector passes it', async () => {
  const f = frame()
  expect(effectiveSafeZone(f)).toEqual(OVERRIDE)

  downloadFrameHtml(f, DRAFT)

  expect(clicked).toHaveLength(1)
  expect(clicked[0]!.download).toBe('Poster.html')
  expect(blobs).toHaveLength(1)
  const bytes = await blobs[0]!.text()
  expect(bytes).toBe(DRAFT)
  expect(bytes).not.toContain('data-safe-zone')
})
