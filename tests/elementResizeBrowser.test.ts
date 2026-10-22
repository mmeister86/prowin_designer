import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { Frame } from '../shared/types'
import type { ElementInfo, GeometryEdit } from '../src/lib/frameBridge'

declare global {
  interface Window {
    elementPanelHarness: {
      seed: (frame: Frame) => void
      remote: (frame: Frame) => void
      select: (selector: string) => void
      selectFrame: () => void
      deselect: () => void
      setTool: (tool: 'select' | 'hand') => void
      setZoom: (zoom: number) => void
      undo: () => Promise<void>
      geometry: (selector: string, edit: GeometryEdit) => Promise<ElementInfo | null>
      redo: () => Promise<void>
    }
  }
}

const HTML = `<!doctype html><html><head><style>
  body { margin: 0; padding: 20px }
  #box { width: 200px; height: 100px; background: #ddd }
  #pad { width: 200px; height: 100px; padding: 10px; background: #cfc }
  #text { width: 300px; font: 16px/20px Arial }
  #locked { width: 120px; height: 40px; background: #fcc }
</style></head><body>
  <div id="box"></div>
  <div id="pad"></div>
  <p id="text">A paragraph with <span id="run">an inline run</span> of text.</p>
  <img id="pic" width="160" height="80" alt="" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='80'%3E%3C/svg%3E">
  <div id="locked" data-doop-locked=""></div>
  <div id="scaled" style="width: 100px; height: 50px; transform: scale(2); transform-origin: 0 0; background: #ccf"></div>
  <div id="turned" style="width: 100px; height: 50px; margin-top: 60px; transform: rotate(30deg); background: #fcf"></div>
</body></html>`

describe.skipIf(!findBrowserPath())('element resize handles', () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let saved: Frame
  let saves = 0
  const errors: string[] = []

  async function handle(name: string) {
    const box = await page.$eval(`[data-resize-handle="${name}"]`, (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })
    return box
  }
  async function drag(name: string, dx: number, dy: number, { shift = false } = {}) {
    const from = await handle(name)
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    if (shift) await page.keyboard.down('Shift')
    await page.mouse.move(from.x + dx / 2, from.y + dy / 2)
    await page.mouse.move(from.x + dx, from.y + dy, { steps: 4 })
    await page.mouse.up()
    if (shift) await page.keyboard.up('Shift')
  }
  async function select(selector: string) {
    await page.evaluate((s) => window.elementPanelHarness.select(s), selector)
    /* the grips are there, and on this element: a previous selection's
       grips must not be the ones the drag grabs */
    const frame = (await frameDoc())!
    const box = await frame.$eval(selector, (el) => el.getBoundingClientRect().toJSON() as DOMRect)
    await page.waitForFunction(
      (b: DOMRect) => {
        const grips = document.querySelector<HTMLElement>('[data-resize-handles]')
        return !!grips && parseFloat(grips.style.width) === b.width && parseFloat(grips.style.height) === b.height
      },
      {},
      box,
    )
  }
  /* every case starts from the seeded document, with the frame selected */
  async function reset() {
    await page.evaluate(() => window.elementPanelHarness.deselect())
    await page.waitForFunction(() => !document.querySelector('[data-resize-handles]'))
    saved = { ...saved, html: HTML, updatedAt: saved.updatedAt + 1 }
    await page.evaluate((frame) => window.elementPanelHarness.seed(frame), saved)
    await page.evaluate(() => window.elementPanelHarness.selectFrame())
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => {
      const box = document.querySelector('#box')
      return !!box && !box.getAttribute('style')
    })
  }
  function frameDoc() {
    return page.$('iframe').then((h) => h!.contentFrame())
  }
  async function computed(selector: string, prop: 'width' | 'height') {
    const frame = (await frameDoc())!
    return frame.$eval(selector, (el, p) => getComputedStyle(el)[p as 'width'], prop)
  }

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
        saves += 1
        saved = { ...saved, ...JSON.parse(request.postData()!) }
        await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) })
      } else await request.continue()
    })
    await page.goto(`${vite.resolvedUrls!.local[0]}tests/fixtures/elementPanel.html`)
    await page.waitForFunction(() => !!window.elementPanelHarness)
    saved = {
      id: 'f',
      canvasId: 'c',
      name: 'Resize',
      x: 40,
      y: 60,
      width: 600,
      height: 500,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: 'Tester',
      html: HTML,
    }
    await reset()
  }, 60_000)

  afterAll(async () => {
    await page?.screenshot({ path: '/tmp/doop-element-resize.png' })
    await page?.close()
    await browser?.close()
    await vite?.close()
    expect(errors).toEqual([])
  })

  it('drags the corner to resize, saving once and recording one undo step', async () => {
    await select('#box')
    expect(
      await page.$$eval('[data-resize-handle]', (els) => els.map((e) => e.getAttribute('data-resize-handle'))),
    ).toEqual(['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'])
    expect(await page.$eval('[data-element-size]', (el) => el.textContent)).toBe('200 × 100')
    const before = saves
    const gripBefore = await handle('e')
    await drag('se', 50, 30)
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '250px')
    expect(await computed('#box', 'height')).toBe('130px')
    await expect.poll(() => saved.html).toContain('width: 250px; height: 130px')
    expect(saves - before).toBe(1)
    await page.screenshot({ path: '/tmp/doop-element-resize-grips.png' })
    /* the outline, its grips and the size badge follow the new box */
    const grip = await handle('e')
    expect(Math.round(grip.x - gripBefore.x)).toBe(50)
    expect(await page.$eval('[data-element-size]', (el) => el.textContent)).toBe('250 × 130')

    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '200px')
    expect(await computed('#box', 'height')).toBe('100px')
    expect(saved.html).not.toContain('width: 250px')
  }, 20_000)

  it('moves one axis from an edge and leaves the other alone', async () => {
    await reset()
    await select('#text')
    await drag('e', -60, 0)
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).width === '240px')
    await expect.poll(() => saved.html).toContain('<p id="text" style="width: 240px;">')
  }, 20_000)

  it('grows from the computed size, so a padded content box keeps its padding', async () => {
    await reset()
    await select('#pad')
    /* pulled from the west corner, outward: the box still grows */
    await drag('nw', -20, 0)
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#pad')!).width === '220px')
    expect(await frame.$eval('#pad', (el) => el.getBoundingClientRect().width)).toBe(240)
  }, 20_000)

  it('keeps the aspect ratio with Shift', async () => {
    await reset()
    await select('#pic')
    await drag('se', 80, 0, { shift: true })
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#pic')!).width === '240px')
    expect(await computed('#pic', 'height')).toBe('120px')
  }, 20_000)

  it('converts screen pixels at the stage zoom', async () => {
    await reset()
    await page.evaluate(() => window.elementPanelHarness.setZoom(0.5))
    await select('#box')
    await drag('s', 0, 25)
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).height === '150px')
    await expect.poll(() => saved.html).toContain('height: 150px')
    await page.evaluate(() => window.elementPanelHarness.setZoom(1))
  }, 20_000)

  it('puts the element back on Escape without saving', async () => {
    await reset()
    await select('#box')
    const before = saves
    const from = await handle('e')
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 40, from.y, { steps: 3 })
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '240px')
    await page.keyboard.press('Escape')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '200px')
    await page.mouse.up()
    await new Promise((r) => setTimeout(r, 400))
    expect(saves).toBe(before)
  }, 20_000)

  it('lets go of the ratio when Shift is released mid-drag', async () => {
    await reset()
    await select('#box')
    const from = await handle('e')
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.keyboard.down('Shift')
    await page.mouse.move(from.x + 40, from.y, { steps: 3 })
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).height === '120px')
    await page.keyboard.up('Shift')
    await page.mouse.move(from.x + 60, from.y, { steps: 3 })
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '260px')
    await page.mouse.up()
    await expect.poll(() => saved.html).toContain('<div id="box" style="width: 260px;"></div>')
    expect(await computed('#box', 'height')).toBe('100px')
  }, 20_000)

  it('files each gesture on release as its own undo step', async () => {
    await reset()
    await select('#box')
    const before = saves
    const htmls: string[] = []
    const seen = () => {
      if (saved.html !== htmls.at(-1)) htmls.push(saved.html)
    }
    await drag('e', 20, 0)
    await expect.poll(() => saved.html).toContain('width: 220px')
    seen()
    await drag('e', 20, 0)
    await expect.poll(() => saved.html).toContain('width: 240px')
    seen()
    expect(saves - before).toBe(2)
    /* the first save carried the first gesture only; the second, the whole */
    expect(htmls[0]).toContain('<div id="box" style="width: 220px;"></div>')
    expect(htmls[1]).toContain('<div id="box" style="width: 240px;"></div>')
    /* each gesture is its own discrete undo step, never coalesced */
    const frame = (await frameDoc())!
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '220px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '200px')
  }, 20_000)

  it('keeps a later panel edit when an earlier save echoes back', async () => {
    await reset()
    await select('#text')
    await page.waitForSelector('[aria-label="Align center"]')
    /* three edits faster than the settle delay: the first two are filed
       early, and their echo must not morph the live document backwards */
    const frame = (await frameDoc())!
    await page.click('[aria-label="Align right"]')
    await page.click('[aria-label="Align center"]')
    await page.click('[aria-label="Justify"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'justify')
    await expect.poll(() => saved.html).toContain('text-align: justify')
    await new Promise((r) => setTimeout(r, 400))
    expect(await frame.$eval('#text', (el) => getComputedStyle(el).textAlign)).toBe('justify')
  }, 20_000)

  it('puts the element back when the grips leave mid-drag', async () => {
    await reset()
    await select('#box')
    const before = saves
    const from = await handle('e')
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(from.x + 40, from.y, { steps: 3 })
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '240px')
    /* the Hand tool takes the stage: the grips unmount with the drag unfinished */
    await page.evaluate(() => window.elementPanelHarness.setTool('hand'))
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).width === '200px')
    await page.mouse.up()
    await new Promise((r) => setTimeout(r, 400))
    expect(saves).toBe(before)
    await page.evaluate(() => window.elementPanelHarness.setTool('select'))
  }, 20_000)

  it("divides the drag by a scaled element's render scale, and skips a rotated one", async () => {
    await reset()
    await select('#scaled')
    expect(await page.$eval('[data-element-size]', (el) => el.textContent)).toBe('200 × 100')
    await drag('e', 40, 0)
    const frame = (await frameDoc())!
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#scaled')!).width === '120px')
    await page.waitForFunction(() => document.querySelector('[data-element-size]')?.textContent === '240 × 100')
    await page.evaluate((s) => window.elementPanelHarness.select(s), '#turned')
    await page.waitForFunction(() => !document.querySelector('[data-resize-handles]'))
  }, 20_000)

  it('offers no grips on an inline run or a locked layer', async () => {
    await reset()
    await page.evaluate((s) => window.elementPanelHarness.select(s), '#run')
    await page.waitForFunction(() => !document.querySelector('[data-resize-handles]'))
    await page.evaluate((s) => window.elementPanelHarness.select(s), '#locked')
    await new Promise((r) => setTimeout(r, 300))
    expect(await page.$('[data-resize-handles]')).toBeNull()
  }, 20_000)
})
