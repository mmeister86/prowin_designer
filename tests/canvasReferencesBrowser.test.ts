import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, ElementHandle, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { AgentTask, Canvas, Frame } from '../shared/types'
import { Client, freePort, startServer, type Server } from './harness'

const composer = 'textarea[aria-label="Frag den Doop-Agenten"]'
const overlay = '[aria-label="Bilder hier ablegen"]'
const notice =
  'Referenzbilder werden vom KI-Agenten visuell ausgewertet; beim Server-Agenten über Requesty (EU). Kontaktdaten im Bild werden nicht automatisch entfernt. Lade nur Bilder hoch, die Du dafür verwenden darfst.'
const browserPath = findBrowserPath()

// Fail explicitly before server setup: a missing browser is missing evidence, not a passing skip.
describe('real canvas image reference workflows', { timeout: 30_000 }, () => {
  let vite: ViteDevServer
  let server: Server
  let browser: Browser
  let page: Page
  let client: Client
  let origin: string
  let canvas: Canvas
  let source: Frame
  let target: Frame

  beforeAll(async () => {
    if (!browserPath) throw new Error('Chromium fehlt: Canvas-Referenz-Workflows wurden nicht nachgewiesen.')
    const port = await freePort()
    vite = await createServer({
      cacheDir: 'node_modules/.vite-canvas-references-test',
      logLevel: 'error',
      server: {
        port: 0,
        proxy: {
          '/api': { target: `http://localhost:${port}` },
          '/ws': { target: `ws://localhost:${port}`, ws: true },
          '/a/': { target: `http://localhost:${port}` },
          '/i/': { target: `http://localhost:${port}` },
          '/fonts/': { target: `http://localhost:${port}` },
        },
      },
    })
    await vite.listen()
    origin = vite.resolvedUrls!.local[0]!.replace(/\/$/, '')
    server = await startServer({
      PORT: String(port),
      BETTER_AUTH_URL: origin,
      SMTP_HOST: '',
      RESIDENT_TASK_LIMIT: '30',
      DOOP_AGENT_PROVIDER: 'requesty',
      REQUESTY_API_KEY: '',
      ANTHROPIC_API_KEY: '',
      AZURE_OPENAI_API_KEY: '',
    })
    client = await new Client(server).signUp('ripley@test.dev', 'Ellen Ripley')
    browser = await getBrowser()
    page = await browser.newPage()
    page.setDefaultTimeout(10_000)
    await page.setCookie(...[...client.cookies].map(([name, value]) => ({ name, value, url: origin })))
    await page.goto(origin)
    await page.evaluate(() =>
      localStorage.setItem('doop:onboarding', JSON.stringify({ dismissed: true, notice: true })),
    )
  }, 60_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    server?.stop()
    await server?.stopped
  })

  afterEach(async (context) => {
    if (context.task.result?.state === 'fail' && page)
      console.info(
        'Browser failure state',
        await page.evaluate(() => ({
          text: document.body.innerText.slice(-3500),
          active: document.activeElement?.outerHTML.slice(0, 300),
          frames: [...document.querySelectorAll<HTMLIFrameElement>('iframe[data-doop-frame]')].map((el) => ({
            title: el.title,
            rect: el.getBoundingClientRect().toJSON(),
          })),
        })),
      )
  })

  beforeEach(async () => {
    await page.setViewport({ width: 1280, height: 900 })
    canvas = await (await client.post('/api/canvases', { name: 'Reference browser proof' })).json()
    source = await (
      await client.post(`/api/canvases/${canvas.id}/frames`, {
        name: 'Freigegebene Quelle',
        x: 0,
        y: 0,
        width: 240,
        height: 160,
        html: '<!doctype html><html><body><h1>Quelle</h1><p>Freigegebene Werbung</p></body></html>',
      })
    ).json()
    target = await (
      await client.post(`/api/canvases/${canvas.id}/frames`, {
        name: 'Separates Ziel',
        x: 320,
        y: 0,
        width: 200,
        height: 160,
        html: '<!doctype html><html><body><h1>Ziel</h1></body></html>',
      })
    ).json()
    await load()
  })

  async function load(width = 1280) {
    await page.setViewport({ width, height: 900 })
    await page.goto(`${origin}/c/${canvas.id}?frame=${source.id}`)
    await page.waitForSelector('iframe[title="Freigegebene Quelle"]')
    await page.waitForFunction(() => document.querySelector('.stage')?.getAttribute('style')?.includes('--zoom'))
  }

  async function clickText(selector: string, text: string) {
    const handle = await page.waitForFunction(
      (selector, text) => [...document.querySelectorAll(selector)].find((el) => el.textContent?.trim() === text),
      {},
      selector,
      text,
    )
    const element = handle.asElement() as ElementHandle<Element> | null
    if (!element) throw new Error(`Missing ${text}`)
    await element.click()
    await handle.dispose()
  }

  async function keyboardActivate(selector: string, text?: string) {
    // Reach the control using actual Tab navigation; no DOM focus/click bypass.
    for (let i = 0; i < 90; i++) {
      await page.keyboard.press('Tab')
      if (
        await page.evaluate(
          ({ selector, text }) =>
            document.activeElement?.matches(selector) && (!text || document.activeElement.textContent?.trim() === text),
          { selector, text },
        )
      ) {
        await page.keyboard.press('Enter')
        return
      }
    }
    throw new Error(`Tab could not reach ${selector}`)
  }

  async function box(name = source.name) {
    return page.$eval(`iframe[title="${name}"]`, (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x, y: r.y, width: r.width, height: r.height }
    })
  }

  async function selectFrame(name: string) {
    const frame = name === source.name ? source : target
    await page.click(`[data-row-key="${frame.id}"]`)
    await page.waitForSelector(`[data-row-key="${frame.id}"][aria-selected="true"]`)
  }

  async function markFromClosedPanel(width = 1280) {
    await load(width)
    if (width === 1280) await page.click('[aria-label="Bereich schließen"]')
    // A deep link intentionally opens the mobile Inspector; close that modal before accessing the Stage.
    if (width === 390 && (await page.$('[role="dialog"]'))) {
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { hidden: true })
    }
    await page.waitForSelector(composer, { hidden: true })
    const b = await box()
    await page.mouse.click(b.x + 35, b.y + 35, { button: 'right' })
    await clickText('[role="menuitem"]', 'Als Referenz verwenden')
    await page.waitForFunction((selector) => document.activeElement?.matches(selector), {}, composer)
    await page.waitForSelector('img[alt="Referenz: Freigegebene Quelle"]')
    await page.waitForFunction(() => {
      const preview = document.querySelector<HTMLImageElement>('img[alt="Referenz: Freigegebene Quelle"]')
      return preview?.complete && preview.naturalWidth > 0
    })
    if (width === 390) {
      expect(await page.$eval('[role="dialog"]', (el) => el.contains(document.activeElement))).toBe(true)
    }
  }

  async function currentCanvas(): Promise<Canvas> {
    return (await client.get(`/api/canvases/${canvas.id}`)).json()
  }

  async function send(text: string): Promise<AgentTask> {
    await page.type(composer, text)
    const response = page.waitForResponse(
      (r) => r.url().endsWith(`/api/canvases/${canvas.id}/cards`) && r.request().method() === 'POST',
    )
    await page.click('button[aria-label="Senden"]')
    const res = await response
    expect(res.status()).toBe(200)
    const card = await res.json()
    await page.waitForFunction(
      (selector) => (document.querySelector(selector) as HTMLTextAreaElement)?.value === '',
      {},
      composer,
    )
    return card
  }

  async function drag(selector: string, type: string, file = true, x = 600, y = 320, pdf = false, hitTest = false) {
    return page.evaluate(
      ({ selector, type, file, x, y, pdf, hitTest }) => {
        const el = hitTest ? document.elementFromPoint(x, y) : document.querySelector(selector)
        if (!el) throw new Error(`Missing drop target ${selector}`)
        const dataTransfer = new DataTransfer()
        if (file)
          dataTransfer.items.add(
            new File(
              [
                pdf
                  ? '%PDF-1.4'
                  : '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="60"><rect width="100" height="60" fill="red"/></svg>',
              ],
              pdf ? 'nicht-erlaubt.pdf' : 'werbung.svg',
              { type: pdf ? 'application/pdf' : 'image/svg+xml' },
            ),
          )
        else dataTransfer.setData('text/plain', 'ordinary layer drag')
        const event = new DragEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, dataTransfer })
        let reachedTarget = false
        el.addEventListener(
          type,
          () => {
            reachedTarget = true
          },
          { once: true },
        )
        el.dispatchEvent(event)
        if (!reachedTarget) throw new Error('Drag capture stopped event propagation')
        return event.defaultPrevented
      },
      { selector, type, file, x, y, pdf, hitTest },
    )
  }

  it('drops image files through the stage at pan and zoom on page two', async () => {
    await page.click('[aria-label="Seite hinzufügen"]')
    await page.waitForFunction(() =>
      [...document.querySelectorAll('[data-page-id] button')].some(
        (el) => el.textContent === 'Seite 2' && el.getAttribute('aria-current') === 'page',
      ),
    )
    canvas = await currentCanvas()
    const second = canvas.pages!.find((p) => p.name === 'Seite 2')!
    // A known ruler on page two lets rendered geometry independently confirm the world point.
    const ruler = (await (
      await client.post(`/api/canvases/${canvas.id}/frames`, {
        name: 'Lineal',
        pageId: second.id,
        x: 0,
        y: 0,
        width: 200,
        height: 120,
        html: '<h1>Lineal</h1>',
      })
    ).json()) as Frame
    await page.waitForSelector('iframe[title="Lineal"]')
    await page.click('[aria-label="Zoomstufe"]')
    await clickText('[role="menuitem"]', 'Auf 50 % zoomen')
    await page.click('[aria-label="Hand"]')
    const before = await box('Lineal')
    await page.mouse.move(650, 380)
    await page.mouse.down()
    await page.mouse.move(710, 420, { steps: 5 })
    await page.mouse.up()
    const after = await box('Lineal')
    expect(after.x - before.x).toBeCloseTo(60, 0)
    expect(after.y - before.y).toBeCloseTo(40, 0)
    await page.click('[aria-label="Auswählen"]')
    for (const shield of [false, true]) {
      const b = await box('Lineal')
      const x = Math.trunc(shield ? b.x + b.width / 2 : 620)
      const y = Math.trunc(shield ? b.y + b.height / 2 : 520)
      const geometry = await page.$eval('.stage', (el) => {
        const r = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return {
          left: r.left,
          top: r.top,
          x: parseFloat(style.getPropertyValue('--vx')),
          y: parseFloat(style.getPropertyValue('--vy')),
          zoom: Number(style.getPropertyValue('--zoom')),
        }
      })
      expect(geometry.zoom).toBe(0.5)
      const world = {
        x: (x - geometry.left - geometry.x) / geometry.zoom,
        y: (y - geometry.top - geometry.y) / geometry.zoom,
      }
      // The iframe sits one design pixel inside its frame's border.
      expect(Math.abs(world.x - (ruler.x + (x - b.x) / (b.width / ruler.width)))).toBeLessThanOrEqual(1.1)
      expect(Math.abs(world.y - (ruler.y + (y - b.y) / (b.height / ruler.height)))).toBeLessThanOrEqual(1.1)
      const dropTarget = shield ? 'iframe[title="Lineal"] + div' : '.stage'
      if (shield)
        expect(
          await page.evaluate(({ x, y, dropTarget }) => document.elementFromPoint(x, y)?.matches(dropTarget), {
            x,
            y,
            dropTarget,
          }),
        ).toBe(true)
      expect(await drag(dropTarget, 'dragover', true, x, y)).toBe(true)
      await page.waitForSelector(overlay)
      const created = page.waitForResponse(
        (r) => r.url().endsWith(`/api/canvases/${canvas.id}/frames`) && r.request().method() === 'POST',
      )
      expect(await drag(overlay, 'drop', true, x, y)).toBe(true)
      const frame = (await (await created).json()) as Frame
      expect(frame.pageId).toBe(second.id)
      expect(frame.x + frame.width / 2).toBeCloseTo(world.x, 0)
      expect(frame.y + frame.height / 2).toBeCloseTo(world.y, 0)
      await page.waitForSelector(overlay, { hidden: true })
    }
    const result = await currentCanvas()
    expect(
      result.frames
        .filter((f) => f.pageId === canvas.pages![0]!.id)
        .map((f) => f.id)
        .sort(),
    ).toEqual([source.id, target.id].sort())
    expect(result.frames.filter((f) => f.pageId === second.id)).toHaveLength(3)
    expect(await page.$('img[alt^="Referenz:"]')).toBeNull()
  })

  it('marks and sends a source without turning it into an edit target', async () => {
    await markFromClosedPanel()
    expect(await page.$eval('body', (el) => el.textContent)).toContain('Referenz')
    expect(await page.$eval('body', (el) => el.textContent)).not.toContain('Bearbeitungsziel: Freigegebene Quelle')
    const labelBadge = await page.evaluate(() =>
      [...document.querySelectorAll('.stage span')].some(
        (el) => el.textContent === 'Referenz' && el.parentElement?.textContent?.includes('Freigegebene Quelle'),
      ),
    )
    expect(labelBadge).toBe(true)
    const card = await send('Erstelle ein separates Design nach dieser visuellen Orientierung')
    expect(card.attachments).toEqual([source.id])
    expect(card.scope).toBeUndefined()
    await page.waitForSelector('img[alt^="Referenz:"]', { hidden: true })
    // Select a distinct frame using real canvas navigation and preserve its scope.
    await selectFrame(source.name)
    await clickText('button', 'Auswahl als Referenz')
    await page.click('[aria-label="Bereich schließen"]')
    await selectFrame(target.name)
    await page.keyboard.down('Control')
    await page.keyboard.press('k')
    await page.keyboard.up('Control')
    await page.waitForFunction(() => document.body.textContent?.includes('Bearbeitungsziel: Separates Ziel'))
    const scoped = await send('Überarbeite dieses Ziel mit der Quelle als Orientierung')
    expect(scoped.attachments).toEqual([source.id])
    expect(scoped.scope).toEqual({ frameId: target.id })
    const next = await send('Noch ein Auftrag ohne Referenz')
    expect(next.attachments ?? []).toEqual([])
    const frames = (await currentCanvas()).frames
    expect(frames.find((f) => f.id === source.id)?.html).toBe(source.html)
    expect(frames).toHaveLength(2)
  })

  it.each([390, 1280])(
    'supports keyboard selection and restores the reference draft after panel switches at %ipx',
    async (width) => {
      await markFromClosedPanel(width)
      await page.type(composer, 'Mein flüchtiger Entwurf')
      await keyboardActivate('[aria-label="Referenz Freigegebene Quelle entfernen"]')
      await page.waitForSelector('img[alt^="Referenz:"]', { hidden: true })
      expect((await currentCanvas()).frames.some((f) => f.id === source.id)).toBe(true)
      await keyboardActivate('button', 'Auswahl als Referenz')
      await page.waitForSelector('img[alt="Referenz: Freigegebene Quelle"]')
      await clickText('[role="tab"]', 'Designwissen')
      await page.waitForSelector(composer, { hidden: true })
      await clickText('[role="tab"]', 'Agenten')
      await page.waitForSelector(composer)
      expect(await page.$eval(composer, (el) => (el as HTMLTextAreaElement).value)).toBe('Mein flüchtiger Entwurf')
      await page.waitForSelector('img[alt="Referenz: Freigegebene Quelle"]')
      const layout = await page.evaluate((notice) => {
        const text = [...document.querySelectorAll('p')].find(
          (el) => el.textContent?.replace(/\s+/g, ' ').trim() === notice,
        )
        const controls = [
          text,
          document.querySelector('[aria-label="Senden"]'),
          document.querySelector('[aria-label="Referenz Freigegebene Quelle entfernen"]'),
        ]
        return controls.map((el) => {
          if (!el) return false
          const r = el.getBoundingClientRect()
          return (
            r.width > 0 &&
            r.height > 0 &&
            r.left >= 0 &&
            r.right <= innerWidth &&
            r.top >= 0 &&
            r.bottom <= innerHeight &&
            el.scrollWidth <= el.clientWidth + 1 &&
            // A control inside the viewport can still be clipped by its panel.
            (el.tagName !== 'BUTTON' ||
              (el.contains(document.elementFromPoint(r.left + 1, r.top + r.height / 2)) &&
                el.contains(document.elementFromPoint(r.right - 1, r.top + r.height / 2))))
          )
        })
      }, notice)
      expect(layout).toEqual([true, true, true])
      await page.click('[aria-label="Bereich schließen"]')
      await page.keyboard.down('Control')
      await page.keyboard.press('k')
      await page.keyboard.up('Control')
      await page.waitForSelector('img[alt="Referenz: Freigegebene Quelle"]')
      expect(await page.$eval(composer, (el) => (el as HTMLTextAreaElement).value)).toBe('Mein flüchtiger Entwurf')
    },
  )

  it('cleans up file drag UI without intercepting ordinary drags', async () => {
    for (const end of ['dragleave', 'dragend', 'blur']) {
      expect(await drag('.stage', 'dragover')).toBe(true)
      await page.waitForSelector(overlay)
      if (end === 'dragleave') await drag('.stage', end)
      else await page.evaluate((end) => window.dispatchEvent(new Event(end)), end)
      await page.waitForSelector(overlay, { hidden: true })
    }
    expect(await drag('.stage', 'dragover', false)).toBe(false)
    expect(await drag('.stage', 'drop', false)).toBe(false)
    expect(await page.$(overlay)).toBeNull()
    const url = page.url()
    expect(await drag('.stage', 'drop', true, 600, 350, true)).toBe(true)
    await page.waitForFunction(() =>
      document.body.textContent?.includes('Nicht unterstützter Dateityp. Erlaubt sind PNG, JPG, WebP, GIF und SVG.'),
    )
    expect(page.url()).toBe(url)
    expect((await currentCanvas()).frames).toHaveLength(2)
    // A normal frame-label pointer drag still edits its real persisted geometry.
    const b = await box()
    const changed = page.waitForResponse(
      (r) => r.url().endsWith(`/api/frames/${source.id}`) && r.request().method() === 'PATCH',
    )
    await page.mouse.move(b.x + 25, b.y - 12)
    await page.mouse.down()
    await page.keyboard.down('Alt')
    await page.mouse.move(b.x + 65, b.y + 18, { steps: 5 })
    await page.mouse.up()
    await page.keyboard.up('Alt')
    expect((await changed).ok()).toBe(true)
    const moved = (await currentCanvas()).frames.find((f) => f.id === source.id)!
    expect(moved.x).toBeCloseTo(source.x + 40, 0)
    expect(moved.y).toBeCloseTo(source.y + 30, 0)
    await page.click(composer)
    await page.type(composer, 'Normaler Text')
    await page.evaluate((selector) => {
      const data = new DataTransfer()
      data.setData('text/plain', 'unverändert')
      const event = new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data })
      document.querySelector(selector)!.dispatchEvent(event)
      if (event.defaultPrevented) throw new Error('Ordinary text paste was intercepted')
    }, composer)
    // Image paste still uses the existing global import path when focus is on the stage.
    await page.mouse.click(650, 600)
    const pasted = page.waitForResponse(
      (r) => r.url().endsWith(`/api/canvases/${canvas.id}/frames`) && r.request().method() === 'POST',
    )
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.items.add(
        new File(['<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>'], 'paste.svg', {
          type: 'image/svg+xml',
        }),
      )
      document
        .querySelector('.stage')!
        .dispatchEvent(new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: data }))
    })
    expect((await pasted).ok()).toBe(true)
    expect((await currentCanvas()).frames).toHaveLength(3)
  })

  it('preserves internal layer reordering after a cancelled file drag', async () => {
    await drag('.stage', 'dragover')
    await page.waitForSelector(overlay)
    await page.evaluate(() => window.dispatchEvent(new Event('dragend')))
    await page.waitForSelector(overlay, { hidden: true })
    const heading = `[data-row-key="${source.id}|body:nth-of-type(1) > h1:nth-of-type(1)"]`
    const paragraph = `[data-row-key="${source.id}|body:nth-of-type(1) > p:nth-of-type(1)"]`
    await page.waitForSelector(heading)
    await page.click(heading)
    await page.waitForSelector(`${heading}[aria-selected="true"]`)
    const from = await page.$eval(heading, (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x + 80, y: r.y + 14 }
    })
    const to = await page.$eval(paragraph, (el) => {
      const r = el.getBoundingClientRect()
      return { x: r.x + 80, y: r.bottom - 2 }
    })
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`/api/frames/${source.id}`) && r.request().method() === 'PATCH',
    )
    await page.mouse.move(from.x, from.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 6 })
    await page.mouse.up()
    expect((await saved).ok()).toBe(true)
    const html = (await currentCanvas()).frames.find((f) => f.id === source.id)!.html
    expect(html).toContain('<p>Freigegebene Werbung</p>')
    expect(html.indexOf('<p>Freigegebene Werbung</p>')).toBeLessThan(html.indexOf('<h1>Quelle</h1>'))
    expect(await page.$(overlay)).toBeNull()
  })

  it('prevents file navigation over panels without importing and removes capture guards on unmount', async () => {
    await page.type(composer, 'Behalte diesen Entwurf')
    const url = page.url()
    const requests: string[] = []
    const capture = (req: import('puppeteer-core').HTTPRequest) => {
      if (req.method() === 'POST' && /\/(assets|frames)$/.test(new URL(req.url()).pathname)) requests.push(req.url())
    }
    page.on('request', capture)
    try {
      for (const selector of ['[role="tabpanel"][data-state="active"]', composer]) {
        const point = await page.$eval(selector, (el) => {
          const r = el.getBoundingClientRect()
          return { x: Math.trunc(r.x + r.width / 2), y: Math.trunc(r.y + r.height / 2) }
        })
        // Enter the Stage first, then move over a panel with the overlay active.
        expect(await drag('.stage', 'dragover', true, 620, 520, false, true)).toBe(true)
        await page.waitForSelector(overlay)
        expect(
          await page.evaluate(
            ({ selector, point }) => {
              const panel = document.querySelector(selector)
              return panel?.contains(document.elementFromPoint(point.x, point.y))
            },
            { selector, point },
          ),
        ).toBe(true)
        expect(await drag(selector, 'dragover', true, point.x, point.y, false, true)).toBe(true)
        expect(await drag(selector, 'drop', true, point.x, point.y, false, true)).toBe(true)
        await page.waitForSelector(overlay, { hidden: true })
        expect(await drag(selector, 'dragover', false)).toBe(false)
        expect(await drag(selector, 'drop', false)).toBe(false)
      }
      expect(page.url()).toBe(url)
      expect(await page.$eval(composer, (el) => (el as HTMLTextAreaElement).value)).toBe('Behalte diesen Entwurf')
      expect((await currentCanvas()).frames).toHaveLength(2)
      // Vite's persistent HMR connection prevents whole-page network idle.
      // Observe only the forbidden mutations; the request listener also catches earlier requests.
      await expect(
        page.waitForRequest(
          (req) => req.method() === 'POST' && /\/(assets|frames)$/.test(new URL(req.url()).pathname),
          { timeout: 500 },
        ),
      ).rejects.toThrow('Timed out')
      expect(requests).toEqual([])
      expect(await page.$(overlay)).toBeNull()
      // SPA navigation keeps this document alive, so an unremoved window listener would still catch the event.
      await page.click('[aria-label="Alle Arbeitsflächen"]')
      await page.waitForSelector('.stage', { hidden: true })
      expect(await drag('body', 'dragover')).toBe(false)
      expect(await drag('body', 'drop')).toBe(false)
      expect(await drag('body', 'drop', false)).toBe(false)
    } finally {
      page.off('request', capture)
    }
  })
})
