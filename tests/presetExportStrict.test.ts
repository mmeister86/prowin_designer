// TASK-34 Task 2 RED: strict settled-font boundary for preset downloads.
// Fails on current code: getImage never passes requireSettledFonts, strict
// downloads share the lenient cache key, and primeImage accepts any number.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '../shared/types'

const mocks = vi.hoisted(() => ({ renderFrame: vi.fn() }))
vi.mock('../server/screenshot.ts', () => ({ renderFrame: mocks.renderFrame }))
vi.mock('../server/storage.ts', () => ({
  putObject: vi.fn(async () => {}),
  getObject: vi.fn(async () => null),
  deleteObject: vi.fn(async () => {}),
}))

import { getImage, primeImage } from '../server/previews.ts'

let seq = 0
const frame = (over: Partial<Frame> = {}): Frame =>
  ({
    id: `s${seq++}`,
    canvasId: 'c',
    name: 'f',
    x: 0,
    y: 0,
    width: 640,
    height: 480,
    html: '',
    updatedAt: 1,
    updatedBy: 't',
    ...over,
  }) as Frame

const base = (over: Record<string, unknown> = {}) => ({
  ext: 'png' as const,
  quality: 90,
  preview: false,
  ip: `strict-ip${seq++}`,
  isAuthenticated: () => Promise.resolve(false),
  ...over,
})

function fontFailure(): Error {
  const e = new Error('1 font failed to settle')
  e.name = 'UnsettledFontsError'
  return e
}

beforeEach(() => {
  mocks.renderFrame.mockReset().mockResolvedValue(Buffer.from('rendered'))
})

describe('strict preset-download boundary', () => {
  it('passes requireSettledFonts only for preset downloads', async () => {
    const preset = frame({ preset: 'ig-post' })
    await getImage(preset, base({ download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(preset, 1, expect.objectContaining({ requireSettledFonts: true }))

    mocks.renderFrame.mockClear()
    await getImage(preset, base({ scale: 2, download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(preset, 2, expect.objectContaining({ requireSettledFonts: true }))
  })

  it('leaves ordinary previews, views and agent screenshots lenient', async () => {
    const preset = frame({ preset: 'ig-post' })
    await getImage(preset, base({}))
    expect(mocks.renderFrame).toHaveBeenCalledWith(
      preset,
      1,
      expect.not.objectContaining({ requireSettledFonts: true }),
    )

    mocks.renderFrame.mockClear()
    await getImage(preset, base({ preview: true, ext: 'jpg' }))
    expect(mocks.renderFrame).not.toHaveBeenCalledWith(
      preset,
      expect.anything(),
      expect.objectContaining({ requireSettledFonts: true }),
    )
  })

  it('leaves free-frame downloads lenient even with broken external fonts', async () => {
    const free = frame()
    await getImage(free, base({ download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(free, 2, expect.not.objectContaining({ requireSettledFonts: true }))
  })

  it('does not serve primed/lenient bytes to a strict download at the same scale', async () => {
    const preset = frame({ preset: 'ig-post' })
    primeImage(preset, 1, Buffer.from('primed'))
    const r = await getImage(preset, base({ download: true }))
    expect(r.status).toBe('ok')
    expect(mocks.renderFrame).toHaveBeenCalledTimes(1)
    if (r.status === 'ok') expect(r.buf.toString()).not.toBe('primed')
  })

  it('single-flights concurrent strict downloads', async () => {
    mocks.renderFrame.mockImplementation(() => new Promise((res) => setTimeout(() => res(Buffer.from('x')), 50)))
    const preset = frame({ preset: 'a4' })
    const req = () => base({ download: true })
    const [a, b] = await Promise.all([getImage(preset, req()), getImage(preset, req())])
    expect(a.status).toBe('ok')
    expect(b.status).toBe('ok')
    expect(mocks.renderFrame).toHaveBeenCalledTimes(1)
  })

  it('evicts a failed strict render so the next request retries', async () => {
    mocks.renderFrame.mockRejectedValueOnce(fontFailure())
    const preset = frame({ preset: 'ig-post' })
    const req = () => base({ download: true })
    await expect(getImage(preset, req())).rejects.toMatchObject({ name: 'UnsettledFontsError' })
    await expect(getImage(preset, req()).then((r) => r.status)).resolves.toBe('ok')
    expect(mocks.renderFrame).toHaveBeenCalledTimes(2)
  })

  it('still meters strict downloads against the render budget', async () => {
    const ip = `strict-budget${seq++}`
    mocks.renderFrame.mockResolvedValue(Buffer.from('x'))
    for (let i = 0; i < 12; i++) {
      await getImage(frame({ preset: 'ig-post' }), base({ download: true, ip }))
    }
    expect((await getImage(frame({ preset: 'ig-post' }), base({ download: true, ip }))).status).toBe('rate-limited')
  })

  it('primeImage only seeds lenient 1x/2x captures, never fractional export scales', () => {
    const f = frame()
    primeImage(f, 1, Buffer.from('one'))
    primeImage(f, 2, Buffer.from('two'))
    // @ts-expect-error primeImage must not accept fractional export scales like 3.125
    primeImage(f, 3.125, Buffer.from('fractional'))
  })
})
