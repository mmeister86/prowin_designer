import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { Canvas, Frame } from '../shared/types'
import { freePort, startServer, type Server } from './harness'

const TOP_HTML =
  '<div data-od-id="t1" data-od-role="headline" style="position:absolute;top:10px;left:10px;width:200px;height:40px">Titel</div>' +
  '<div data-od-id="b1" data-od-role="body" style="position:absolute;top:1000px;left:10px;width:200px;height:40px">Text</div>'
/* A live-only layout shift: the script runs inside the frame after render and
   moves the headline without any parent save — the overlay must follow the
   mutation/resource notification while the stored document stays put. */
const LATE_HTML =
  '<div data-od-id="t1" data-od-role="headline" style="position:absolute;top:10px;left:10px;width:200px;height:40px">Titel</div>' +
  '<script>setTimeout(function(){var el=document.querySelector(\'[data-od-id="t1"]\');if(el)el.style.top="1000px"},800)</script>'
const CONTENTS_HTML =
  '<div style="display:contents"><div data-od-id="w1" data-od-role="headline" style="position:absolute;top:10px;left:10px;width:200px;height:40px">Titel</div></div>' +
  '<div data-od-id="b1" data-od-role="body" style="position:absolute;top:1000px;left:10px;width:200px;height:40px">Text</div>'
const MANY_HTML = Array.from(
  { length: 201 },
  (_, i) =>
    `<div data-od-id="r${i}" data-od-role="body" style="position:absolute;top:${i}px;left:10px;width:50px;height:1px">x</div>`,
).join('')

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

  /* Open the Inspector through the real canvas control: a click on the
     frame's name label (no API, no store access from the test). */
  async function openInspector(frameName: string): Promise<void> {
    const pt = await page.evaluate((name) => {
      const spans = [...document.querySelectorAll('span')].filter(
        (s) =>
          s.textContent?.trim() === name &&
          !s.closest('[role="treeitem"]') &&
          !s.closest('[role="dialog"]') &&
          !s.closest('[role="menu"]'),
      )
      for (const span of spans) {
        const box = (span.closest('div') ?? span).getBoundingClientRect()
        if (box.width > 0 && box.height > 0 && box.bottom > 0 && box.top < innerHeight) {
          return { x: box.left + Math.min(30, box.width / 2), y: box.top + box.height / 2 }
        }
      }
      return null
    }, frameName)
    if (!pt) throw new Error('frame name label not visible')
    await page.mouse.click(pt.x, pt.y)
    await page.waitForSelector('input[aria-label="Name der Zeichenfläche"]')
  }

  async function clickTextButton(text: string): Promise<void> {
    await page.waitForFunction(
      (label) => [...document.querySelectorAll('button')].some((b) => b.textContent?.trim() === label),
      {},
      text,
    )
    await page.evaluate(
      (label) =>
        ([...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label) as HTMLElement).click(),
      text,
    )
  }

  async function setInput(label: string, value: string): Promise<void> {
    const selector = `input[aria-label="${label}"]`
    await page.waitForSelector(selector)
    await page.click(selector)
    await page.keyboard.down('Control')
    await page.keyboard.press('a')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
    if (value) await page.type(selector, value)
  }

  async function setTextarea(selector: string, value: string): Promise<void> {
    await page.waitForSelector(selector)
    await page.click(selector)
    await page.keyboard.down('Control')
    await page.keyboard.press('a')
    await page.keyboard.up('Control')
    await page.keyboard.press('Backspace')
    await page.type(selector, value)
  }

  it('warns on the intruding headline and clears after a real Inspector edit moves it', async () => {
    const frame = await createStory(TOP_HTML)
    expect(frame).toMatchObject({ preset: 'ig-story' })
    // Four non-overlapping red bands; the headline intrudes the top margin.
    await page.waitForSelector('[data-safe-zone-warn]')
    expect(await page.$$('[data-safe-zone-band]')).toHaveLength(4)
    const before = await storedHtml(frame.id)
    expect(before).not.toContain('data-safe-zone')

    // Move the headline through the actual HTML editor control, not the API.
    // The stored document carries the full template (brand styles included):
    // replace it wholesale with the moved variant through real keystrokes.
    await openInspector(frame.name)
    await page.click('button[title="HTML bearbeiten"]')
    const codeSelector = 'textarea[placeholder="<!doctype html>…"]'
    const full = await page.$eval(codeSelector, (el) => (el as HTMLTextAreaElement).value)
    await setTextarea(codeSelector, full.replace('top:10px', 'top:1000px'))
    await page.waitForFunction(() => !document.querySelector('[data-safe-zone-warn]'))
    expect(await page.$$('[data-safe-zone-band]')).toHaveLength(4)

    // Neither the stored HTML nor the live iframe carries warning DOM.
    const after = await storedHtml(frame.id)
    expect(after).not.toContain('data-safe-zone')
    expect(after).toContain('top:1000px')
    const leaked = await page.evaluate(() =>
      [...document.querySelectorAll('iframe')].some((iframe) =>
        iframe.contentDocument?.querySelector('[data-safe-zone-overlay],[data-safe-zone-band],[data-safe-zone-warn]'),
      ),
    )
    expect(leaked).toBe(false)
  }, 120_000)

  it('toggle, Creator save and reset work through real controls; stored HTML stays clean', async () => {
    const frame = await createStory(TOP_HTML)
    const baseline = await storedHtml(frame.id)
    // ig-story defaults: top 200, bottom 250.
    const bandHeights = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-safe-zone-band]')].map((el) => el.style.height),
    )
    expect(bandHeights).toEqual(['200px', '250px', '1470px', '1470px'])

    // The Creator draft starts from the effective preset insets, not blank.
    await openInspector(frame.name)
    expect(await page.$eval('input[aria-label="Abstand oben"]', (el) => (el as HTMLInputElement).value)).toBe('200')

    // Local toggle off hides bands and reports the hidden state; on restores.
    await page.click('input[aria-label="Safe-Zone-Warnungen anzeigen"]')
    await page.waitForFunction(() => !document.querySelector('[data-safe-zone-overlay]'))
    expect(await page.$eval('[role="status"]', (el) => el.textContent)).toMatch(/ausgeblendet/i)
    await page.click('input[aria-label="Safe-Zone-Warnungen anzeigen"]')
    await page.waitForSelector('[data-safe-zone-warn]')

    // Creator override replaces every margin; null reset restores the preset.
    for (const label of ['Abstand oben', 'Abstand rechts', 'Abstand unten', 'Abstand links']) {
      await setInput(label, '50')
    }
    await clickTextButton('Speichern')
    await page.waitForFunction(
      () =>
        JSON.stringify(
          [...document.querySelectorAll<HTMLElement>('[data-safe-zone-band]')].map((el) => el.style.height),
        ) === JSON.stringify(['50px', '50px', '1820px', '1820px']),
    )
    await clickTextButton('Zurücksetzen')
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
  }, 120_000)

  it('a late script-driven layout shift refreshes the overlay without touching stored HTML', async () => {
    const frame = await createStory(LATE_HTML)
    await page.waitForSelector('[data-safe-zone-warn]')
    // The frame's own script moves the headline ~800ms after render: the
    // mutation notification clears the warning with no parent save.
    await page.waitForFunction(() => !document.querySelector('[data-safe-zone-warn]'))
    expect(await page.$$('[data-safe-zone-band]')).toHaveLength(4)
    const after = await storedHtml(frame.id)
    expect(after).toContain('top:10px')
    expect(after).not.toContain('top:1000px')
    expect(after).not.toContain('data-safe-zone')
  }, 60_000)

  it('display:contents descendants warn and 201 boxes report incomplete', async () => {
    await createStory(CONTENTS_HTML)
    // The headline nested under display:contents still warns.
    await page.waitForSelector('[data-safe-zone-warn]')

    const crowded = await page.evaluate(
      async (args) => {
        const response = await fetch(`/api/canvases/${args.canvasId}/frames`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Crowded', preset: 'ig-story', html: args.html }),
        })
        if (!response.ok) throw new Error(await response.text())
        return response.json()
      },
      { canvasId, html: MANY_HTML },
    )
    void crowded
    await page.goto(`${origin}/c/${canvasId}`)
    // Both frames share the canvas: wait until the crowded one has mounted.
    await page.waitForFunction(() => document.querySelectorAll('iframe[data-doop-frame]').length === 2)
    await openInspector('Crowded')
    // 201 visible roles exceed the 200-box bound: never trusted success.
    await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('unvollständig'))
  }, 60_000)

  it('a hidden tab suspends measurement and refreshes on return', async () => {
    await createStory(TOP_HTML)
    await page.waitForSelector('[data-safe-zone-warn]')
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    // Measured warnings clear while hidden (static margin bands stay put);
    // no request fires until the tab is visible again.
    await page.waitForFunction(() => !document.querySelector('[data-safe-zone-warn]'))
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForSelector('[data-safe-zone-warn]')
  }, 60_000)
})
