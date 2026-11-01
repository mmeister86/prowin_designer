import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { Frame } from '../shared/types'

/* window.elementPanelHarness is ambiently declared by the sibling browser
   tests sharing tests/fixtures/elementPanel.html (extended with `notice`). */

/* Breaks caught here: ElementPanel resolving policy from stored HTML only,
   which disables styles for script-generated elements absent from it — even
   in plain frames — while showing the stale notice. The live inspect policy
   must win once loaded: plain generated editable, frozen generated
   read-only, script-added locks blocking, stale selectors keeping the
   inspector contract. Real FrameView + ElementPanel, real evaluated runtime. */
describe.skipIf(!findBrowserPath())('element panel live template policy', { timeout: 30_000 }, () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let savedHtml = ''
  const errors: string[] = []

  beforeAll(async () => {
    vite = await createServer({ server: { port: 0 }, logLevel: 'error' })
    await vite.listen()
    browser = await getBrowser()
    page = await browser.newPage()
    page.setDefaultTimeout(5_000)
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.setViewport({ width: 1000, height: 900 })
    await page.setRequestInterception(true)
    page.on('request', async (request) => {
      if (new URL(request.url()).pathname === '/api/frames/f' && request.method() === 'PATCH') {
        savedHtml = JSON.parse(request.postData()!).html as string
        await request.respond({ status: 200, contentType: 'application/json', body: request.postData()! })
      } else await request.continue()
    })
    await page.goto(`${vite.resolvedUrls!.local[0]}tests/fixtures/elementPanel.html`)
    await page.waitForFunction(() => !!window.elementPanelHarness)
  }, 60_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    expect(errors).toEqual([])
  })

  async function seedFrame(html: string) {
    savedHtml = ''
    const frame: Frame = {
      id: 'f',
      canvasId: 'c',
      name: 'Policy',
      x: 40,
      y: 60,
      width: 600,
      height: 500,
      html,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: 'Tester',
    }
    await page.evaluate((value) => window.elementPanelHarness.seed(value), frame)
    return (await (await page.$('iframe'))!.contentFrame())!
  }

  async function panelReady() {
    await page.waitForSelector('input[aria-label="Breite"]')
  }

  it('keeps a script-generated element in a plain frame editable', async () => {
    const frame = await seedFrame(
      '<!doctype html><html><head></head><body><div id="box" style="width:120px;height:80px">Box</div></body></html>',
    )
    await frame.waitForSelector('#box')
    await frame.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<p id="gen">Generated</p>')
    })
    await page.evaluate(() => window.elementPanelHarness.select('#gen'))
    await panelReady()
    /* no stale banner, no dimmed lock: the live policy (plain frame) wins */
    expect(await page.$('[role="status"]')).toBeNull()
    expect(await page.$('div[aria-disabled="true"]')).toBeNull()
    /* and a real style edit lands through the runtime save path */
    await page.click('input[aria-label="Breite"]', { count: 3 })
    await page.keyboard.press('Backspace')
    await page.type('input[aria-label="Breite"]', '140')
    await page.keyboard.press('Enter')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#gen')!).width === '140px')
    await expect.poll(() => savedHtml).toContain('width: 140px')
  }, 20_000)

  it('shows a generated element in a frozen template area as read-only', async () => {
    const frame = await seedFrame(
      '<!doctype html><html><head></head><body><section data-od-id="f1" data-od-role="headline"><h1>T</h1></section></body></html>',
    )
    await frame.waitForSelector('[data-od-id="f1"]')
    await frame.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<div id="frz"><p id="frzt">x</p></div>')
    })
    await page.evaluate(() => window.elementPanelHarness.select('#frzt'))
    await panelReady()
    await page.waitForFunction(() =>
      document.querySelector('[role="status"]')?.textContent?.includes('schreibgeschützt'),
    )
    expect(await page.$('div[aria-disabled="true"]')).not.toBeNull()
    expect(savedHtml).toBe('')
  }, 20_000)

  it('shows an unsafe field descendant as read-only but keeps a safe span editable', async () => {
    const frame = await seedFrame(
      '<!doctype html><html><head></head><body><div data-od-id="f1" data-od-role="body"><p id="u">Text</p><span id="ok">frei</span></div></body></html>',
    )
    await frame.waitForSelector('[data-od-id="f1"]')
    /* a p wrapper inside the field is selectable but read-only */
    await page.evaluate(() => window.elementPanelHarness.select('#u'))
    await panelReady()
    await page.waitForFunction(() =>
      document.querySelector('[role="status"]')?.textContent?.includes('schreibgeschützt'),
    )
    expect(await page.$('div[aria-disabled="true"]')).not.toBeNull()
    /* a span directly in the same field stays editable */
    await page.evaluate(() => window.elementPanelHarness.select('#ok'))
    await panelReady()
    await page.waitForFunction(() => !document.querySelector('[role="status"]'))
    expect(await page.$('div[aria-disabled="true"]')).toBeNull()
    expect(savedHtml).toBe('')
  }, 20_000)

  it('blocks a generated element under a script-added lock', async () => {
    const frame = await seedFrame(
      '<!doctype html><html><head></head><body><div id="box" style="width:120px;height:80px">Box</div></body></html>',
    )
    await frame.waitForSelector('#box')
    await frame.evaluate(() => {
      document.body.insertAdjacentHTML('beforeend', '<p id="lk">x</p>')
      document.querySelector('#lk')!.setAttribute('data-od-locked', 'true')
    })
    /* a locked element is never selectable: the pick is dropped, and the
       lock explains itself instead of reporting the element as gone */
    await page.evaluate(() => window.elementPanelHarness.select('#lk'))
    await page.waitForFunction(() => window.elementPanelHarness.selected() === null)
    await page.waitForFunction(() => (window.elementPanelHarness.notice() ?? '').includes('gesperrt'))
    expect(savedHtml).toBe('')
  }, 20_000)

  it('keeps the stale contract for selectors the live document cannot resolve', async () => {
    await seedFrame('<!doctype html><html><head></head><body><div id="box">Box</div></body></html>')
    await page.evaluate(() => window.elementPanelHarness.select('#removed'))
    /* the pick is dropped instead of standing in for a selection */
    await page.waitForFunction(() => window.elementPanelHarness.selected() === null)
    await page.waitForFunction(() => (window.elementPanelHarness.notice() ?? '').includes('existiert nicht mehr'))
  }, 20_000)
})
