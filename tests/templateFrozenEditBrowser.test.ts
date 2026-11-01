import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Frame as PupFrame, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot'
import { assertTemplateWrite } from '../server/prowin/templateGuard'
import type { Canvas } from '../shared/types'

type Message = {
  type: string
  reqId?: string
  html?: string
  text?: string
  hit?: { selector: string } | null
}
type Fixture = { messages: Message[]; testReady: boolean }

/* Breaks caught here: whole-selection type/delete replacing a locked
   descendant the length arithmetic alone would allow; fence attributes
   leaking into serialized saves (the server refuses runtime-only changes
   on frozen content); the input fallback adopting a lock-removing edit as
   the new baseline. Real selections and keystrokes in a real runtime, and
   the saved result judged by the real server guard. Hand-derived literals. */
describe.skipIf(!findBrowserPath())('template frozen-descendant editing', { timeout: 60_000 }, () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let runtime: PupFrame
  let seq = 0
  const errors: string[] = []

  const FIELD =
    '<section data-od-id="f" data-od-role="body" data-od-max-length="50">' +
    '<span id="t">Hello <span id="lk" data-od-id="lk" data-od-locked="true">locked</span> world</span></section>'
  const DOCUMENT = `<!doctype html><html><head></head><body>${FIELD}</body></html>`

  beforeAll(async () => {
    vite = await createServer({ server: { port: 0 }, logLevel: 'error' })
    await vite.listen()
    browser = await getBrowser()
    page = await browser.newPage()
    page.setDefaultTimeout(10_000)
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.setViewport({ width: 1000, height: 900 })
    await page.goto(`${vite.resolvedUrls!.local[0]}tests/fixtures/frameRuntime.html`)
    await page.waitForFunction(
      () => (window as unknown as Fixture).testReady,
      { timeout: 60_000 },
    )
    runtime = page.frames().find((frame) => frame.parentFrame())!
  }, 60_000)

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    expect(errors).toEqual([])
  })

  async function send(message: Record<string, unknown>) {
    await page.evaluate(
      (data) => document.querySelector('iframe')!.contentWindow!.postMessage(data, '*'),
      message,
    )
  }

  async function ask(message: Record<string, unknown>, reply: string): Promise<Message> {
    const reqId = `frozen-${++seq}`
    await send({ ...message, reqId })
    await page.waitForFunction(
      (id, type) => (window as unknown as Fixture).messages.some((m) => m.reqId === id && m.type === type),
      {},
      reqId,
      reply,
    )
    return page.evaluate((id) => (window as unknown as Fixture).messages.find((m) => m.reqId === id)!, reqId)
  }

  function notices(): Promise<string[]> {
    return page.evaluate(() => (window as unknown as Fixture).messages.filter((m) => m.type === 'doop:edit-notice').map((m) => m.text ?? ''))
  }

  async function editedHtml(): Promise<string> {
    await page.waitForFunction(
      () => (window as unknown as Fixture).messages.some((m) => m.type === 'doop:edited'),
      { timeout: 10_000 },
    )
    return page.evaluate(() => (window as unknown as Fixture).messages.find((m) => m.type === 'doop:edited')!.html!)
  }

  async function startField() {
    await page.evaluate(() => {
      ;(window as unknown as Fixture).messages = []
    })
    await ask({ type: 'doop:html', html: DOCUMENT }, 'doop:html-result')
    await send({ type: 'doop:edit', on: true })
    /* activate on the free text (not on the locked span, which refuses) */
    const box = (await (await runtime.$('#t'))!.boundingBox())!
    await page.mouse.click(box.x + 8, box.y + 8)
    await runtime.waitForSelector('#t[contenteditable]')
  }

  async function stopField() {
    await send({ type: 'doop:edit', on: false })
    await new Promise((r) => setTimeout(r, 300))
  }

  async function selectAll() {
    /* focus free text, never the locked span: a click on the lock would
       deactivate instead of focusing, and the test would pass vacuously */
    const box = (await (await runtime.$('#t'))!.boundingBox())!
    await page.mouse.click(box.x + 8, box.y + 8)
    await runtime.waitForSelector('#t[contenteditable]')
    await page.keyboard.down('Control')
    await page.keyboard.press('a')
    await page.keyboard.up('Control')
    const selected = await runtime.evaluate(() => window.getSelection()?.toString() ?? '')
    expect(selected).toContain('locked')
  }

  const liveText = () => runtime.$eval('#t', (el) => el.textContent)
  const lockText = () => runtime.$eval('#lk', (el) => el.textContent)

  it('refuses whole-selection typing over a locked descendant', async () => {
    await startField()
    await selectAll()
    expect(await runtime.evaluate(() => window.getSelection()?.toString())).toContain('locked')
    await page.keyboard.type('X')
    await new Promise((r) => setTimeout(r, 300))
    /* Chromium refuses the edit silently without firing beforeinput; the
       range guard covers engines that announce it — either way the frozen
       content and the valid text survive untouched */
    expect(await liveText()).toBe('Hello locked world')
    expect(await lockText()).toBe('locked')
    await stopField()
  }, 30_000)

  it('refuses whole-selection Delete and Backspace over a locked descendant', async () => {
    await startField()
    await selectAll()
    await page.keyboard.press('Backspace')
    await new Promise((r) => setTimeout(r, 300))
    expect(await liveText()).toBe('Hello locked world')
    await selectAll()
    await page.keyboard.press('Delete')
    await new Promise((r) => setTimeout(r, 300))
    expect(await liveText()).toBe('Hello locked world')
    expect(await lockText()).toBe('locked')
    await stopField()
  }, 30_000)

  it('restores a lock removed by an unannounced edit in the input fallback', async () => {
    await startField()
    /* simulate an IME/drop edit the browser did not announce: the lock is
       gone before the input event fires */
    await runtime.$eval('#lk', (el) => el.remove())
    await runtime.evaluate(() => document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true })))
    await new Promise((r) => setTimeout(r, 300))
    expect(await lockText()).toBe('locked')
    expect((await notices()).some((n) => n.includes('gesperrt'))).toBe(true)
    await stopField()
  }, 30_000)

  it('saves valid typing beside a locked child in server-accepted form', async () => {
    await startField()
    const box = (await (await runtime.$('#t'))!.boundingBox())!
    await page.mouse.click(box.x + 8, box.y + 8)
    await runtime.waitForSelector('#t[contenteditable]')
    await page.keyboard.press('End')
    await page.keyboard.type('!')
    const html = await editedHtml()
    /* author markup only: no runtime fence attributes leak into the save */
    expect(html).not.toContain('contenteditable')
    expect(html).not.toContain('data-v-frozen')
    expect(html).toContain('data-od-locked="true"')
    expect(html).toContain('>locked</span>')
    expect(html).toContain('world!</span>')
    /* the real server guard accepts the save for a non-creator canvas … */
    const canvas = { id: 'c', name: 'Canvas', frames: [] } as unknown as Canvas
    expect(() => assertTemplateWrite(canvas, DOCUMENT, html)).not.toThrow()
    /* … and still refuses tampering with the locked descendant */
    const tampered = html.replace('>locked</span>', '>unlocked</span>')
    expect(() => assertTemplateWrite(canvas, DOCUMENT, tampered)).toThrow()
    await stopField()
  }, 30_000)
})
