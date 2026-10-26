import { afterAll, beforeAll, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { join } from 'node:path'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import { Client, freePort, startServer, type Server } from './harness'

let vite: ViteDevServer
let server: Server
let browser: Browser
let page: Page
let origin: string
let canvasId: string
const name = 'Deutsche Arbeitsfläche für die Abnahme'

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
  server = await startServer({ PORT: String(port), BETTER_AUTH_URL: origin, SMTP_HOST: '' })
  const client = await new Client(server).signUp('gandalf@test.dev', 'Gandalf')
  canvasId = (await (await client.post('/api/canvases', { name })).json()).id
  browser = await getBrowser()
  page = await browser.newPage()
  page.setDefaultTimeout(10_000)
}, 60_000)

afterAll(async () => {
  await page?.close()
  await browser?.close()
  await vite?.close()
  server?.stop()
  await server?.stopped
})

async function clickText(selector: string, text: string) {
  await page.waitForFunction(
    (selector, text) => [...document.querySelectorAll(selector)].some((node) => node.textContent?.trim() === text),
    {},
    selector,
    text,
  )
  await page.evaluate(
    (selector, text) =>
      (
        [...document.querySelectorAll(selector)].find((node) => node.textContent?.trim() === text) as HTMLElement
      ).click(),
    selector,
    text,
  )
}

async function dialogFits(role: string) {
  await page.waitForSelector(`[role="${role}"]`)
  const layout = await page.$eval(`[role="${role}"]`, (dialog) => {
    const rect = dialog.getBoundingClientRect()
    return {
      left: rect.left,
      right: rect.right,
      width: innerWidth,
      overflow: dialog.scrollWidth - dialog.clientWidth,
      controls: [...dialog.querySelectorAll('button, input')].every((element) => {
        const box = element.getBoundingClientRect()
        return box.left >= rect.left - 1 && box.right <= rect.right + 1
      }),
    }
  })
  expect(layout.left).toBeGreaterThanOrEqual(0)
  expect(layout.right).toBeLessThanOrEqual(layout.width)
  expect(layout.overflow).toBeLessThanOrEqual(1)
  expect(layout.controls).toBe(true)
}

it.skipIf(!findBrowserPath())(
  'supports German login, narrow sharing and deletion, keyboard dismissal, settings and a new frame',
  async () => {
    await page.setViewport({ width: 360, height: 800 })
    await page.goto(`${origin}/auth`, { waitUntil: 'networkidle0' })
    expect(await page.$eval('html', (html) => html.lang)).toBe('de')
    await page.waitForSelector('input[type="email"]')
    await page.type('input[type="email"]', 'gandalf@test.dev')
    await page.type('input[type="password"]', 'password12345')
    await page.click('button[type="submit"]')
    await page.waitForSelector(`[aria-label="Aktionen für ${name}"]`)
    console.info('German login and home verified at 360px')

    for (const width of [360, 390, 768]) {
      await page.setViewport({ width, height: 800 })
      await page.click(`[aria-label="Aktionen für ${name}"]`)
      await clickText('[role="menuitem"]', 'Teilen')
      await dialogFits('dialog')
      // The harness owns this fresh temp directory and removes screenshots with its test data.
      await page.screenshot({ path: join(server.dataDir, `sharing-${width}.png`) })
      await page.keyboard.press('Tab')
      expect(await page.$eval('[role="dialog"]', (dialog) => dialog.contains(document.activeElement))).toBe(true)
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { hidden: true })
      await page.click(`[aria-label="Aktionen für ${name}"]`)
      await clickText('[role="menuitem"]', 'Teilen')
      await page.waitForSelector('[role="dialog"] [aria-label="Schließen"]')
      await page.click('[role="dialog"] [aria-label="Schließen"]')
      await page.waitForSelector('[role="dialog"]', { hidden: true })

      await page.click(`[aria-label="Aktionen für ${name}"]`)
      await clickText('[role="menuitem"]', 'Löschen')
      await dialogFits('alertdialog')
      await page.screenshot({ path: join(server.dataDir, `delete-${width}.png`) })
      await clickText('[role="alertdialog"] button', 'Abbrechen')
      await page.waitForSelector('[role="alertdialog"]', { hidden: true })
      console.info(`Sharing/deletion fit, keyboard, Escape, close and cancel verified at ${width}px`)
      expect(await page.$(`[aria-label="Aktionen für ${name}"]`)).not.toBeNull()
      await page.click(`[aria-label="Aktionen für ${name}"]`)
      await clickText('[role="menuitem"]', 'Löschen')
      await page.waitForFunction(() => document.querySelector('[role="alertdialog"]')?.contains(document.activeElement))
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="alertdialog"]', { hidden: true })
    }
    await page.goto(`${origin}/settings`)
    await page.waitForFunction(() => document.body.textContent?.includes('Einstellungen'))
    expect(await page.$eval('body', (body) => body.textContent)).toContain('Konto')
    console.info('German settings verified')
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${origin}/c/${canvasId}`)
    await page.waitForSelector('button[aria-label="Neue Zeichenfläche"]')
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    await page.waitForSelector('iframe[data-doop-frame]')
    const html = await page.evaluate(async (id) => {
      const canvas = await (await fetch(`/api/canvases/${id}`)).json()
      return canvas.frames[0].html as string
    }, canvasId)
    expect(html).toContain('<html lang="de">')
    expect(html).toContain('Gestalte mich – bearbeite das HTML oder frage einen Agenten.')
  },
  30_000,
)
