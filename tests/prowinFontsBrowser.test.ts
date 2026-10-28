import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import type { Browser, Page } from 'puppeteer-core'
import { createServer, type Plugin, type ViteDevServer } from 'vite'
import { findBrowserPath, getBrowser, renderFrame } from '../server/screenshot.ts'
import { reloadEnv } from '../server/env.ts'
import type { Frame } from '../shared/types.ts'
import { freePort, startServer, type Server } from './harness.ts'

const WIDTH = 640
const HEIGHT = 360
const FAMILIES = [
  { name: 'Sofia Sans', file: 'sofia-sans', weights: [300, 500] },
  { name: 'Sofia Sans Condensed', file: 'sofia-sans-condensed', weights: [700] },
  { name: 'Roboto', file: 'roboto', weights: [300, 500, 900] },
] as const
const LATIN = 'U+0000-00FF,U+2000-206F,U+20AC,U+2122'
const LATIN_EXT = 'U+0100-02BA,U+1E00-1E9F'

type Fixture = { testReady: boolean; messages: Array<{ type: string; reqId?: string }> }

function referenceHTML(origin: string): string {
  const faces = FAMILIES.flatMap(({ name, file, weights }) =>
    weights.flatMap((weight) =>
      [
        { subset: 'latin', range: LATIN },
        { subset: 'latin-ext', range: LATIN_EXT },
      ].map(
        ({ subset, range }) =>
          `@font-face{font-family:'${name}';font-style:normal;font-display:swap;font-weight:${weight};src:url('${origin}/fonts/${file}-${subset}-${weight}-normal.woff2') format('woff2');unicode-range:${range}}`,
      ),
    ),
  ).join('\n')
  const samples = FAMILIES.map(
    ({ name, weights }) =>
      `<section>${weights.map((weight) => `<p style="font-family:'${name}';font-weight:${weight}">Łódź Đ — proWIN ${weight}</p>`).join('')}</section>`,
  ).join('')
  return `<!doctype html><html><head><style>${faces}\nhtml,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:#fff}body{display:grid;grid-template-columns:1fr 1fr;gap:0 12px;color:#111}section{padding:10px}p{margin:0 0 12px;font-size:22px;line-height:1.2;white-space:nowrap}</style></head><body>${samples}</body></html>`
}

function frame(html: string): Frame {
  return {
    id: 'font-reference',
    canvasId: 'font-test',
    name: 'Font reference',
    x: 0,
    y: 0,
    width: WIDTH,
    height: HEIGHT,
    html,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'test',
  }
}

function delayFonts(): Plugin {
  return {
    name: 'test-delay-prowin-fonts',
    configureServer(server) {
      server.middlewares.use('/fonts', async (req, _res, next) => {
        const stalled = req.url?.includes('stall=1')
        await new Promise((resolve) => setTimeout(resolve, stalled ? 20_000 : 300))
        next()
      })
    },
  }
}

describe.skipIf(!findBrowserPath())('proWIN browser and Chromium font parity', () => {
  let server: Server
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let origin: string
  let previousPort: string | undefined

  beforeAll(async () => {
    const port = await freePort()
    previousPort = process.env.PORT
    process.env.PORT = String(port)
    vite = await createServer({ plugins: [delayFonts()], server: { port: 0 }, logLevel: 'error' })
    await vite.listen()
    origin = vite.resolvedUrls!.local[0]!.replace(/\/$/, '')
    server = await startServer({ PORT: String(port), BETTER_AUTH_URL: origin })
    vi.stubEnv('BETTER_AUTH_URL', origin)
    reloadEnv()
    browser = await getBrowser()
    page = await browser.newPage()
    await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 })
    await page.goto(`${origin}/tests/fixtures/prowinFontReference.html`)
    await page.waitForFunction(
      () => {
        const fixture = window as unknown as Fixture
        return fixture.testReady && fixture.messages.some((message) => message.type === 'doop:frame-ready')
      },
      { timeout: 30_000 },
    )
  }, 60_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    server?.stop()
    await server?.stopped
    if (previousPort === undefined) delete process.env.PORT
    else process.env.PORT = previousPort
    vi.unstubAllEnvs()
    reloadEnv()
  })

  it('renders the delayed Latin and Latin-Ext reference identically in browser and export', async () => {
    const requests: string[] = []
    page.on('request', (request) => requests.push(request.url()))
    const html = referenceHTML(origin)
    await page.evaluate(
      (html) =>
        (window as unknown as { renderHTML: (html: string, reqId: string) => void }).renderHTML(html, 'font-reference'),
      html,
    )
    await page.waitForFunction(() =>
      (window as unknown as Fixture).messages.some(
        (message) => message.type === 'doop:html-result' && message.reqId === 'font-reference',
      ),
    )
    await new Promise((resolve) => setTimeout(resolve, 1_200))
    const browserPNG = Buffer.from(await page.screenshot({ type: 'png' }))
    const exportPNG = await renderFrame(frame(html))

    const fontRequests = [...new Set(requests.filter((url) => url.includes('/fonts/')))]
    expect(fontRequests).toHaveLength(12)
    expect(fontRequests.some((url) => url.includes('-latin-'))).toBe(true)
    expect(fontRequests.some((url) => url.includes('-latin-ext-'))).toBe(true)
    expect(
      requests.filter((url) => /^https?:/.test(url)).every((url) => new URL(url).origin === new URL(origin).origin),
    ).toBe(true)
    expect(exportPNG.equals(browserPNG)).toBe(true)
  }, 30_000)

  it('bounds the additional wait when a font never finishes loading', async () => {
    const html = `<!doctype html><html><head><style>@font-face{font-family:'Roboto';font-style:normal;font-weight:900;src:url('${origin}/fonts/roboto-latin-900-normal.woff2?stall=1') format('woff2')}body{font-family:'Roboto';font-weight:900}</style></head><body>Łódź Đ</body></html>`
    const started = Date.now()
    await renderFrame(frame(html))
    const elapsed = Date.now() - started
    expect(elapsed).toBeGreaterThanOrEqual(15_000)
    expect(elapsed).toBeLessThan(19_000)
  }, 25_000)
})
