import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Frame, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot.ts'

type Posted = { data: Record<string, unknown>; t: number }
type Fixture = { messages: Posted[]; testReady: boolean }

const TRANSITION_HTML =
  '<!doctype html><html><head><style>.into-margin{transform:translateY(-490px)}</style></head><body>' +
  '<div data-od-role="headline" id="t" style="position:absolute;top:500px;left:10px;width:200px;height:40px;transition:transform 1s linear">Titel</div>' +
  '</body></html>'
/* One visible intruder plus fully transparent content: opacity:0 on the
   element itself and on an ancestor. All roles stay covered — only the
   transparent boxes must be missing. */
const OPACITY_HTML =
  '<div data-od-role="headline" style="position:absolute;top:10px;left:10px;width:200px;height:40px;opacity:0">Unsichtbar</div>' +
  '<div style="opacity:0"><div data-od-role="body" style="position:absolute;top:10px;left:10px;width:200px;height:40px">Vererbt unsichtbar</div></div>' +
  '<div data-od-role="body" style="position:absolute;top:20px;left:10px;width:200px;height:40px">Sichtbar</div>'

// Advisory refresh is coalesced at 150 ms: a one-second transition settles
// long after the class-change notification, so only a completion listener
// remeasures the final geometry. No polling, no mid-flight tracking.
describe.skipIf(!findBrowserPath())('safe-zone runtime refresh in real Chromium', { timeout: 60_000 }, () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let seq = 0

  beforeAll(async () => {
    server = await createServer({ server: { port: 0 }, logLevel: 'error' })
    await server.listen()
    browser = await getBrowser()
    page = await browser.newPage()
    await page.goto(`${server.resolvedUrls!.local[0]}tests/fixtures/safeZoneRefresh.html`)
    await page.waitForFunction(() => (window as unknown as Fixture).testReady, { timeout: 60_000 })
  }, 60_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await server?.close()
  })

  const frame = (): Frame => page.frames().find((f) => f !== page.mainFrame())!

  async function render(html: string): Promise<void> {
    const reqId = `html-${++seq}`
    await page.evaluate((message) => document.querySelector('iframe')!.contentWindow!.postMessage(message, '*'), {
      type: 'doop:html',
      html,
      reqId,
    })
    await page.waitForFunction(
      (reqId) =>
        (window as unknown as Fixture).messages.some(
          (m) => m.data?.type === 'doop:html-result' && m.data?.reqId === reqId,
        ),
      {},
      reqId,
    )
  }

  async function measure(): Promise<{ status: unknown; boxes: { x: number; y: number }[] }> {
    const reqId = `sz-${++seq}`
    await page.evaluate((message) => document.querySelector('iframe')!.contentWindow!.postMessage(message, '*'), {
      type: 'doop:safe-zones',
      reqId,
    })
    await page.waitForFunction(
      (reqId) =>
        (window as unknown as Fixture).messages.some(
          (m) => m.data?.type === 'doop:safe-zones-result' && m.data?.reqId === reqId,
        ),
      {},
      reqId,
    )
    return page.evaluate(
      (reqId) =>
        (window as unknown as Fixture).messages.find(
          (m) => m.data?.type === 'doop:safe-zones-result' && m.data?.reqId === reqId,
        )!.data as { status: unknown; boxes: { x: number; y: number }[] },
      reqId,
    )
  }

  const updatedAfter = (t0: number, afterMs = 900) =>
    page.waitForFunction(
      (t0, afterMs) =>
        (window as unknown as Fixture).messages.some(
          (m) => m.data?.type === 'doop:frame-updated' && m.t > t0 + afterMs,
        ),
      { timeout: 15_000 },
      t0,
      afterMs,
    )

  it('a 1s class-triggered transform transition remeasures the final geometry', async () => {
    await render(TRANSITION_HTML)
    await new Promise((r) => setTimeout(r, 600))
    const t0 = await page.evaluate(() => performance.now())
    await frame().evaluate(() => {
      document.querySelector('#t')!.classList.add('into-margin')
    })
    // The transition itself runs in this Chromium: fail here on environment,
    // not on advisory staleness below.
    await frame().waitForFunction(
      () => getComputedStyle(document.querySelector('#t')!).transform === 'matrix(1, 0, 0, 1, 0, -490)',
      { timeout: 10_000 },
    )
    // The class change notifies mid-flight; only completion remeasures final.
    await updatedAfter(t0)
    await new Promise((r) => setTimeout(r, 500))
    const reply = await measure()
    expect(reply.status).toBe('ok')
    expect(reply.boxes).toHaveLength(1)
    expect(reply.boxes[0]!.y).toBeCloseTo(10, 0)
  })

  it('a transitioncancel event refreshes measurement', async () => {
    await render(TRANSITION_HTML)
    await new Promise((r) => setTimeout(r, 600))
    const t0 = await page.evaluate(() => performance.now())
    // Synthetic: no DOM churn, so only the cancellation listener can answer.
    // Its refresh follows the 150 ms coalesce, not a transition duration.
    await frame().evaluate(() => {
      document
        .querySelector('#t')!
        .dispatchEvent(new TransitionEvent('transitioncancel', { propertyName: 'transform', bubbles: true }))
    })
    await updatedAfter(t0, 0)
  })

  it('opacity:0 content is excluded while visible roles stay covered', async () => {
    await render(OPACITY_HTML)
    const reply = await measure()
    expect(reply.status).toBe('ok')
    expect(reply.boxes).toHaveLength(1)
    expect(reply.boxes[0]!.y).toBeCloseTo(20, 0)
  })
})
