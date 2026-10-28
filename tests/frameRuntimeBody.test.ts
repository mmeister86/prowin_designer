import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot.ts'

type Inspect = { classes: string[]; backgroundColor: string; padding: number[] } | null
type Message = { type: string; reqId?: string; info?: Inspect }
/* the runtime fixture collects every frame message on window.messages; the
   cast is inlined because puppeteer serialises each callback's source */
type Fixture = { messages: Message[]; testReady: boolean }

// Agent design systems (design.how's "glaze", "quartz") scope every rule under
// a class on <body>. The runtime morphs incoming HTML into its bootstrap
// document, so the body's own attributes have to travel too or the whole
// stylesheet matches nothing and the frame renders as browser defaults.
describe.skipIf(!findBrowserPath())('frame runtime body attributes', () => {
  let server: ViteDevServer
  let browser: Browser
  let page: Page
  let seq = 0
  beforeAll(async () => {
    server = await createServer({
      server: { port: 0 },
      logLevel: 'error',
    })
    await server.listen()
    browser = await getBrowser()
    page = await browser.newPage()
    await page.goto(`${server.resolvedUrls!.local[0]}tests/fixtures/frameRuntime.html`)
    await page.waitForFunction(
      () =>
        (window as unknown as Fixture).testReady &&
        (window as unknown as Fixture).messages.some((m) => m.type === 'doop:frame-ready'),
      {
        timeout: 60_000,
      },
    )
  }, 60_000)
  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await server?.close()
  })

  async function ask<T extends Message>(message: Record<string, unknown>, reply: string): Promise<T> {
    const reqId = `req-${++seq}`
    await page.evaluate((message) => document.querySelector('iframe')!.contentWindow!.postMessage(message, '*'), {
      ...message,
      reqId,
    })
    await page.waitForFunction(
      (reply, reqId) => (window as unknown as Fixture).messages.some((m) => m.type === reply && m.reqId === reqId),
      {},
      reply,
      reqId,
    )
    return page.evaluate(
      (reply, reqId) => (window as unknown as Fixture).messages.find((m) => m.type === reply && m.reqId === reqId) as T,
      reply,
      reqId,
    )
  }
  const render = (html: string) => ask({ type: 'doop:html', html }, 'doop:html-result')
  const inspectBody = async () =>
    (await ask<Message>({ type: 'doop:inspect', selector: 'body' }, 'doop:inspect-result')).info

  it('prevents file drops before and after HTML morphs without blocking text drags', async () => {
    for (const html of ['<p>Before</p>', '<p>After</p>']) {
      await render(html)
      const parentUrl = page.url()
      const frame = page.frames().find((f) => f !== page.mainFrame())!
      const frameUrl = frame.url()
      const beforeMessages = await page.evaluate(() => (window as unknown as Fixture).messages.length)
      const result = await frame.evaluate(() => {
        const before = document.body.innerHTML
        const prevented = [true, false].flatMap((files) =>
          ['dragover', 'drop'].map((type) => {
            const dataTransfer = new DataTransfer()
            if (files) dataTransfer.items.add(new File(['x'], 'a.png', { type: 'image/png' }))
            else dataTransfer.setData('text/plain', 'text')
            const event = new DragEvent(type, { dataTransfer, cancelable: true, bubbles: true })
            document.body.dispatchEvent(event)
            return event.defaultPrevented
          }),
        )
        return { prevented, unchanged: before === document.body.innerHTML }
      })
      expect(result).toEqual({ prevented: [true, true, false, false], unchanged: true })
      expect(frame.url()).toBe(frameUrl)
      expect(page.url()).toBe(parentUrl)
      expect(await page.evaluate(() => (window as unknown as Fixture).messages.length)).toBe(beforeMessages)
    }
  })

  it('applies styles scoped under a body class', async () => {
    await render(
      '<!doctype html><html><head><style>.glaze{background:rgb(1, 2, 3);padding:7px}</style></head>' +
        '<body class="glaze"><h1>Scoped</h1></body></html>',
    )
    const body = await inspectBody()
    expect(body?.classes).toEqual(['glaze'])
    expect(body?.backgroundColor).toBe('rgb(1, 2, 3)')
    expect(body?.padding).toEqual([7, 7, 7, 7])
  })

  it('keeps inline body styles and drops attributes the next design no longer carries', async () => {
    await render('<!doctype html><html><body style="background:rgb(4, 5, 6)"><p>Inline</p></body></html>')
    const inline = await inspectBody()
    expect(inline?.classes).toEqual([])
    expect(inline?.backgroundColor).toBe('rgb(4, 5, 6)')

    await render('<!doctype html><html><body><p>Plain</p></body></html>')
    const plain = await inspectBody()
    expect(plain?.backgroundColor).toBe('rgba(0, 0, 0, 0)')
  })
})
