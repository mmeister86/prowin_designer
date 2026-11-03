// TASK-34 Task 2 fix round 1: strict font cleanup and page-side deadline.
// Focused puppeteer doubles (no browser): the page evaluation must carry its
// own deadline inside the same 8s font window, the isolated context must
// close on evaluation failure and server timeout, and both timers must clear.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '../shared/types'

const doubles = vi.hoisted(() => ({
  launch: vi.fn(),
  newPage: vi.fn(),
  closeContext: vi.fn(),
  evaluate: vi.fn(),
  screenshot: vi.fn(),
  setViewport: vi.fn(),
  setContent: vi.fn(),
}))

vi.mock('puppeteer-core', () => ({ default: { launch: doubles.launch } }))
vi.mock('../server/publicUrl.ts', () => ({ guardPublicPageRequests: vi.fn(async () => {}) }))

import { reloadEnv } from '../server/env.ts'
import { renderFrame } from '../server/screenshot.ts'

const frame: Frame = {
  id: 'cleanup',
  canvasId: 'c',
  name: 'Cleanup',
  x: 0,
  y: 0,
  width: 640,
  height: 360,
  html: '<!doctype html><html><body>hi</body></html>',
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 't',
}

/** The in-page font check, captured from the stubbed evaluate. Runs against a
 *  stubbed document, so the page-side deadline is observable without Chrome. */
type InPageCheck = () => Promise<unknown>
let captured: InPageCheck | null = null
let releaseOuter: ((value: unknown) => void) | null = null

function stubDocument(outcome: { ready: Promise<unknown>; faces: Array<{ status: string }> }) {
  vi.stubGlobal('document', {
    fonts: {
      ready: outcome.ready,
      [Symbol.iterator]: () => outcome.faces.values(),
    },
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  captured = null
  releaseOuter = null
  doubles.launch.mockReset().mockResolvedValue({
    createBrowserContext: async () => ({
      newPage: doubles.newPage,
      close: doubles.closeContext,
    }),
  })
  doubles.closeContext.mockReset().mockResolvedValue(undefined)
  doubles.setViewport.mockReset().mockResolvedValue(undefined)
  doubles.setContent.mockReset().mockResolvedValue(undefined)
  doubles.screenshot.mockReset().mockResolvedValue(Buffer.from('shot'))
  doubles.evaluate.mockReset().mockImplementation(async (fn: InPageCheck) => {
    captured = fn
    return new Promise((resolve) => {
      releaseOuter = resolve
    })
  })
  doubles.newPage.mockReset().mockResolvedValue({
    setViewport: doubles.setViewport,
    setContent: doubles.setContent,
    evaluate: doubles.evaluate,
    screenshot: doubles.screenshot,
  })
  vi.stubEnv('CHROME_PATH', process.execPath)
  reloadEnv()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  reloadEnv()
  vi.useRealTimers()
})

describe('strict font cleanup', () => {
  it('rejects through the page-side deadline when fonts never settle', async () => {
    const crashed = renderFrame(frame, 1, { requireSettledFonts: true })
    void crashed.catch(() => {})
    await vi.waitFor(() => {
      if (!captured) throw new Error('evaluate not reached yet')
    })
    stubDocument({ ready: new Promise(() => {}), faces: [] })
    const outcome = captured!()
    const settled = await Promise.race([
      outcome.then(
        () => 'resolved',
        () => 'rejected',
      ),
      vi.advanceTimersByTimeAsync(8000).then(() => 'advanced'),
    ])
    // the page evaluation enforces its own bound inside the font window
    expect(settled).toBe('rejected')
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the page timer when fonts settle before the deadline', async () => {
    const crashed = renderFrame(frame, 1, { requireSettledFonts: true })
    const done = crashed.then(
      () => 'resolved',
      () => 'rejected',
    )
    await vi.waitFor(() => {
      if (!captured) throw new Error('evaluate not reached yet')
    })
    stubDocument({ ready: Promise.resolve(), faces: [] })
    const failed = await captured!()
    expect(failed).toBe(0)
    // let the outer render finish so only timer leaks would remain
    releaseOuter!(0)
    await done
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the page timer when a used face fails', async () => {
    const crashed = renderFrame(frame, 1, { requireSettledFonts: true })
    const done = crashed.then(
      () => 'resolved',
      () => 'rejected',
    )
    await vi.waitFor(() => {
      if (!captured) throw new Error('evaluate not reached yet')
    })
    stubDocument({ ready: Promise.resolve(), faces: [{ status: 'error' }] })
    const failed = await captured!()
    expect(failed).toBe(1)
    releaseOuter!(1)
    await done
    expect(vi.getTimerCount()).toBe(0)
  })

  it('closes the isolated context when font readiness evaluation fails', async () => {
    doubles.evaluate.mockRejectedValueOnce(new Error('protocol boom'))
    await expect(renderFrame(frame, 1, { requireSettledFonts: true })).rejects.toMatchObject({
      name: 'UnsettledFontsError',
    })
    expect(doubles.closeContext).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('closes the isolated context on server timeout', async () => {
    const pending = renderFrame(frame, 1, { requireSettledFonts: true })
    const outcome = pending.then(
      () => 'resolved',
      (e: Error) => e.name,
    )
    const settled = await Promise.race([outcome, vi.advanceTimersByTimeAsync(8000).then(() => 'advanced' as const)])
    expect(settled).toBe('UnsettledFontsError')
    expect(doubles.closeContext).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('clears the server deadline and closes the context on success', async () => {
    doubles.evaluate.mockResolvedValueOnce(0)
    const buf = await renderFrame(frame, 1, { requireSettledFonts: true })
    expect(buf.toString()).toBe('shot')
    expect(doubles.closeContext).toHaveBeenCalledTimes(1)
    expect(vi.getTimerCount()).toBe(0)
  })
})
