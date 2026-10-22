import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { Frame } from '../shared/types'

declare global {
  interface Window {
    elementPanelHarness: {
      seed: (frame: Frame) => void
      select: (selector: string) => void
      undo: () => Promise<void>
      redo: () => Promise<void>
    }
  }
}

describe.skipIf(!findBrowserPath())('element design controls', () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let saved: Frame
  let seedId = 0
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
      // The delayed-font test releases this stylesheet after the panel's first read.
      if (new URL(request.url()).pathname === '/tests/fixtures/late-font.css') return
      if (new URL(request.url()).pathname === '/api/frames/f' && request.method() === 'PATCH') {
        saved = { ...saved, ...JSON.parse(request.postData()!) }
        await request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(saved) })
      } else await request.continue()
    })
    await page.goto(`${vite.resolvedUrls!.local[0]}tests/fixtures/elementPanel.html`)
    await page.waitForFunction(() => !!window.elementPanelHarness)
    saved = {
      id: 'f',
      canvasId: 'c',
      name: 'Typography',
      x: 40,
      y: 60,
      width: 600,
      height: 500,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: 'Tester',
      html: `<!doctype html><html><head><style>
        @font-face { font-family: "Editorial Face"; src: local("Arial"); font-weight: 400 }
        @font-face { font-family: "Editorial Face"; src: local("Arial"); font-weight: 700 }
        @font-face { font-family: "Display Face"; src: local("Courier New") }
        body { font-family: "Editorial Face", serif; padding: 24px }
        p { font-size: 24px; width: 450px }
      </style></head><body>
        <p id="text">Typography controls should edit the selected text and save it to the frame.</p>
        <p id="rtl" dir="rtl">مرحبا بالعالم</p>
        <p id="rtl-end" dir="rtl" style="text-align:end">مرحبا بالعالم</p>
      </body></html>`,
    }
    await page.evaluate((frame) => window.elementPanelHarness.seed(frame), saved)
    const iframe = (await (await page.waitForSelector('iframe'))!.contentFrame())!
    await iframe.waitForSelector('#text')
    await page.evaluate(() => window.elementPanelHarness.select('#text'))
    await page.waitForSelector('select[aria-label="Font family"]')
  }, 60_000)

  afterAll(async () => {
    await page?.screenshot({ path: '/tmp/doop-element-typography.png' })
    await page?.close()
    await browser?.close()
    await vite?.close()
    expect(errors).toEqual([])
  })

  it('edits fonts and alignment through the sandbox, persists them, and supports undo and RTL', async () => {
    const selector = 'select[aria-label="Font family"]'
    const frame = (await (await page.$('iframe'))!.contentFrame())!
    const initial = await page.$eval(selector, (el) => (el as HTMLSelectElement).value)
    expect(initial).toBe('"Editorial Face", serif')
    expect(
      await page.$$eval(
        `${selector} option`,
        (options) => options.filter((o) => o.textContent === 'Editorial Face').length,
      ),
    ).toBe(1)
    expect(await page.$eval('[aria-label="Align left"]', (el) => el.getAttribute('data-state'))).toBe('on')

    await page.select(selector, 'Georgia, serif')
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#text')!).fontFamily === 'Georgia, serif',
    )
    await expect.poll(() => saved.html).toContain('font-family: Georgia, serif')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await page.waitForFunction(
      (value) => document.querySelector<HTMLSelectElement>('select[aria-label="Font family"]')?.value === value,
      {},
      initial,
    )
    expect(await frame.$eval('#text', (el) => getComputedStyle(el).fontFamily)).toBe(initial)

    const displayFace = await page.$eval(
      selector,
      (el) =>
        Array.from((el as HTMLSelectElement).options).find((option) => option.textContent === 'Display Face')!.value,
    )
    await page.select(selector, displayFace)
    await frame.waitForFunction(() =>
      getComputedStyle(document.querySelector('#text')!).fontFamily.includes('Display Face'),
    )
    await page.select(selector, 'Georgia, serif')
    await page.click('[aria-label="Align center"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'center')
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Align right')
    await page.keyboard.press('Space')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'right')
    await page.click('[aria-label="Justify"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'justify')
    await expect.poll(() => saved.html).toContain('text-align: justify')
    await page.screenshot({ path: '/tmp/doop-element-typography.png' })

    await page.evaluate(() => window.elementPanelHarness.select('#rtl'))
    await page.waitForSelector('[aria-label="Align right"][data-state="on"]')
    await page.waitForFunction(() => !document.querySelector('[aria-busy]'))
    expect(await page.$eval(selector, (el) => (el as HTMLSelectElement).value)).toBe(initial)
    await page.evaluate(() => window.elementPanelHarness.select('#rtl-end'))
    await page.waitForSelector('[aria-label="Align left"][data-state="on"]')
    await page.waitForFunction(() => !document.querySelector('[aria-busy]'))
    await page.click('[aria-label="Align center"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#rtl-end')!).textAlign === 'center')
    expect(await frame.$eval('#text', (el) => getComputedStyle(el).textAlign)).toBe('justify')
  }, 30_000)

  it('offers unused fonts when a linked stylesheet arrives after inspection', async () => {
    const stylesheetRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/tests/fixtures/late-font.css',
    )
    saved = {
      ...saved,
      html: `<!doctype html><html><head>
        <link rel="stylesheet" href="/tests/fixtures/late-font.css">
      </head><body>
        <p id="late-text" style="font-family:Arial,sans-serif">Waiting for font choices</p>
      </body></html>`,
    }
    await page.evaluate((frame) => window.elementPanelHarness.seed(frame), saved)
    const frame = (await (await page.$('iframe'))!.contentFrame())!
    await frame.waitForSelector('#late-text')
    await page.evaluate(() => window.elementPanelHarness.select('#late-text'))
    await page.waitForFunction(
      () =>
        document.querySelector<HTMLSelectElement>('select[aria-label="Font family"]')?.value === 'Arial, sans-serif',
    )
    const options = 'select[aria-label="Font family"] option'
    expect(await page.$$eval(options, (options) => options.map((o) => o.textContent))).not.toContain('Late Arrival')

    await (
      await stylesheetRequest
    ).respond({
      status: 200,
      contentType: 'text/css',
      body: '@font-face { font-family: "Late Arrival"; src: local("Arial") }',
    })
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('select[aria-label="Font family"] option')).some(
        (option) => option.textContent === 'Late Arrival',
      ),
    )
    // The font is unused: no font load (and hence no loadingdone event) was needed.
    expect(
      await frame.evaluate(
        () => Array.from(document.fonts).find((font) => font.family.includes('Late Arrival'))?.status,
      ),
    ).toBe('unloaded')
  }, 15_000)
  async function seedScrubTarget(
    styles = 'width:120px;height:80px;min-width:1.5rem;padding:4px 8px 12px 16px;gap:6px;column-gap:10px;opacity:0.8;border-left:2px solid black;border-radius:3px;font-size:18px',
  ) {
    const seed = String(++seedId)
    saved = {
      ...saved,
      html: `<!doctype html><html><body data-seed="${seed}">
        <div id="scrub" style="${styles}">Scrub me</div>
        <div id="other" style="width:200px">Another element</div>
      </body></html>`,
    }
    await page.evaluate((frame) => window.elementPanelHarness.seed(frame), saved)
    const frame = (await (await page.$('iframe'))!.contentFrame())!
    await frame.waitForFunction((seed) => document.body.dataset.seed === seed, {}, seed)
    await page.evaluate(() => window.elementPanelHarness.select('#scrub'))
    const width = await frame.$eval('#scrub', (el) => String(parseFloat(getComputedStyle(el).width)))
    await page.waitForFunction(
      (width) => document.querySelector<HTMLInputElement>('[aria-label="Width"]')?.value === width,
      {},
      width,
    )
    return frame
  }

  async function startScrub(label: string) {
    const unit = (await page.$(`label:has(input[aria-label="${label}"]) > span`))!
    await unit.scrollIntoView()
    expect(await unit.evaluate((el) => getComputedStyle(el).cursor)).toBe('ew-resize')
    const box = (await unit.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    await page.mouse.move(x, y)
    await page.mouse.down()
    return { x, y }
  }

  async function drag(label: string, dx: number, modifier?: 'Shift' | 'Alt') {
    const { x, y } = await startScrub(label)
    if (modifier) await page.keyboard.down(modifier)
    await page.mouse.move(x + dx, y, { steps: 5 })
    await page.mouse.up()
    if (modifier) await page.keyboard.up(modifier)
  }

  it('scrubs live in both directions, saves, and undoes/redoes the edit', async () => {
    const frame = await seedScrubTarget()
    const original = saved.html
    const { x, y } = await startScrub('Width')
    await page.mouse.move(x + 2, y)
    await page.mouse.up()
    expect(saved.html).toBe(original)
    expect(await page.$eval('[aria-label="Width"]', (el) => (el as HTMLInputElement).value)).toBe('120')

    await startScrub('Width')
    // Capture keeps the drag alive even when the pointer crosses the iframe.
    await page.mouse.move(200, y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '0px')
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
    await startScrub('Width')
    await page.mouse.move(x + 24, y, { steps: 6 })
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '144px')
    // The live canvas changes before release; reversing is relative to the same drag.
    await page.mouse.move(x + 14, y, { steps: 3 })
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '134px')
    await page.screenshot({ path: '/tmp/doop-element-scrubbing.png' })
    await page.mouse.up()
    await expect.poll(() => saved.html).toContain('width: 134px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
    await page.evaluate(() => window.elementPanelHarness.redo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '134px')
  }, 15_000)

  it('covers numeric units, padding shorthand, CSS lengths, modifiers, and bounds', async () => {
    const frame = await seedScrubTarget()
    for (const [label, dx, property, expected, modifier] of [
      ['Height', 4, 'height', '120px', 'Shift'],
      ['Gap', 8, 'gap', '14px'],
      ['Padding', 5, 'padding', '9px 13px 17px 21px'],
      ['Opacity percentage', 40, 'opacity', '1'],
      ['Opacity percentage', -150, 'opacity', '0'],
      ['Border width', 4, 'border-width', '6px'],
      ['Radius', -10, 'border-radius', '0px'],
      ['Font size', 4, 'font-size', '18.4px', 'Alt'],
      ['Minimum width', 5, 'min-width', '2rem', 'Alt'],
    ] as const) {
      await drag(label, dx, modifier)
      await frame.waitForFunction(
        (property, expected) =>
          (document.querySelector('#scrub') as HTMLElement).style.getPropertyValue(property) === expected,
        {},
        property,
        expected,
      )
    }
    // Reversing after hitting a bound responds immediately, without a dead zone.
    const { x, y } = await startScrub('Opacity percentage')
    await page.mouse.move(x - 20, y)
    await page.mouse.move(x - 15, y)
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.opacity === '0.05')
    await expect.poll(() => saved.html).toContain('opacity: 0.05')
    expect(saved.html).toContain('min-width: 2rem')
  }, 15_000)

  it('cancels with Escape and cleans up capture when interrupted or selection changes', async () => {
    const frame = await seedScrubTarget()
    let point = await startScrub('Width')
    await page.mouse.move(point.x + 20, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '140px')
    await page.keyboard.press('Escape')
    await page.mouse.move(point.x + 40, point.y)
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')

    point = await startScrub('Height')
    await page.mouse.move(point.x + 10, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.height === '90px')
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.move(point.x + 30, point.y)
    await page.mouse.up()
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.height)).toBe('90px')

    point = await startScrub('Width')
    await page.evaluate(() => window.elementPanelHarness.select('#other'))
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Width"]')?.value === '200')
    await page.mouse.move(point.x + 30, point.y)
    await page.mouse.up()
    expect(await frame.$eval('#other', (el) => (el as HTMLElement).style.width)).toBe('200px')
    expect(await page.$eval('body', (el) => getComputedStyle(el).cursor)).not.toBe('ew-resize')
  }, 15_000)

  it('preserves typing and keyboard adjustment and leaves nonnumeric lengths alone', async () => {
    const frame = await seedScrubTarget()
    await page.click('[aria-label="Width"]', { count: 3 })
    await page.keyboard.type('123')
    await page.keyboard.press('Enter')
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '123px')
    await page.click('[aria-label="Width"]')
    await page.keyboard.press('ArrowUp')
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '124px')
    await page.click('[aria-label="Minimum width"]', { count: 3 })
    await page.keyboard.type('auto')
    await page.keyboard.press('Enter')
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.minWidth === 'auto')
    const unit = (await page.$('label:has(input[aria-label="Minimum width"]) > span'))!
    expect(await unit.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('ew-resize')
    await expect.poll(() => saved.html).toContain('min-width: auto')
  }, 15_000)

  it('reconciles the displayed value with computed CSS after a drag finishes', async () => {
    const frame = await seedScrubTarget()
    const { x, y } = await startScrub('Width')
    await page.mouse.move(x - 150, y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '0px')
    // CSS min-width prevents the rendered width from reaching zero. The live
    // draft stays under pointer control until release, then reflects that limit.
    expect(await page.$eval('[aria-label="Width"]', (el) => (el as HTMLInputElement).value)).toBe('0')
    const computed = await frame.$eval('#scrub', (el) => String(parseFloat(getComputedStyle(el).width)))
    await page.mouse.up()
    await expect.poll(() => page.$eval('[aria-label="Width"]', (el) => (el as HTMLInputElement).value)).toBe(computed)

    const padding = await startScrub('Padding')
    await page.mouse.move(padding.x - 30, padding.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.padding === '0px')
    await page.mouse.up()
    await expect.poll(() => page.$eval('[aria-label="Padding"]', (el) => (el as HTMLInputElement).value)).toBe('0')
    await expect.poll(() => saved.html).toContain('padding: 0px')
  }, 15_000)

  it('restores original CSS units, absent properties, priorities, and shorthands on Escape without saving', async () => {
    const frame = await seedScrubTarget(
      'width:50% !important;padding:1em 2em !important;row-gap:6px;column-gap:10px;border-left:2px solid black',
    )
    const originalHtml = saved.html
    const inline = () =>
      frame.$eval('#scrub', (el) => {
        const style = (el as HTMLElement).style
        return Object.fromEntries(
          Array.from(style).map((key) => [key, [style.getPropertyValue(key), style.getPropertyPriority(key)]]),
        )
      })
    const original = await inline()
    for (const label of ['Width', 'Height', 'Padding', 'Gap', 'Border width']) {
      const point = await startScrub(label)
      await page.mouse.move(point.x + 10, point.y)
      await expect.poll(inline).not.toEqual(original)
      await page.keyboard.press('Escape')
      await page.mouse.up()
      await expect.poll(inline).toEqual(original)
    }
    expect(saved.html).toBe(originalHtml)
    await page.evaluate(() => window.elementPanelHarness.undo())
    expect(saved.html).toBe(originalHtml)
    await expect.poll(inline).toEqual(original)
  }, 15_000)

  it('saves a paused drag as one undo step and drops a paused cancellation', async () => {
    const frame = await seedScrubTarget()
    const original = saved.html
    let point = await startScrub('Width')
    await page.mouse.move(point.x + 20, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '140px')
    // Longer than both the runtime's save debounce and history's merge window.
    await new Promise((resolve) => setTimeout(resolve, 2100))
    expect(saved.html).toBe(original)
    await page.mouse.move(point.x + 40, point.y)
    await page.mouse.up()
    await expect.poll(() => saved.html).toContain('width: 160px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
    await page.evaluate(() => window.elementPanelHarness.redo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '160px')
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Width"]')?.value === '160')

    // A second completed drag remains a separate undo step, even immediately afterward.
    await drag('Width', 10)
    await expect.poll(() => saved.html).toContain('width: 170px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '160px')
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Width"]')?.value === '160')
    const beforeCancel = saved.html
    point = await startScrub('Width')
    await page.mouse.move(point.x + 30, point.y)
    await new Promise((resolve) => setTimeout(resolve, 2100))
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '160px')
    expect(saved.html).toBe(beforeCancel)
    // Cancellation leaves the previous real edit on top of the undo stack.
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
  }, 20_000)

  it('keeps remote edits when a preview is cancelled', async () => {
    const frame = await seedScrubTarget('width:50%;height:80px')
    const point = await startScrub('Width')
    await page.mouse.move(point.x + 20, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width.endsWith('px'))
    const preview = await frame.$eval('#scrub', (el) => (el as HTMLElement).style.width)
    saved = { ...saved, html: saved.html.replace('width:50%', 'width:60%;color:red') }
    const remote = saved.html
    await page.evaluate((frame) => window.elementPanelHarness.seed(frame), saved)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.color === 'red')
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.width)).toBe(preview)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '60%')
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.color)).toBe('red')
    expect(saved.html).toBe(remote)
  }, 15_000)
})
