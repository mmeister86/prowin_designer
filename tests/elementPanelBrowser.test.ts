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
    }
  }
}

describe.skipIf(!findBrowserPath())('element typography controls', () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let saved: Frame
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
})
