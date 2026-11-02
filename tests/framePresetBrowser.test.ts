import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import type { Canvas, Frame } from '../shared/types'
import { freePort, startServer, type Server } from './harness'

describe.skipIf(!findBrowserPath())('frame preset manual entry points', () => {
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
    page.setDefaultTimeout(10_000)
    await page.setViewport({ width: 1400, height: 900 })
    await page.goto(origin)
    await page.evaluate(async () => {
      const signup = await fetch('/api/auth/sign-up/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Preset Tester', email: 'preset-ui@test.dev', password: 'password12345' }),
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
        body: JSON.stringify({ name: 'Preset UI' }),
      })
      if (!response.ok) throw new Error(await response.text())
      return (await response.json()).id
    })
    await page.goto(`${origin}/c/${canvasId}`)
    await page.waitForSelector('button[aria-label="Neue Zeichenfläche"]')
  })
  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    await server?.stop()
  })
  const frames = () =>
    page.evaluate(async (id) => ((await (await fetch(`/api/canvases/${id}`)).json()) as Canvas).frames, canvasId)
  async function confirm(preset: string): Promise<Frame> {
    await page.waitForSelector('[role="dialog"] input[name="frame-format"]')
    await page.click(`[role="dialog"] input[value="${preset}"]`)
    const response = page.waitForResponse(
      (res) => res.url().endsWith(`/api/canvases/${canvasId}/frames`) && res.request().method() === 'POST',
    )
    await page.click('[role="dialog"] button[type="submit"]')
    const result = await response
    expect(result.ok()).toBe(true)
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    return result.json()
  }

  it('cancels desktop creation and keeps canvas shortcuts inside the dialog', async () => {
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    await page.waitForSelector('[role="dialog"] input[value="free"]')
    expect(await frames()).toHaveLength(0)
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role="dialog"]', { hidden: true })
    expect(await frames()).toHaveLength(0)
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    expect(await confirm('a4')).toMatchObject({ preset: 'a4', width: 794, height: 1123 })
    await page.waitForSelector('[role="treeitem"][aria-selected="true"]')
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    await page.focus('[role="dialog"] button[type="submit"]')
    await page.keyboard.press('Delete')
    expect(await frames()).toHaveLength(1)
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role="dialog"]', { hidden: true })
  }, 20_000)

  it('opens the same dialog from the Stage context menu and creates Status rather than Story', async () => {
    await page.click('.stage', { button: 'right', offset: { x: 700, y: 700 } })
    await page.waitForSelector('[role="menuitem"]')
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')]
        .find((item) => item.textContent === 'Neue Zeichenfläche')!
        .click(),
    )
    expect(await confirm('wa-status')).toMatchObject({ preset: 'wa-status', width: 1080, height: 1920 })
  }, 20_000)

  it('opens a keyboard-accessible mobile dialog instead of creating behind the Layers sheet', async () => {
    await page.setViewport({ width: 390, height: 844 })
    await page.reload()
    await page.waitForSelector('[aria-label="Aktionen für die Arbeitsfläche"]')
    await page.click('[aria-label="Aktionen für die Arbeitsfläche"]')
    await page.waitForSelector('[role="dialog"]')
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[role="dialog"] button')]
        .find((el) => el.textContent?.trim() === 'Ebenen')!
        .click(),
    )
    await page.waitForSelector('button[aria-label="Neue Zeichenfläche"]')
    await page.evaluate(() =>
      Promise.all(
        [...document.querySelectorAll('[data-slot="sheet-content"]')].flatMap((el) =>
          el.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
        ),
      ),
    )
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    await page.waitForSelector('[role="dialog"] input[value="free"]')
    expect(await page.$$('[role="dialog"] input[name="frame-format"]')).toHaveLength(6)
    const free = await confirm('free')
    expect(free).toMatchObject({ width: 640, height: 480 })
    expect(free).not.toHaveProperty('preset')
    await page.setViewport({ width: 1400, height: 900 })
  }, 20_000)

  it('duplicates customized preset dimensions and preserves them across undo/redo with a live source', async () => {
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    const source = await confirm('a4')
    await page.evaluate(async (id) => {
      const response = await fetch(`/api/frames/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: 820, height: 1160 }),
      })
      if (!response.ok) throw new Error(await response.text())
    }, source.id)
    await page.waitForFunction(
      (name) => document.querySelector<HTMLIFrameElement>(`iframe[title="${name}"]`)?.style.width === '820px',
      {},
      source.name,
    )
    const copyResponse = page.waitForResponse(
      (res) => res.url().endsWith(`/api/canvases/${canvasId}/frames`) && res.request().method() === 'POST',
    )
    await page.keyboard.down('Meta')
    await page.keyboard.press('d')
    await page.keyboard.up('Meta')
    const copy = (await (await copyResponse).json()) as Frame
    expect(copy).toMatchObject({ preset: 'a4', width: 820, height: 1160 })
    await page.waitForFunction(
      (name) =>
        [...document.querySelectorAll('[role="treeitem"][aria-selected="true"]')].some((el) =>
          el.textContent?.includes(name),
        ),
      {},
      copy.name,
    )
    const deleted = page.waitForResponse(
      (res) => res.url().endsWith(`/api/frames/${copy.id}`) && res.request().method() === 'DELETE',
    )
    await page.keyboard.down('Meta')
    await page.keyboard.press('z')
    await page.keyboard.up('Meta')
    const deletedResponse = await deleted
    expect(deletedResponse.ok()).toBe(true)
    await deletedResponse.text()
    await page.evaluate(() => new Promise(requestAnimationFrame))
    const redone = page.waitForResponse(
      (res) => res.url().endsWith(`/api/canvases/${canvasId}/frames`) && res.request().method() === 'POST',
    )
    await page.keyboard.down('Meta')
    await page.keyboard.down('Shift')
    await page.keyboard.press('z')
    await page.keyboard.up('Shift')
    await page.keyboard.up('Meta')
    expect(await (await redone).json()).toMatchObject({ preset: 'a4', width: 820, height: 1160 })
  }, 20_000)

  it('keeps customized Creator dimensions through Delete, Undo, Redo and a second Undo without a live source', async () => {
    await page.click('button[aria-label="Neue Zeichenfläche"]')
    const source = await confirm('a4')
    await page.evaluate(async (id) => {
      const response = await fetch(`/api/frames/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ width: 820, height: 1160 }),
      })
      if (!response.ok) throw new Error(await response.text())
    }, source.id)
    await page.waitForFunction(
      (name) => document.querySelector<HTMLIFrameElement>(`iframe[title="${name}"]`)?.style.width === '820px',
      {},
      source.name,
    )
    const write = async (method: string, action: () => Promise<void>) => {
      const response = page.waitForResponse(
        (res) => res.request().method() === method && /\/api\/(frames|canvases)\//.test(new URL(res.url()).pathname),
      )
      await action()
      const result = await response
      expect(result.ok()).toBe(true)
      const body = await result.json()
      await page.evaluate(() => new Promise(requestAnimationFrame))
      return body as Frame
    }
    const shortcut = async (redo = false) => {
      await page.keyboard.down('Meta')
      if (redo) await page.keyboard.down('Shift')
      await page.keyboard.press('z')
      if (redo) await page.keyboard.up('Shift')
      await page.keyboard.up('Meta')
    }
    await write('DELETE', () => page.keyboard.press('Delete'))
    expect(await frames()).toEqual([])
    expect(await write('POST', () => shortcut())).toMatchObject({ preset: 'a4', width: 820, height: 1160 })
    await write('DELETE', () => shortcut(true))
    expect(await frames()).toEqual([])
    expect(await write('POST', () => shortcut())).toMatchObject({ preset: 'a4', width: 820, height: 1160 })
  }, 20_000)
})
