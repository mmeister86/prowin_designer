import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { Canvas, Frame } from '../shared/types'
import { freePort, startServer, type Server } from './harness'

const TOP_HTML =
  '<div data-od-id="t1" data-od-role="headline" style="position:absolute;top:10px;left:10px;width:200px;height:40px">Titel</div>' +
  '<div data-od-id="b1" data-od-role="body" style="position:absolute;top:1000px;left:10px;width:200px;height:40px">Text</div>'
const MOVED_HTML =
  '<div data-od-id="t1" data-od-role="headline" style="position:absolute;top:1000px;left:10px;width:200px;height:40px">Titel</div>' +
  '<div data-od-id="b1" data-od-role="body" style="position:absolute;top:1100px;left:10px;width:200px;height:40px">Text</div>'

describe.skipIf(!findBrowserPath())('safe-zone overlay in real Chromium', { timeout: 60_000 }, () => {
  let vite: ViteDevServer
  let server: Server
  let browser: Browser
  let page: Page
  let canvasId: string
  let origin: string

  beforeAll(async () => {
    const port = await freePort()
    vite = await createServer({
      logLevel: 'error',
      server: {
        port: 0,
        proxy: {
          '/api': { target: `http://localhost:${port}` },
          '/ws': { target: `ws://localhost:${port}`, ws: true },
        },
      },
    })
    await vite.listen()
    origin = vite.resolvedUrls!.local[0]!.replace(/\/$/, '')
    server = await startServer({ PORT: String(port), BETTER_AUTH_URL: origin })
    browser = await getBrowser()
    page = await browser.newPage()
    page.setDefaultTimeout(15_000)
    await page.setViewport({ width: 1400, height: 900 })
    await page.goto(origin)
    await page.evaluate(async () => {
      const signup = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Zone Tester', email: 'zone-ui@test.dev', password: 'password12345' }),
      })
      if (!signup.ok) throw new Error(await signup.text())
      const creator = await fetch('/api/prowin/creator', { method: 'POST' })
      if (!creator.ok) throw new Error(await creator.text())
    })
  }, 60_000)

  beforeEach(async () => {
    await page.setViewport({ width: 1400, height: 900 })
    canvasId = await page.evaluate(async () => {
      const response = await fetch('/api/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Zone UI' }),
      })
      if (!response.ok) throw new Error(await response.text())
      return (await response.json()).id
    })
  })

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    await server?.stop()
  })

  async function createStory(html: string): Promise<Frame> {
    const frame = (await page.evaluate(
      async (args) => {
        const response = await fetch(`/api/canvases/${args.canvasId}/frames`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Story', preset: 'ig-story', html: args.html }),
        })
        if (!response.ok) throw new Error(await response.text())
        return response.json()
      },
      { canvasId, html },
    )) as Frame
    await page.goto(`${origin}/c/${canvasId}`)
    await page.waitForSelector('[data-safe-zone-overlay]')
    return frame
  }

  const storedHtml = (id: string) =>
    page.evaluate(
      async (args) => {
        const response = await fetch(`/api/canvases/${args.canvasId}`)
        if (!response.ok) throw new Error(await response.text())
        const canvas = (await response.json()) as Canvas
        return canvas.frames.find((f) => f.id === args.id)!.html
      },
      { canvasId, id },
    )

  it('warns on the intruding headline and clears after the text moves into the safe area', async () => {
    const frame = await createStory(TOP_HTML)
    expect(frame).toMatchObject({ preset: 'ig-story' })
    // Four non-overlapping red bands; the headline intrudes the top margin.
    await page.waitForSelector('[data-safe-zone-warn]')
    expect(await page.$$('[data-safe-zone-band]')).toHaveLength(4)
    const before = await storedHtml(frame.id)
    expect(before).not.toContain('data-safe-zone')

    // Move the headline into the inner rectangle: the warning clears.
    await page.evaluate(
      async (args) => {
        const response = await fetch(`/api/frames/${args.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ html: args.html }),
        })
        if (!response.ok) throw new Error(await response.text())
      },
      { id: frame.id, html: MOVED_HTML },
    )
    await page.waitForFunction(() => !document.querySelector('[data-safe-zone-warn]'))
    expect(await page.$$('[data-safe-zone-band]')).toHaveLength(4)

    // Neither the stored HTML nor the live iframe carries warning DOM.
    expect(await storedHtml(frame.id)).not.toContain('data-safe-zone')
    const leaked = await page.evaluate(() =>
      [...document.querySelectorAll('iframe')].some((iframe) =>
        iframe.contentDocument?.querySelector('[data-safe-zone-overlay],[data-safe-zone-band],[data-safe-zone-warn]'),
      ),
    )
    expect(leaked).toBe(false)
  }, 60_000)

  it('toggle hides the overlay, override/reset reshape the bands, stored HTML stays clean', async () => {
    const frame = await createStory(TOP_HTML)
    const baseline = await storedHtml(frame.id)
    // ig-story defaults: top 200, bottom 250.
    const bandHeights = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-safe-zone-band]')].map((el) => el.style.height),
    )
    expect(bandHeights).toEqual(['200px', '250px', '1470px', '1470px'])

    // Local toggle off hides bands and warnings together; on restores them.
    await page.evaluate(() => localStorage.setItem('doop:safe-zones', '0'))
    await page.reload()
    await page.waitForSelector(`iframe[title="${frame.name}"]`)
    await page.waitForFunction(() => !document.querySelector('[data-safe-zone-overlay]'))
    await page.evaluate(() => localStorage.setItem('doop:safe-zones', '1'))
    await page.reload()
    await page.waitForSelector('[data-safe-zone-warn]')

    // Creator override replaces every margin; null reset restores the preset.
    await page.evaluate(async (id) => {
      const response = await fetch(`/api/frames/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeZoneOverride: { top: 50, right: 50, bottom: 50, left: 50 } }),
      })
      if (!response.ok) throw new Error(await response.text())
    }, frame.id)
    await page.waitForFunction(
      () =>
        JSON.stringify(
          [...document.querySelectorAll<HTMLElement>('[data-safe-zone-band]')].map((el) => el.style.height),
        ) === JSON.stringify(['50px', '50px', '1820px', '1820px']),
    )
    await page.evaluate(async (id) => {
      const response = await fetch(`/api/frames/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ safeZoneOverride: null }),
      })
      if (!response.ok) throw new Error(await response.text())
    }, frame.id)
    await page.waitForFunction(
      () =>
        JSON.stringify(
          [...document.querySelectorAll<HTMLElement>('[data-safe-zone-band]')].map((el) => el.style.height),
        ) === JSON.stringify(['200px', '250px', '1470px', '1470px']),
    )
    // Policy edits never touch the stored document.
    const after = await storedHtml(frame.id)
    expect(after).not.toContain('data-safe-zone')
    expect(after).toBe(baseline)
    expect(
      (
        await page.evaluate(async (id) => {
          const response = await fetch(`/api/canvases/${id}`)
          return ((await response.json()) as Canvas).frames
        }, canvasId)
      ).find((f) => f.id === frame.id),
    ).not.toHaveProperty('safeZoneOverride')
  }, 60_000)
})
