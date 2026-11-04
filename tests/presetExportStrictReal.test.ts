// TASK-34 Task 2 RED: strict settled-font boundary in real Chromium.
// Fails on current code: renderFrame has no requireSettledFonts option —
// strict renders succeed where they must reject (missing/corrupt/stalled/
// below-fold fonts), and there is no UnsettledFontsError.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import path from 'node:path'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createServer, type Plugin, type ViteDevServer } from 'vite'
import { findBrowserPath, getBrowser, renderFrame } from '../server/screenshot.ts'
import { reloadEnv } from '../server/env.ts'
import type { Frame } from '../shared/types.ts'
import { freePort, startServer, type Server } from './harness.ts'

const GOOD = 'roboto-latin-900-normal.woff2'

function frame(html: string, over: Partial<Frame> = {}): Frame {
  return {
    id: 'strict-font',
    canvasId: 'strict-font-test',
    name: 'Strict font',
    x: 0,
    y: 0,
    width: 640,
    height: 360,
    html,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'test',
    ...over,
  }
}

const strictOpts = { requireSettledFonts: true } as const

function fontBehavior(getOrigin: () => string): Plugin {
  return {
    name: 'test-strict-prowin-fonts',
    configureServer(server) {
      server.middlewares.use('/fonts', async (req, _res, next) => {
        const stalled = req.url?.includes('stall=1')
        const slow = req.url?.includes('slow=1')
        await new Promise((resolve) => setTimeout(resolve, stalled ? 20_000 : slow ? 300 : 0))
        next()
      })
      server.middlewares.use('/fonts/corrupt-test.woff2', (_req, res) => {
        res.setHeader('Content-Type', 'font/woff2')
        res.end(Buffer.from('not-a-font-at-all'))
      })
      server.middlewares.use('/fonts/tall-check.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css')
        res.end(
          `@font-face{font-family:'Below';font-style:normal;font-weight:400;src:url('${getOrigin()}/fonts/does-not-exist-400.woff2') format('woff2')}.below{font-family:'Below'}`,
        )
      })
      server.middlewares.use('/fonts/dpr-check.css', (_req, res) => {
        res.setHeader('Content-Type', 'text/css')
        res.end(
          `@font-face{font-family:'Dpr';font-style:normal;font-weight:400;src:url('${getOrigin()}/fonts/does-not-exist-400.woff2') format('woff2')}.dpr{font-family:'Dpr'}`,
        )
      })
    },
  }
}

describe.skipIf(!findBrowserPath())('strict preset-download font boundary in real Chromium', () => {
  let server: Server
  let vite: ViteDevServer
  let origin: string
  let previousPort: string | undefined
  let fontCacheDir: string | undefined

  beforeAll(async () => {
    const port = await freePort()
    previousPort = process.env.PORT
    process.env.PORT = String(port)
    fontCacheDir = mkdtempSync(path.join(tmpdir(), 'prowin-strict-font-'))
    vite = await createServer({
      cacheDir: fontCacheDir,
      plugins: [fontBehavior(() => origin)],
      server: { port: 0 },
      logLevel: 'error',
    })
    await vite.listen()
    origin = vite.resolvedUrls!.local[0]!.replace(/\/$/, '')
    server = await startServer({ PORT: String(port), BETTER_AUTH_URL: origin })
    vi.stubEnv('BETTER_AUTH_URL', origin)
    reloadEnv()
  }, 60_000)

  afterAll(async () => {
    await getBrowser()
      .then((b) => b.close().catch(() => {}))
      .catch(() => {})
    await vite?.close()
    if (fontCacheDir) rmSync(fontCacheDir, { recursive: true, force: true })
    await server?.stop()
    if (previousPort === undefined) delete process.env.PORT
    else process.env.PORT = previousPort
    vi.unstubAllEnvs()
    reloadEnv()
  })

  it('succeeds when a delayed brand font settles, matching the lenient bytes', async () => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:'Roboto';font-style:normal;font-weight:900;src:url('${origin}/fonts/${GOOD}?slow=1') format('woff2')}body{font-family:'Roboto';font-weight:900}</style></head><body>Delayed brand Łódź</body></html>`
    const strict = await renderFrame(frame(html), 1, { ...strictOpts })
    const lenient = await renderFrame(frame(html))
    expect(strict.equals(lenient)).toBe(true)
  }, 60_000)

  it('rejects a used face that 404s, with no bytes and a controlled error', async () => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:'Nope';font-style:normal;font-weight:400;src:url('${origin}/fonts/does-not-exist-400.woff2') format('woff2')}body{font-family:'Nope'}</style></head><body>Missing face</body></html>`
    const err = await renderFrame(frame(html), 1, { ...strictOpts }).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe('UnsettledFontsError')
    expect((err as Error).message).not.toContain('http')
  }, 60_000)

  it('rejects a used face whose bytes are corrupt', async () => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:'Corrupt';font-style:normal;font-weight:400;src:url('${origin}/fonts/corrupt-test.woff2') format('woff2')}body{font-family:'Corrupt'}</style></head><body>Corrupt face</body></html>`
    await expect(renderFrame(frame(html), 1, { ...strictOpts })).rejects.toMatchObject({
      name: 'UnsettledFontsError',
    })
  }, 60_000)

  it('succeeds when a declared face is never used (stays unloaded)', async () => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:'Unused';font-style:normal;font-weight:400;src:url('${origin}/fonts/does-not-exist-400.woff2') format('woff2');unicode-range:U+0400-04FF}body{font-family:'Unused',sans-serif}</style></head><body>Plain ASCII only</body></html>`
    const buf = await renderFrame(frame(html), 1, { ...strictOpts })
    expect(buf.length).toBeGreaterThan(0)
  }, 60_000)

  it('rejects a stalled used font before 20s with no bytes', async () => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:'Roboto';font-style:normal;font-weight:900;src:url('${origin}/fonts/${GOOD}?stall=1') format('woff2')}body{font-family:'Roboto';font-weight:900}</style></head><body>Stalled Łódź</body></html>`
    const started = Date.now()
    await expect(renderFrame(frame(html), 1, { ...strictOpts })).rejects.toMatchObject({
      name: 'UnsettledFontsError',
    })
    expect(Date.now() - started).toBeLessThan(20_000)
  }, 30_000)

  it('checks fonts gated on the final viewport height (tall frames beyond the cap)', async () => {
    // The stylesheet only applies at viewport heights the capped inspection
    // viewport never reaches — strict must establish the final full-height
    // viewport before content load, or this font is never requested.
    const html = `<!doctype html><html><head><link rel="stylesheet" href="${origin}/fonts/tall-check.css" media="(min-height: 4001px)"><style>body{margin:0}</style></head><body><div class="below" style="height:360px">Viewport-gated font</div></body></html>`
    const tall = frame(html, { height: 6000 })
    await expect(renderFrame(tall, 1, { ...strictOpts })).rejects.toMatchObject({
      name: 'UnsettledFontsError',
    })
    // lenient inspection-height capture never matches the gate: succeeds
    const lenient = await renderFrame(tall)
    expect(lenient.length).toBeGreaterThan(0)
  }, 60_000)

  it('checks fonts selected only at final device scale (density-gated)', async () => {
    // The stylesheet only applies at the export density (A4 renders at
    // 3.125x): strict must establish the final scale before content load, or
    // this font is never requested.
    const html = `<!doctype html><html><head><link rel="stylesheet" href="${origin}/fonts/dpr-check.css" media="(min-resolution: 3dppx)"><style>body{margin:0}</style></head><body><div class="dpr" style="height:160px">Density-gated font</div></body></html>`
    const f = frame(html, { width: 320, height: 160 })
    await expect(renderFrame(f, 3.125, { ...strictOpts })).rejects.toMatchObject({
      name: 'UnsettledFontsError',
    })
    // lenient 1x capture never matches the gate: succeeds
    const lenient = await renderFrame(f, 1)
    expect(lenient.length).toBeGreaterThan(0)
  }, 60_000)

  it('keeps rendering after strict failures (isolated contexts are closed)', async () => {
    const bad = `<!doctype html><html><head><style>@font-face{font-family:'Nope';src:url('${origin}/fonts/does-not-exist-400.woff2')}body{font-family:'Nope'}</style></head><body>x</body></html>`
    for (let i = 0; i < 3; i++) {
      await expect(renderFrame(frame(bad), 1, { ...strictOpts })).rejects.toMatchObject({
        name: 'UnsettledFontsError',
      })
    }
    const good = await renderFrame(frame('<!doctype html><html><body>fine</body></html>'), 1, { ...strictOpts })
    expect(good.length).toBeGreaterThan(0)
  }, 120_000)
})
