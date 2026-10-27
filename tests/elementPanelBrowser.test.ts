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
      currentHtml: () => string | undefined
      clear: () => void
      selected: () => { frameId: string; selector: string } | null
    }
    holdExitReply?: boolean
    heldExitReply?: MessageEvent | null
    pendingExitUndo?: Promise<void>
    exitUndoDone?: boolean
  }
}

describe.skipIf(!findBrowserPath())('element design controls', () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let saved: Frame
  let writes: string[] = []
  let seedId = 0
  let holdSave = false
  let releaseSave: (() => Promise<void>) | undefined
  const errors: string[] = []
  beforeAll(async () => {
    vite = await createServer({ server: { port: 0 }, logLevel: 'error' })
    await vite.listen()
    browser = await getBrowser()
    page = await browser.newPage()
    await page.evaluateOnNewDocument(() => {
      window.addEventListener('message', (event: MessageEvent) => {
        if (!window.holdExitReply || event.data?.type !== 'doop:edited') return
        event.stopImmediatePropagation()
        window.holdExitReply = false
        window.heldExitReply = event
      })
    })
    page.setDefaultTimeout(5_000)
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.setViewport({ width: 1000, height: 900 })
    await page.setRequestInterception(true)
    page.on('request', async (request) => {
      // The delayed-font test releases this stylesheet after the panel's first read.
      if (new URL(request.url()).pathname === '/tests/fixtures/late-font.css') return
      if (new URL(request.url()).pathname === '/api/frames/f' && request.method() === 'PATCH') {
        saved = { ...saved, ...JSON.parse(request.postData()!) }
        writes.push(saved.html)
        const response = { status: 200, contentType: 'application/json', body: JSON.stringify(saved) }
        if (holdSave) {
          holdSave = false
          releaseSave = () => request.respond(response)
        } else await request.respond(response)
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
    await page.waitForSelector('select[aria-label="Schriftfamilie"]')
  }, 60_000)

  afterAll(async () => {
    await page?.screenshot({ path: '/tmp/narwhal-element-panel.png' })
    await page?.close()
    await browser?.close()
    await vite?.close()
    expect(errors).toEqual([])
  })

  it('edits fonts and alignment through the sandbox, persists them, and supports undo and RTL', async () => {
    const selector = 'select[aria-label="Schriftfamilie"]'
    const frame = (await (await page.$('iframe'))!.contentFrame())!
    const initial = await page.$eval(selector, (el) => (el as HTMLSelectElement).value)
    expect(initial).toBe('"Editorial Face", serif')
    expect(
      await page.$$eval(
        `${selector} option`,
        (options) => options.filter((o) => o.textContent === 'Editorial Face').length,
      ),
    ).toBe(1)
    expect(await page.$eval('[aria-label="Linksbündig"]', (el) => el.getAttribute('data-state'))).toBe('on')

    await page.select(selector, 'Georgia, serif')
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#text')!).fontFamily === 'Georgia, serif',
    )
    await expect.poll(() => saved.html).toContain('font-family: Georgia, serif')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await page.waitForFunction(
      (value) => document.querySelector<HTMLSelectElement>('select[aria-label="Schriftfamilie"]')?.value === value,
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
    await page.click('[aria-label="Zentriert"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'center')
    await page.keyboard.press('ArrowRight')
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Rechtsbündig')
    await page.keyboard.press('Space')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'right')
    await page.click('[aria-label="Blocksatz"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#text')!).textAlign === 'justify')
    await expect.poll(() => saved.html).toContain('text-align: justify')
    await page.screenshot({ path: '/tmp/narwhal-element-panel.png' })

    await page.evaluate(() => window.elementPanelHarness.select('#rtl'))
    await page.waitForSelector('[aria-label="Rechtsbündig"][data-state="on"]')
    await page.waitForFunction(() => !document.querySelector('[aria-busy]'))
    expect(await page.$eval(selector, (el) => (el as HTMLSelectElement).value)).toBe(initial)
    await page.evaluate(() => window.elementPanelHarness.select('#rtl-end'))
    await page.waitForSelector('[aria-label="Linksbündig"][data-state="on"]')
    await page.waitForFunction(() => !document.querySelector('[aria-busy]'))
    await page.click('[aria-label="Zentriert"]')
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
        document.querySelector<HTMLSelectElement>('select[aria-label="Schriftfamilie"]')?.value === 'Arial, sans-serif',
    )
    const options = 'select[aria-label="Schriftfamilie"] option'
    expect(await page.$$eval(options, (options) => options.map((o) => o.textContent))).not.toContain('Late Arrival')

    await (
      await stylesheetRequest
    ).respond({
      status: 200,
      contentType: 'text/css',
      body: '@font-face { font-family: "Late Arrival"; src: local("Arial") }',
    })
    await page.waitForFunction(() =>
      Array.from(document.querySelectorAll('select[aria-label="Schriftfamilie"] option')).some(
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
  async function selectLayer(selector: string) {
    await page.evaluate(async (value) => {
      window.elementPanelHarness.select(value)
      await new Promise(requestAnimationFrame)
    }, selector)
    await page.waitForFunction(() => !document.querySelector('[aria-busy]'))
  }

  async function seedPanel(html: string, selector: string) {
    const fixture = String(++seedId)
    saved = { ...saved, html: html.replace('<body', `<body data-panel-fixture="${fixture}"`) }
    await page.evaluate((value) => window.elementPanelHarness.seed(value), saved)
    const frame = (await (await page.$('iframe'))!.contentFrame())!
    await frame.waitForFunction((fixture) => document.body.dataset.panelFixture === fixture, {}, fixture)
    await frame.waitForSelector(selector)
    await selectLayer(selector)
    // Selection may initially show the previous read while the new one is debounced.
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '120')
    return frame
  }

  async function number(label: string, value: number | string) {
    const selector = `input[aria-label="${label}"]`
    await page.click(selector, { count: 3 })
    await page.keyboard.press('Backspace')
    await page.type(selector, String(value))
    await page.keyboard.press('Enter')
  }

  it('edits flex direction, alignment, spacing and padding without overwriting the other axes; saves and undoes', async () => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
        #flex { display: inline-flex; width: 120px; height: 160px; gap: 7px 11px; padding: 8px 12px 16px 20px; align-items: center; justify-content: center }
        #flex > div { flex: none; width: 20px; height: 20px }
      </style></head><body><div id="flex"><div>A</div><div>B</div></div></body></html>`,
      '#flex',
    )
    await page.waitForSelector('[aria-label="Unterelemente mittig zentriert ausrichten"][aria-pressed="true"]')
    expect(
      await page.$eval('[aria-label="Horizontaler Innenabstand"]', (el) => (el as HTMLInputElement).placeholder),
    ).toBe('Gemischt')
    expect(await page.$eval('[aria-label="Horizontaler Innenabstand"]', (el) => (el as HTMLInputElement).value)).toBe(
      '',
    )
    await page.click('[aria-label="Abstand dazwischen"]')
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#flex')!).justifyContent === 'space-between',
    )
    await page.click('[aria-label="Unterelemente unten rechts ausrichten"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#flex')!).alignItems === 'flex-end')
    expect(await frame.$eval('#flex', (el) => getComputedStyle(el).justifyContent)).toBe('space-between')
    await number('Abstand', 14)
    expect(await frame.$eval('#flex', (el) => getComputedStyle(el).rowGap)).toBe('7px')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#flex')!).columnGap === '14px')
    await page.click('[aria-label="Spaltenrichtung"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#flex')!).flexDirection === 'column')
    expect(await frame.$eval('#flex', (el) => getComputedStyle(el).display)).toBe('inline-flex')
    await page.click('[aria-label="Richtung umkehren"]')
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#flex')!).flexDirection === 'column-reverse',
    )
    await page.click('[aria-label="Unterelemente umbrechen"]')
    await page.waitForSelector('[aria-label="Zeilenabstand"]')
    await number('Zeilenabstand', 18)
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#flex')!).columnGap === '18px')
    expect(await frame.$eval('#flex', (el) => getComputedStyle(el).rowGap)).toBe('7px')
    await number('Horizontaler Innenabstand', 24)
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#flex')!).padding === '8px 24px 16px')
    await expect.poll(() => saved.html).toContain('padding-right: 24px')
    // Reopen the saved result, starting a fresh undo history outside the edit burst.
    await seedPanel(saved.html, '#flex')
    await page.click('[aria-label="Einzelne Innenabstände"]')
    await number('Innenabstand oben', 30)
    await expect.poll(() => saved.html).toContain('padding-top: 30px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#flex')!).padding === '8px 24px 16px')
    await page.waitForFunction(
      () => document.querySelector<HTMLInputElement>('[aria-label="Innenabstand oben"]')?.value === '8',
    )
  }, 20_000)

  it.each([
    ['row', 'ltr', 'horizontal-tb', 'nowrap'],
    ['column', 'ltr', 'horizontal-tb', 'nowrap'],
    ['row-reverse', 'ltr', 'horizontal-tb', 'nowrap'],
    ['column-reverse', 'ltr', 'horizontal-tb', 'nowrap'],
    ['row', 'rtl', 'horizontal-tb', 'nowrap'],
    ['row', 'ltr', 'vertical-rl', 'nowrap'],
    ['column', 'ltr', 'vertical-lr', 'nowrap'],
    ['row', 'ltr', 'sideways-lr', 'nowrap'],
    ['row', 'ltr', 'horizontal-tb', 'wrap-reverse'],
  ])('aligns children to the physical bottom right in %s / %s / %s / %s', async (direction, bidi, writing, wrap) => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
        #flex { display: flex; width: 120px; height: 120px; flex-direction: ${direction}; direction: ${bidi}; writing-mode: ${writing}; flex-wrap: ${wrap} }
        #flex > div { flex: none; width: 20px; height: 20px }
      </style></head><body><div id="flex"><div></div><div></div></div></body></html>`,
      '#flex',
    )
    await page.click('[aria-label="Unterelemente unten rechts ausrichten"]')
    await frame.waitForFunction(() => {
      const parent = document.querySelector('#flex')!
      const bounds = parent.getBoundingClientRect()
      const children = [...parent.children].map((el) => el.getBoundingClientRect())
      return (
        Math.abs(Math.max(...children.map((r) => r.right)) - bounds.right) < 0.1 &&
        Math.abs(Math.max(...children.map((r) => r.bottom)) - bounds.bottom) < 0.1 &&
        Math.min(...children.map((r) => r.left)) > bounds.left + 60 &&
        Math.min(...children.map((r) => r.top)) > bounds.top + 60
      )
    })
    await page.waitForSelector('[aria-label="Unterelemente unten rechts ausrichten"][aria-pressed="true"]')
  })

  it('positions and aligns transformed layers without disturbing siblings; saves and undoes geometry', async () => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
      body { margin: 0 }
      #parent { display: flex; width: 400px; height: 240px; margin: 60px; transform: scale(.8); transform-origin: top left }
      #box { width: 120px; height: 80px; flex: none; background: #ddd; transform: rotate(20deg); scale: 1.2 .8; translate: 10% 5px }
      #sibling { width: 60px; height: 40px; flex: none }
    </style></head><body><div id="parent"><div id="box">Move me</div><div id="sibling" data-doop-locked>Sibling</div></div><span id="inline">Inline text</span><canvas id="canvas" width="20" height="20"></canvas></body></html>`,
      '#box',
    )
    const sibling = await frame.$eval('#sibling', (el) => el.getBoundingClientRect().toJSON())
    const originalTransform = await frame.$eval('#box', (el) => getComputedStyle(el).transform)
    const before = await frame.$eval('#box', (el) => (el as HTMLElement).style.translate)
    await number('X-Position', 40)
    await frame.waitForFunction(
      () =>
        Math.abs(
          document.querySelector('#box')!.getBoundingClientRect().x -
            document.querySelector('#parent')!.getBoundingClientRect().x -
            40,
        ) < 0.1,
    )
    await number('Y-Position', 30)
    await frame.waitForFunction(
      () =>
        Math.abs(
          document.querySelector('#box')!.getBoundingClientRect().y -
            document.querySelector('#parent')!.getBoundingClientRect().y -
            30,
        ) < 0.1,
    )

    for (const [label, axis, fraction] of [
      ['Ebene links ausrichten', 'x', 0],
      ['Ebene horizontal zentrieren', 'x', 0.5],
      ['Ebene rechts ausrichten', 'x', 1],
      ['Ebene oben ausrichten', 'y', 0],
      ['Ebene vertikal zentrieren', 'y', 0.5],
      ['Ebene unten ausrichten', 'y', 1],
    ] as const) {
      await page.click(`[aria-label="${label}"]`)
      await frame.waitForFunction(
        (axis, fraction) => {
          const box = document.querySelector('#box')!.getBoundingClientRect()
          const parent = document.querySelector('#parent')!.getBoundingClientRect()
          const size = axis === 'x' ? 'width' : 'height'
          return Math.abs(box[axis] - parent[axis] - (parent[size] - box[size]) * fraction) < 0.1
        },
        {},
        axis,
        fraction,
      )
    }
    expect(await frame.$eval('#sibling', (el) => el.getBoundingClientRect().toJSON())).toEqual(sibling)
    expect(await frame.$eval('#box', (el) => getComputedStyle(el).position)).toBe('static')
    await number('Drehung', 45)
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).rotate === '25deg')
    await page.click('[aria-label="Horizontal spiegeln"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).scale === '-1.2 0.8')
    await page.click('[aria-label="Horizontal spiegeln"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).scale === '1.2 0.8')
    await page.click('[aria-label="Vertikal spiegeln"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#box')!).scale === '1.2 -0.8')
    expect(await frame.$eval('#box', (el) => getComputedStyle(el).transform)).toBe(originalTransform)
    await expect.poll(() => saved.html).toContain('scale: 1.2 -0.8')
    const previousSave = saved.html
    await number('X-Position', 80)
    await expect.poll(() => saved.html).not.toBe(previousSave)
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(
      (before) => document.querySelector<HTMLElement>('#box')?.style.translate === before,
      {},
      before,
    )
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Drehung"]')?.value === '20')
    await page.screenshot({ path: '/tmp/narwhal-panel-controls.png' })
    await selectLayer('#sibling')
    await page.waitForSelector('[aria-label="X-Position"][disabled]')
    expect(await frame.$eval('#sibling', (el) => el.getAttribute('style'))).toBeNull()
    await selectLayer('#inline')
    await page.waitForFunction(
      () => document.querySelector<HTMLSelectElement>('[aria-label="Darstellung"]')?.value === 'inline',
    )
    expect(await page.$eval('[aria-label="Drehung"]', (el) => (el as HTMLInputElement).disabled)).toBe(true)
    await selectLayer('#canvas')
    await page.waitForSelector('[aria-label="Drehung"]:not([disabled])')
  }, 30_000)

  it('preserves fill RGB/alpha independently of element opacity, clips content, and reads nonstandard weights', async () => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
      #paint { width: 120px; height: 80px; overflow: hidden; opacity: .5; background: rgba(10,20,30,.35); font-weight: 450 }
      #modern { width: 120px; height: 80px; background: oklch(60% .15 30 / .4) }
    </style></head><body><div id="paint">Appearance controls</div><div id="modern">Modern color</div></body></html>`,
      '#paint',
    )
    await page.waitForFunction(
      () => document.querySelector<HTMLInputElement>('[aria-label="Deckkraft der Füllung"]')?.value === '35',
    )
    expect(await page.$eval('[aria-label="Schriftstärke"]', (el) => (el as HTMLSelectElement).value)).toBe('450')
    await number('Deckkraft der Füllung', 80)
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#paint')!).backgroundColor === 'rgba(10, 20, 30, 0.8)',
    )
    await number('Füllfarbe', '#e5533c')
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#paint')!).backgroundColor === 'rgba(229, 83, 60, 0.8)',
    )
    await number('Deckkraft der Füllung', 0)
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#paint')!).backgroundColor === 'rgba(229, 83, 60, 0)',
    )
    await number('Deckkraft der Füllung', 60)
    await frame.waitForFunction(
      () => getComputedStyle(document.querySelector('#paint')!).backgroundColor === 'rgba(229, 83, 60, 0.6)',
    )
    expect(await frame.$eval('#paint', (el) => getComputedStyle(el).opacity)).toBe('0.5')
    await page.click('[aria-label="Inhalt beschneiden"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#paint')!).overflow === 'visible')
    await number('Eckenradius', 12)
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#paint')!).borderRadius === '12px')
    await expect.poll(() => saved.html).toContain('overflow: visible')
    await page.click('[aria-label="Element ausblenden"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#paint')!).visibility === 'hidden')
    await page.click('[aria-label="Element einblenden"]')
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#paint')!).visibility === 'visible')
    await selectLayer('#modern')
    await page.waitForFunction(
      () => document.querySelector<HTMLInputElement>('[aria-label="Deckkraft der Füllung"]')?.value === '40',
    )
    await number('Deckkraft der Füllung', 25)
    await frame.waitForFunction(() =>
      getComputedStyle(document.querySelector('#modern')!).backgroundColor.endsWith('/ 0.25)'),
    )
    expect(await frame.$eval('#modern', (el) => (el as HTMLElement).style.backgroundColor)).toContain('oklch')
  }, 20_000)

  it('reads stylesheet sizes and switches between flex fill, fixed, and content sizing', async () => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
      #row { display: flex; width: 400px; height: 240px; gap: 16px }
      #sized { width: 120px; height: 80px; padding: 10px; border: 2px solid; }
      #other { width: 60px; flex: none }
    </style></head><body><div id="row"><div id="sized">Size</div><div id="other">Other</div></div></body></html>`,
      '#sized',
    )
    expect(await page.$eval('[aria-label="Breitenanpassung"]', (el) => (el as HTMLSelectElement).value)).toBe('fixed')
    await page.select('[aria-label="Breitenanpassung"]', 'fill')
    await frame.waitForFunction(() => document.querySelector('#sized')!.getBoundingClientRect().width === 324)
    await page.select('[aria-label="Höhenanpassung"]', 'fill')
    await frame.waitForFunction(() => document.querySelector('#sized')!.getBoundingClientRect().height === 240)
    await page.waitForFunction(
      () => document.querySelector<HTMLSelectElement>('[aria-label="Höhenanpassung"]')?.value === 'fill',
    )
    await number('Breite', 140)
    await frame.waitForFunction(() => getComputedStyle(document.querySelector('#sized')!).width === '140px')
    expect(await frame.$eval('#sized', (el) => getComputedStyle(el).flexGrow)).toBe('0')
    await page.select('[aria-label="Breitenanpassung"]', 'hug')
    await frame.waitForFunction(() => document.querySelector<HTMLElement>('#sized')!.style.width === 'fit-content')
    expect(await frame.$eval('#sized', (el) => el.getBoundingClientRect().width)).toBeLessThan(120)
    await page.select('[aria-label="Breitenanpassung"]', 'auto')
    await frame.waitForFunction(() => document.querySelector<HTMLElement>('#sized')!.style.width === 'auto')
    await expect.poll(() => saved.html).toContain('width: auto')
  }, 20_000)
  it.each(['stylesheet', 'inline'])(
    'settles position and alignment before restoring %s transitions',
    async (source) => {
      const inline =
        source === 'inline'
          ? 'style="transition-property: all !important; transition-duration: 1s; transition-delay: .1s"'
          : ''
      const frame = await seedPanel(
        `<!doctype html><html><head><style>
      body { margin: 0 }
      #transition-parent { width: 400px; height: 240px }
      #transition-layer { width: 120px; height: 80px; translate: 10% 5px; ${source === 'stylesheet' ? 'transition: all 1s' : ''} }
    </style></head><body><div id="transition-parent"><div id="transition-layer" ${inline}>Animated layer</div></div></body></html>`,
        '#transition-layer',
      )
      // Morphing this fixture over the previous document can itself start a transition.
      await frame.$eval('#transition-layer', (el) => el.getAnimations().forEach((animation) => animation.finish()))
      const before = await frame.$eval('#transition-layer', (el) => {
        const css = getComputedStyle(el)
        return [
          css.transitionProperty,
          css.transitionDuration,
          css.transitionDelay,
          (el as HTMLElement).style.getPropertyPriority('transition-property'),
        ]
      })
      const position = await page.evaluate(() =>
        window.elementPanelHarness.geometry('#transition-layer', { kind: 'position', axis: 'x', value: 40 }),
      )
      expect(position?.geometry.x).toBe(40)
      expect(position?.geometry.y).toBe(5)
      const aligned = await page.evaluate(() =>
        window.elementPanelHarness.geometry('#transition-layer', { kind: 'align', axis: 'y', edge: 'end' }),
      )
      expect(aligned?.geometry.x).toBe(40)
      expect(aligned?.geometry.y).toBe(160)
      expect(
        await frame.$eval(
          '#transition-layer',
          (el) => el.getAnimations().filter((animation) => animation instanceof CSSTransition).length,
        ),
      ).toBe(0)
      expect(
        await frame.$eval('#transition-layer', (el) => {
          const css = getComputedStyle(el)
          return [
            css.transitionProperty,
            css.transitionDuration,
            css.transitionDelay,
            (el as HTMLElement).style.getPropertyPriority('transition-property'),
          ]
        }),
      ).toEqual(before)
      await expect.poll(() => saved.html).toContain('translate: 40px 160px')
      expect(saved.html).not.toContain('transition: none')
    },
    15_000,
  )

  it.each(['row', 'column'])(
    'fills the physical dimensions of a vertical-writing flex %s',
    async (direction) => {
      const frame = await seedPanel(
        `<!doctype html><html><head><style>
      #vertical { writing-mode: vertical-rl; display: flex; flex-direction: ${direction}; width: 400px; height: 240px; gap: 16px }
      #vertical-child { width: 120px; height: 80px }
      #vertical-sibling { width: 60px; height: 40px; flex: none }
    </style></head><body><div id="vertical"><div id="vertical-child">Size</div><div id="vertical-sibling">Other</div></div></body></html>`,
        '#vertical-child',
      )
      const main = direction === 'row' ? 'Höhe' : 'Breite'
      const cross = direction === 'row' ? 'Breite' : 'Höhe'
      await page.select(`[aria-label="${cross === 'Breite' ? 'Breitenanpassung' : 'Höhenanpassung'}"]`, 'fill')
      await frame.waitForFunction(
        (direction) => {
          const r = document.querySelector('#vertical-child')!.getBoundingClientRect()
          return direction === 'row' ? r.width === 400 && r.height === 80 : r.width === 120 && r.height === 240
        },
        {},
        direction,
      )
      expect(await frame.$eval('#vertical-child', (el) => getComputedStyle(el).flexGrow)).toBe('0')
      await page.select(`[aria-label="${main === 'Breite' ? 'Breitenanpassung' : 'Höhenanpassung'}"]`, 'fill')
      await frame.waitForFunction(
        (direction) => {
          const r = document.querySelector('#vertical-child')!.getBoundingClientRect()
          return direction === 'row' ? r.width === 400 && r.height === 184 : r.width === 324 && r.height === 240
        },
        {},
        direction,
      )
      await number(main, 100)
      await frame.waitForFunction(
        (direction) =>
          getComputedStyle(document.querySelector('#vertical-child')!)[direction === 'row' ? 'height' : 'width'] ===
          '100px',
        {},
        direction,
      )
      expect(await frame.$eval('#vertical-child', (el) => getComputedStyle(el).flexGrow)).toBe('0')
      await expect.poll(() => saved.html).toContain(`${main === 'Breite' ? 'width' : 'height'}: 100px`)
    },
    15_000,
  )

  it('fills to the parent edge with fractional borders and padding', async () => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
      #fractional { zoom: 2; width: 200px; height: 160px }
      #fractional-child { width: 120px; height: 80px; border: 1.5px solid; padding: 3.25px }
    </style></head><body><div id="fractional"><div id="fractional-child">Size</div></div></body></html>`,
      '#fractional-child',
    )
    expect(await frame.$eval('#fractional-child', (el) => getComputedStyle(el).borderLeftWidth)).toBe('1.5px')
    for (const axis of ['Breite', 'Höhe']) {
      await page.select(`[aria-label="${axis === 'Breite' ? 'Breitenanpassung' : 'Höhenanpassung'}"]`, 'fill')
      await frame.waitForFunction(
        (axis) => {
          const parent = document.querySelector('#fractional')!.getBoundingClientRect()
          const child = document.querySelector('#fractional-child')!.getBoundingClientRect()
          return Math.abs(axis === 'Breite' ? parent.right - child.right : parent.bottom - child.bottom) < 0.01
        },
        {},
        axis,
      )
    }
    await expect.poll(() => saved.html).toContain('calc(100% - 9.5px)')
  }, 15_000)

  async function seedScrubTarget(
    styles = 'width:120px;height:80px;min-width:1.5rem;padding:4px 8px 12px 16px;gap:6px;column-gap:10px;opacity:0.8;border-left:2px solid black;border-radius:3px;font-size:18px',
    { css = '', target = `<div id="scrub" style="display:flex;${styles}">Scrub me</div>` } = {},
  ) {
    const seed = String(++seedId)
    saved = {
      ...saved,
      html: `<!doctype html><html><head><style>${css}</style></head><body data-seed="${seed}">
        ${target}
        <div id="other" style="width:200px">Another element</div>
      </body></html>`,
    }
    await page.evaluate((frame) => window.elementPanelHarness.seed(frame), saved)
    const frame = (await (await page.$('iframe'))!.contentFrame())!
    await frame.waitForFunction((seed) => document.body.dataset.seed === seed, {}, seed)
    await frame.waitForFunction(() => Array.from(document.images).every((image) => image.complete))
    await page.evaluate(() => window.elementPanelHarness.select('#scrub'))
    const width = await frame.$eval('#scrub', (el) => String(parseFloat(getComputedStyle(el).width)))
    await page.waitForFunction(
      (width) => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === width,
      {},
      width,
    )
    await page.click('[aria-label="Einzelne Innenabstände"]')
    return frame
  }

  async function startScrub(label: string) {
    const unit = (await page.$(`label:has(input[aria-label="${label}"]) > span:last-child`))!
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

  async function requestExitUndo() {
    await page.evaluate(async () => {
      window.exitUndoDone = false
      window.pendingExitUndo = window.elementPanelHarness.undo().then(() => {
        window.exitUndoDone = true
      })
      // One task turn drains settled saves without sleeping through the race.
      await new Promise<void>((resolve) => setTimeout(resolve, 0))
    })
  }

  async function releaseExitReply() {
    await page.evaluate(() => {
      const held = window.heldExitReply!
      window.heldExitReply = null
      window.dispatchEvent(new MessageEvent('message', { data: held.data, source: held.source }))
    })
  }

  it('scrubs negative geometry without probe animations and restores translations on cancel and undo', async () => {
    const frame = await seedPanel(
      `<!doctype html><html><head><style>
        body { margin: 0 } #box { width: 120px; height: 80px }
      </style></head><body><div id="box" style="translate: 10px 5px">Move</div></body></html>`,
      '#box',
    )
    await frame.$eval('#box', (el) => {
      ;(el as HTMLElement).style.transition = 'all 1s'
    })
    const original = saved.html
    const point = await startScrub('X-Position')
    await page.mouse.move(point.x - 30, point.y)
    await frame.waitForFunction(() => (document.querySelector('#box') as HTMLElement).style.translate === '-20px 5px')
    expect(await frame.$eval('#box', (el) => el.getBoundingClientRect().x)).toBe(-20)
    expect(await frame.$eval('#box', (el) => el.getAnimations().length)).toBe(0)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#box') as HTMLElement).style.translate === '10px 5px')
    expect(saved.html).toBe(original)
    await frame.$eval('#box', (el) => el.getAnimations().forEach((animation) => animation.finish()))
    await page.waitForFunction(
      () => document.querySelector<HTMLInputElement>('[aria-label="X-Position"]')?.value === '10',
    )
    await drag('X-Position', -30)
    await expect.poll(() => saved.html).toContain('translate: -20px 5px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => (document.querySelector('#box') as HTMLElement).style.translate === '10px 5px')
  }, 15_000)

  it('scrubs live in both directions, saves, and undoes/redoes the edit', async () => {
    const frame = await seedScrubTarget()
    const original = saved.html
    const { x, y } = await startScrub('Breite')
    await page.mouse.move(x + 2, y)
    await page.mouse.up()
    expect(saved.html).toBe(original)
    expect(await page.$eval('[aria-label="Breite"]', (el) => (el as HTMLInputElement).value)).toBe('120')

    await startScrub('Breite')
    // Capture keeps the drag alive even when the pointer crosses the iframe.
    await page.mouse.move(200, y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '0px')
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
    await startScrub('Breite')
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
      ['Höhe', 4, 'height', '120px', 'Shift'],
      ['Abstand', 8, 'column-gap', '18px'],
      ['Innenabstand oben', 5, 'padding-top', '9px'],
      ['Deckkraft des Elements', 40, 'opacity', '1'],
      ['Deckkraft des Elements', -150, 'opacity', '0'],
      ['Rahmenbreite', 4, 'border-width', '6px'],
      ['Eckenradius', -10, 'border-radius', '0px'],
      ['Schriftgröße', 4, 'font-size', '18.4px', 'Alt'],
      ['Mindestbreite', 5, 'min-width', '2rem', 'Alt'],
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
    const { x, y } = await startScrub('Deckkraft des Elements')
    await page.mouse.move(x - 20, y)
    await page.mouse.move(x - 15, y)
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.opacity === '0.05')
    await expect.poll(() => saved.html).toContain('opacity: 0.05')
    expect(saved.html).toContain('min-width: 2rem')
  }, 15_000)

  it('cancels with Escape and cleans up capture when interrupted or selection changes', async () => {
    const frame = await seedScrubTarget()
    let point = await startScrub('Breite')
    await page.mouse.move(point.x + 20, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '140px')
    await page.keyboard.press('Escape')
    await page.mouse.move(point.x + 40, point.y)
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')

    point = await startScrub('Höhe')
    await page.mouse.move(point.x + 10, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.height === '90px')
    await page.evaluate(() => window.dispatchEvent(new Event('blur')))
    await page.mouse.move(point.x + 30, point.y)
    await page.mouse.up()
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.height)).toBe('90px')

    point = await startScrub('Breite')
    await page.evaluate(() => window.elementPanelHarness.select('#other'))
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '200')
    await page.mouse.move(point.x + 30, point.y)
    await page.mouse.up()
    expect(await frame.$eval('#other', (el) => (el as HTMLElement).style.width)).toBe('200px')
    expect(await page.$eval('body', (el) => getComputedStyle(el).cursor)).not.toBe('ew-resize')
  }, 15_000)

  it('preserves typing and keyboard adjustment and leaves nonnumeric lengths alone', async () => {
    const frame = await seedScrubTarget()
    await page.click('[aria-label="Breite"]', { count: 3 })
    await page.keyboard.type('123')
    await page.keyboard.press('Enter')
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '123px')
    await page.click('[aria-label="Breite"]')
    await page.keyboard.press('ArrowUp')
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '124px')
    await page.click('[aria-label="Mindestbreite"]', { count: 3 })
    await page.keyboard.type('auto')
    await page.keyboard.press('Enter')
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.minWidth === 'auto')
    const unit = (await page.$('label:has(input[aria-label="Mindestbreite"]) > span'))!
    expect(await unit.evaluate((el) => getComputedStyle(el).cursor)).not.toBe('ew-resize')
    await expect.poll(() => saved.html).toContain('min-width: auto')
  }, 15_000)

  it('reconciles the displayed value with computed CSS after a drag finishes', async () => {
    const frame = await seedScrubTarget()
    const { x, y } = await startScrub('Breite')
    await page.mouse.move(x - 150, y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '0px')
    // CSS min-width prevents the rendered width from reaching zero. The live
    // draft stays under pointer control until release, then reflects that limit.
    expect(await page.$eval('[aria-label="Breite"]', (el) => (el as HTMLInputElement).value)).toBe('0')
    const computed = await frame.$eval('#scrub', (el) => String(parseFloat(getComputedStyle(el).width)))
    await page.mouse.up()
    await expect.poll(() => page.$eval('[aria-label="Breite"]', (el) => (el as HTMLInputElement).value)).toBe(computed)

    const padding = await startScrub('Innenabstand oben')
    await page.mouse.move(padding.x - 30, padding.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.paddingTop === '0px')
    await page.mouse.up()
    await expect
      .poll(() => page.$eval('[aria-label="Innenabstand oben"]', (el) => (el as HTMLInputElement).value))
      .toBe('0')
    await expect.poll(() => saved.html).toContain('padding: 0px 8px 12px 16px')
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
    for (const label of ['Breite', 'Höhe', 'Innenabstand oben', 'Abstand', 'Rahmenbreite']) {
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
    let point = await startScrub('Breite')
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
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '160')

    // A second completed drag remains a separate undo step, even immediately afterward.
    await drag('Breite', 10)
    await expect.poll(() => saved.html).toContain('width: 170px')
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '160px')
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '160')
    const beforeCancel = saved.html
    point = await startScrub('Breite')
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

  it.each([false, true])(
    'flushes pending inline text before scrub preview and keeps Undo safe (held exit: %s)',
    async (heldExit) => {
      const frame = await seedScrubTarget('width:120px;height:80px')
      const box = (await (await frame.$('#scrub'))!.boundingBox())!
      await page.mouse.click(box.x + 20, box.y + 10, { count: 2, delay: 60 })
      await page.waitForSelector('[title="Speichern und Bearbeitung beenden (Esc)"]')
      await selectLayer('#scrub')
      await page.waitForFunction(
        () => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '120',
      )
      writes = []
      await frame.click('#scrub')
      await frame.waitForSelector('#scrub[contenteditable]')
      await page.keyboard.press('End')
      await page.keyboard.type(' typed')
      // Like picking the layer in Layers, move keyboard focus back to the panel.
      await page.click('[aria-label="Breite"]')
      const point = await startScrub('Breite')
      await page.mouse.move(point.x + 20, point.y)
      await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '140px')
      await new Promise((resolve) => setTimeout(resolve, 500))
      expect(writes).toHaveLength(1)
      expect(writes[0]).toContain('typed')
      expect(writes[0]).not.toContain('width: 140px')
      const textSave = saved.html
      await page.keyboard.press('Escape')
      await page.mouse.up()
      await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
      expect(saved.html).toBe(textSave)
      expect(
        await page.evaluate(
          (html) =>
            (new DOMParser().parseFromString(html, 'text/html').querySelector('#scrub') as HTMLElement).style.width,
          saved.html,
        ),
      ).toBe('120px')
      expect(writes).toHaveLength(1)
      await page.waitForFunction(
        () => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '120',
      )
      await drag('Breite', 30)
      await expect.poll(() => saved.html).toContain('width: 150px')
      expect(saved.html).toContain('typed')
      expect(writes).toHaveLength(2)
      if (heldExit) {
        // Complete the prior PATCHes before challenging the exit-message barrier.
        await page.evaluate(async () => {
          await window.elementPanelHarness.undo()
          await window.elementPanelHarness.redo()
          window.holdExitReply = true
          window.heldExitReply = null
        })
      }
      await page.click('[title="Speichern und Bearbeitung beenden (Esc)"]')
      await page.waitForFunction(() => !document.querySelector('[title="Speichern und Bearbeitung beenden (Esc)"]'))
      if (heldExit) {
        await page.waitForFunction(() => !!window.heldExitReply)
        await requestExitUndo()
        try {
          expect(await page.evaluate(() => window.elementPanelHarness.currentHtml())).toContain('width: 150px')
        } finally {
          await releaseExitReply()
          await page.evaluate(() => window.pendingExitUndo)
        }
      } else await page.evaluate(() => window.elementPanelHarness.undo())
      await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '120px')
      expect(saved.html).toContain('typed')
      expect(saved.html).not.toContain('width: 150px')
      expect(writes).toHaveLength(heldExit ? 5 : 3)
      await page.evaluate(() => window.elementPanelHarness.undo())
      await frame.waitForFunction(() => !document.querySelector('#scrub')!.textContent!.includes('typed'))
      expect(saved.html).not.toContain('typed')
    },
    20_000,
  )

  it.each(['button', 'iframe Escape'])(
    'waits for final text serialization and PATCH before Undo (%s)',
    async (exit) => {
      const frame = await seedScrubTarget('width:120px;height:80px')
      const box = (await (await frame.$('#scrub'))!.boundingBox())!
      await page.mouse.click(box.x + 20, box.y + 10, { count: 2, delay: 60 })
      await page.waitForSelector('[title="Speichern und Bearbeitung beenden (Esc)"]')
      await frame.click('#scrub')
      await frame.waitForSelector('#scrub[contenteditable]')
      writes = []
      // Only the exit snapshot can serialize this live, not-yet-saved DOM edit.
      await frame.$eval('#scrub', (element) => {
        element.textContent += ' pending exit'
      })
      await page.evaluate(() => {
        window.holdExitReply = true
        window.heldExitReply = null
      })
      if (exit === 'button') await page.click('[title="Speichern und Bearbeitung beenden (Esc)"]')
      else await page.keyboard.press('Escape')
      await page.waitForFunction(() => !!window.heldExitReply)
      holdSave = true
      await requestExitUndo()
      try {
        expect(await page.evaluate(() => window.exitUndoDone)).toBe(false)
      } finally {
        await releaseExitReply()
        await expect.poll(() => releaseSave).toBeTypeOf('function')
        try {
          expect(await page.evaluate(() => window.exitUndoDone)).toBe(false)
          expect(await page.evaluate(() => window.elementPanelHarness.currentHtml())).toContain('pending exit')
        } finally {
          await releaseSave!()
          releaseSave = undefined
          await page.evaluate(() => window.pendingExitUndo)
        }
      }
      await frame.waitForFunction(() => !document.querySelector('#scrub')!.textContent!.includes('pending exit'))
      expect(saved.html).not.toContain('pending exit')
      expect(writes).toHaveLength(2)
    },
    15_000,
  )

  it('releases an outstanding exit barrier when the frame unmounts', async () => {
    const frame = await seedScrubTarget('width:120px;height:80px')
    const box = (await (await frame.$('#scrub'))!.boundingBox())!
    await page.mouse.click(box.x + 20, box.y + 10, { count: 2, delay: 60 })
    await page.waitForSelector('[title="Speichern und Bearbeitung beenden (Esc)"]')
    await page.evaluate(() => {
      window.holdExitReply = true
      window.heldExitReply = null
    })
    await page.click('[title="Speichern und Bearbeitung beenden (Esc)"]')
    await page.waitForFunction(() => !!window.heldExitReply)
    await requestExitUndo()
    expect(await page.evaluate(() => window.exitUndoDone)).toBe(false)
    await page.evaluate(() => window.elementPanelHarness.clear())
    await page.waitForFunction(() => !document.querySelector('iframe'))
    await page.waitForFunction(() => window.exitUndoDone)
    await releaseExitReply()
    expect(await page.evaluate(() => window.elementPanelHarness.currentHtml())).toBeUndefined()
  }, 15_000)

  it('keeps remote edits when a preview is cancelled', async () => {
    const frame = await seedScrubTarget('width:50%;height:80px')
    const point = await startScrub('Breite')
    await page.mouse.move(point.x + 20, point.y)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width.endsWith('px'))
    const preview = await frame.$eval('#scrub', (el) => (el as HTMLElement).style.width)
    saved = { ...saved, html: saved.html.replace('width:50%', 'width:60%;color:red') }
    const remote = saved.html
    await page.evaluate((frame) => window.elementPanelHarness.remote(frame), saved)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.color === 'red')
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.width)).toBe(preview)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '60%')
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.color)).toBe('red')
    expect(saved.html).toBe(remote)
  }, 15_000)

  it('links dimensions for typing and dragging, persists the ratio, and restores both dimensions on cancel/undo', async () => {
    const frame = await seedScrubTarget()
    const toggle = '[aria-label="Breite und Höhe koppeln"]'
    expect(await page.$eval(toggle, (el) => el.getAttribute('aria-pressed'))).toBe('false')
    await page.click(toggle)
    await page.waitForSelector(`${toggle}[aria-pressed="true"]`)
    await expect.poll(() => saved.html).toContain('aspect-ratio: 120 / 80')

    await page.click('[aria-label="Breite"]', { count: 3 })
    await page.keyboard.type('240')
    await page.keyboard.press('Enter')
    await frame.waitForFunction(() => {
      const style = (document.querySelector('#scrub') as HTMLElement).style
      return style.width === '240px' && style.height === '160px'
    })
    await expect.poll(() => saved.html).toContain('height: 160px')
    await page.evaluate(() => window.elementPanelHarness.select('#other'))
    await page.waitForSelector(`${toggle}[aria-pressed="false"]`)
    await page.evaluate(() => window.elementPanelHarness.select('#scrub'))
    await page.waitForSelector(`${toggle}[aria-pressed="true"]`)

    await page.click('[aria-label="Höhe"]', { count: 3 })
    await page.keyboard.type('100')
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '150')
    const point = await startScrub('Breite')
    await page.mouse.move(point.x + 30, point.y)
    await frame.waitForFunction(() => {
      const style = (document.querySelector('#scrub') as HTMLElement).style
      return style.width === '180px' && style.height === '120px'
    })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '150')
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.height)).toBe('100px')

    await drag('Breite', 30)
    await expect.poll(() => saved.html).toContain('width: 180px')
    await page.screenshot({ path: '/tmp/doop-linked-dimensions.png' })
    await page.evaluate(() => window.elementPanelHarness.undo())
    await frame.waitForFunction(() => {
      const style = (document.querySelector('#scrub') as HTMLElement).style
      return style.width === '150px' && style.height === '100px'
    })
    await page.evaluate(() => window.elementPanelHarness.redo())
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.width === '180px')
    await page.waitForFunction(() => document.querySelector<HTMLInputElement>('[aria-label="Breite"]')?.value === '180')
    await page.click(toggle)
    await page.waitForSelector(`${toggle}[aria-pressed="false"]`)
    await expect.poll(() => saved.html).toContain('aspect-ratio: auto')
    await page.click('[aria-label="Breite"]', { count: 3 })
    await page.keyboard.type('200')
    await page.keyboard.press('Enter')
    await expect.poll(() => saved.html).toContain('width: 200px')
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.height)).toBe('120px')
  }, 20_000)

  it('recognizes authored aspect ratios and maintains them in Fill mode', async () => {
    const frame = await seedScrubTarget('width:160px;height:90px;aspect-ratio:16 / 9', {
      css: '#scrub { height: 90px }',
    })
    await page.waitForSelector('[aria-label="Breite und Höhe koppeln"][aria-pressed="true"]')
    await page.select('[aria-label="Breitenanpassung"]', 'fill')
    await frame.waitForFunction(() => {
      const el = document.querySelector('#scrub') as HTMLElement
      const style = getComputedStyle(el)
      return (
        el.style.width === '100%' &&
        el.style.height === 'auto' &&
        Math.abs(parseFloat(style.width) / parseFloat(style.height) - 16 / 9) < 0.001
      )
    })
    await expect.poll(() => saved.html).toContain('width: 100%')
    expect(saved.html).toContain('aspect-ratio: 16 / 9')
    const height = await frame.$eval('#scrub', (el) => getComputedStyle(el).height)
    await page.waitForFunction(
      (height) => document.querySelector<HTMLInputElement>('[aria-label="Höhe"]')?.value === String(parseFloat(height)),
      {},
      height,
    )
    await page.click('[aria-label="Breite und Höhe koppeln"]')
    await expect.poll(() => saved.html).toContain('aspect-ratio: auto')
    expect(await frame.$eval('#scrub', (el) => getComputedStyle(el).height)).toBe(height)
    expect(await frame.$eval('#scrub', (el) => (el as HTMLElement).style.width)).toBe('100%')
  }, 15_000)

  it.each(['width', 'height'] as const)(
    'keeps an existing %s Fill proportional when linking',
    async (axis) => {
      const other = axis === 'width' ? 'height' : 'width'
      const frame = await seedScrubTarget(`${axis}:100%;${other}:80px`, {
        css: 'body { width: 240px; height: 240px } #scrub { width: 80px; height: 80px }',
      })
      await page.click('[aria-label="Breite und Höhe koppeln"]')
      await page.waitForSelector('[aria-label="Breite und Höhe koppeln"][aria-pressed="true"]')
      await frame.waitForFunction(
        (other) => (document.querySelector('#scrub') as HTMLElement).style.getPropertyValue(other) === 'auto',
        {},
        other,
      )
      await expect.poll(() => saved.html).toContain(`${other}: auto`)
      await frame.evaluate((axis) => {
        document.body.style[axis] = '300px'
      }, axis)
      await frame.waitForFunction(
        (other) => getComputedStyle(document.querySelector('#scrub')!).getPropertyValue(other) === '100px',
        {},
        other,
      )
    },
    15_000,
  )

  it('preserves stylesheet-derived image dimensions when unlinking', async () => {
    const src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>')}`
    const frame = await seedScrubTarget('', {
      css: '#scrub { height:100px; width:auto; aspect-ratio:2 / 1 }',
      target: `<img id="scrub" src="${src}">`,
    })
    await page.waitForSelector('[aria-label="Breite und Höhe koppeln"][aria-pressed="true"]')
    expect(await frame.$eval('#scrub', (el) => getComputedStyle(el).width)).toBe('200px')
    await page.click('[aria-label="Breite und Höhe koppeln"]')
    await expect.poll(() => saved.html).toContain('aspect-ratio: auto')
    expect(await frame.$eval('#scrub', (el) => [getComputedStyle(el).width, getComputedStyle(el).height])).toEqual([
      '200px',
      '100px',
    ])
  }, 15_000)

  it('uses a loaded image natural ratio instead of its auto fallback while editing', async () => {
    const src = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"/>')}`
    const frame = await seedScrubTarget('', {
      target: `<img id="scrub" src="${src}" style="width:200px;height:auto;aspect-ratio:auto 1 / 1">`,
    })
    await page.waitForSelector('[aria-label="Breite und Höhe koppeln"][aria-pressed="true"]')
    await page.click('[aria-label="Breite"]', { count: 3 })
    await page.keyboard.type('400')
    await page.keyboard.press('Enter')
    await expect.poll(() => saved.html).toContain('height: 200px')
    expect(await frame.$eval('#scrub', (el) => getComputedStyle(el).width)).toBe('400px')
  }, 15_000)

  it('requires positive dimensions before linking and supports the keyboard toggle', async () => {
    const frame = await seedScrubTarget('width:0px;height:0px')
    const toggle = '[aria-label="Breite und Höhe koppeln"]'
    expect(await page.$eval(toggle, (el) => (el as HTMLButtonElement).disabled)).toBe(true)
    for (const [label, value] of [
      ['Breite', '80'],
      ['Höhe', '40'],
    ]) {
      await page.click(`[aria-label="${label}"]`, { count: 3 })
      await page.keyboard.type(value!)
      await page.keyboard.press('Enter')
    }
    await page.waitForSelector(`${toggle}:not([disabled])`)
    await page.focus(toggle)
    await page.keyboard.press('Space')
    await page.waitForSelector(`${toggle}[aria-pressed="true"]`)
    await frame.waitForFunction(() => (document.querySelector('#scrub') as HTMLElement).style.aspectRatio === '80 / 40')
    await expect.poll(() => saved.html).toContain('aspect-ratio: 80 / 40')
  }, 15_000)
})
