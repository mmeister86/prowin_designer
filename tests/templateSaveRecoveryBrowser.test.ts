import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page, Frame as PupFrame, HTTPRequest } from 'puppeteer-core'
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
      notice: () => string | null
    }
  }
}

/* Breaks caught here: a rejected inline save (template guard, permissions)
   leaving the invalid content in the store or the live document while the
   edit session stays open; the invalid content reserialized on exiting
   edit; a stale (superseded) rejection rolling back newer content that a
   later save already governs. Real FrameView + runtime + store, PATCH
   held or failed at the network boundary. Hand-derived literals. */
describe.skipIf(!findBrowserPath())('template save recovery', { timeout: 60_000 }, () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  const errors: string[] = []
  let patches: HTTPRequest[] = []
  let autoRespond: null | { status: number; body: string } = null

  const ORIGINAL = '<!doctype html><html><head></head><body><section><p id="t">Hello</p></section></body></html>'

  beforeAll(async () => {
    vite = await createServer({ server: { port: 0 }, logLevel: 'error' })
    await vite.listen()
    browser = await getBrowser()
    page = await browser.newPage()
    page.setDefaultTimeout(10_000)
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.setViewport({ width: 1000, height: 900 })
    await page.setRequestInterception(true)
    page.on('request', async (request) => {
      if (new URL(request.url()).pathname === '/api/frames/f' && request.method() === 'PATCH') {
        /* frame-drag position saves from clicking are not content saves:
           answer at once and only hold html saves for the test driver */
        if (!String(request.postData()).includes('"html"')) {
          await request.respond({ status: 200, contentType: 'application/json', body: request.postData()! })
          return
        }
        patches.push(request)
        if (autoRespond) {
          await request.respond({
            status: autoRespond.status,
            contentType: 'application/json',
            body: autoRespond.body,
          })
        }
        /* otherwise the request stays held until the test answers it */
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

  async function seed() {
    patches = []
    autoRespond = null
    /* fresh page per test: a previous session's open edit must not leak
       live DOM into the next seed */
    await page.reload()
    await page.waitForFunction(() => !!window.elementPanelHarness)
    const frame: Frame = {
      id: 'f',
      canvasId: 'c',
      name: 'Recovery',
      x: 40,
      y: 60,
      width: 600,
      height: 500,
      html: ORIGINAL,
      createdAt: 0,
      updatedAt: 0,
      updatedBy: 'Tester',
    }
    await page.evaluate((value) => window.elementPanelHarness.seed(value), frame)
    const iframe = (await (await page.waitForSelector('iframe'))!.contentFrame())!
    await iframe.waitForSelector('#t')
    return iframe
  }

  async function beginTyping(iframe: PupFrame) {
    await page.evaluate(() => window.elementPanelHarness.selectFrame())
    const box = (await (await iframe.$('#t'))!.boundingBox())!
    await page.mouse.click(box.x + 10, box.y + 8, { count: 2, delay: 60 })
    await page.waitForSelector('[title="Speichern und Bearbeitung beenden (Esc)"]')
    await iframe.click('#t')
    await iframe.waitForSelector('#t[contenteditable]')
  }

  const storeHtml = () => page.evaluate(() => window.elementPanelHarness.currentHtml())
  const liveText = (iframe: PupFrame) => iframe.$eval('#t', (el) => el.textContent)
  const editingOpen = (iframe: PupFrame) => iframe.$('#t[contenteditable]')

  async function waitPatches(n: number) {
    await expect.poll(() => patches.length, { timeout: 10_000 }).toBe(n)
  }

  function deny(request: HTTPRequest) {
    return request.respond({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'template_denied' }),
    })
  }

  it('restores stored state in store and live document when an active inline save is rejected', async () => {
    const iframe = await seed()
    await beginTyping(iframe)
    await page.keyboard.type('X')
    await waitPatches(1)
    await deny(patches[0]!)
    /* German feedback, store rollback, live rollback, edit session ended */
    await expect
      .poll(() => page.evaluate(() => window.elementPanelHarness.notice()), { timeout: 10_000 })
      .toContain('gespeichert')
    await expect.poll(storeHtml, { timeout: 10_000 }).toBe(ORIGINAL)
    await expect.poll(() => liveText(iframe), { timeout: 10_000 }).toBe('Hello')
    expect(await editingOpen(iframe)).toBeNull()
    /* the invalid content is never reserialized: no further save fires */
    await new Promise((r) => setTimeout(r, 900))
    expect(patches.length).toBe(1)
  }, 30_000)

  it('serializes overlapping saves: silent supersede, then newest-confirmed recovery', async () => {
    const iframe = await seed()
    await beginTyping(iframe)
    await page.keyboard.type('A')
    await waitPatches(1)
    await page.keyboard.type('B')
    /* the second save coalesces behind the running first one: still one PATCH */
    await new Promise((r) => setTimeout(r, 700))
    expect(patches.length).toBe(1)
    /* refusing the superseded first save flushes the second and stays
       silent — the session stays open on the newer content */
    await deny(patches[0]!)
    await waitPatches(2)
    await new Promise((r) => setTimeout(r, 300))
    expect(await storeHtml()).toContain('HelloAB')
    expect(await liveText(iframe)).toBe('HelloAB')
    expect(await editingOpen(iframe)).not.toBeNull()
    expect(await page.evaluate(() => window.elementPanelHarness.notice())).toBeNull()
    /* refusing the governing save walks past the refused predecessor:
       full recovery to the stored state */
    await deny(patches[1]!)
    await expect
      .poll(() => page.evaluate(() => window.elementPanelHarness.notice()), { timeout: 10_000 })
      .toContain('gespeichert')
    await expect.poll(storeHtml, { timeout: 10_000 }).toBe(ORIGINAL)
    await expect.poll(() => liveText(iframe), { timeout: 10_000 }).toBe('Hello')
    expect(await editingOpen(iframe)).toBeNull()
  }, 30_000)

  it('keeps remotely moved store content on rejection and resets live to it', async () => {
    const iframe = await seed()
    await beginTyping(iframe)
    await page.keyboard.type('A')
    await waitPatches(1)
    /* a collaborator moves the store while our save is pending */
    const remote = ORIGINAL.replace('Hello', 'Remote')
    await page.evaluate((html) => {
      window.elementPanelHarness.remote({
        id: 'f',
        canvasId: 'c',
        name: 'Recovery',
        x: 40,
        y: 60,
        width: 600,
        height: 500,
        html,
        createdAt: 0,
        updatedAt: 0,
        updatedBy: 'Collaborator',
      })
    }, remote)
    await deny(patches[0]!)
    /* German feedback, but the newer remote store is preserved — and the
       rejected live session ends on exactly that content */
    await expect
      .poll(() => page.evaluate(() => window.elementPanelHarness.notice()), { timeout: 10_000 })
      .toContain('gespeichert')
    await expect.poll(storeHtml, { timeout: 10_000 }).toBe(remote)
    await expect.poll(() => liveText(iframe), { timeout: 10_000 }).toBe('Remote')
    expect(await editingOpen(iframe)).toBeNull()
    /* nothing reserializes the refused content afterwards */
    await new Promise((r) => setTimeout(r, 900))
    expect(patches.length).toBe(1)
  }, 30_000)
})
