import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { createServer, type ViteDevServer } from 'vite'
import { createServer as createHttpServer, type ServerResponse } from 'node:http'
import { readFileSync } from 'node:fs'
import type { Browser, Frame, Page } from 'puppeteer-core'
import { findBrowserPath, getBrowser } from '../server/screenshot.ts'

type Message = { type: string; reqId?: string; origin: string; hit?: { selector: string }; html?: string }
type Fixture = { messages: Message[]; addPreview: (html: string) => Promise<void> }
type FrameState = { violations: string[]; localScript?: boolean; foreignScript?: boolean; inlineRan?: boolean }
const svg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="red"/></svg>'
const font = readFileSync(new URL('../public/fonts/roboto-latin-500-normal.woff2', import.meta.url))

describe.skipIf(!findBrowserPath())('opaque-origin frame CSP (Chromium smoke)', () => {
  let vite: ViteDevServer
  let browser: Browser
  let page: Page
  let runtime: Frame
  let origin: string
  let foreign: string
  let sequence = 0
  const foreignRequests: string[] = []
  const external = createHttpServer((req, res) => {
    foreignRequests.push(req.url!)
    resource(req.url!, res, true)
  })

  function resource(url: string, res: ServerResponse, isForeign = false) {
    res.setHeader('Access-Control-Allow-Origin', '*')
    if (url.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml')
      res.end(svg)
    } else if (url.endsWith('.woff2')) {
      res.setHeader('Content-Type', 'font/woff2')
      res.end(font)
    } else if (url.endsWith('.js')) {
      res.setHeader('Content-Type', 'text/javascript')
      res.end(`window.${isForeign ? 'foreignScript' : 'localScript'} = true`)
    } else if (url.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css')
      res.end('body{--asset-css:loaded}')
    } else if (url.endsWith('/redirect')) {
      res.writeHead(302, { Location: `${foreign}/redirected.svg` })
      res.end()
    } else res.end('ok')
  }

  beforeAll(async () => {
    await new Promise<void>((resolve) => external.listen(0, '127.0.0.1', resolve))
    const address = external.address() as { port: number }
    foreign = `http://127.0.0.1:${address.port}`
    vite = await createServer({
      server: { port: 0 },
      logLevel: 'error',
      plugins: [
        {
          name: 'frame-csp-test-resources',
          configureServer(server) {
            server.middlewares.use('/__csp__', (req, res) => resource(req.url!, res))
          },
        },
      ],
    })
    await vite.listen()
    origin = vite.resolvedUrls!.local[0]!.replace(/\/$/, '')
    browser = await getBrowser()
    page = await browser.newPage()
  }, 60_000)

  beforeEach(async () => {
    await page.goto(`${origin}/tests/fixtures/frameCsp.html`)
    await page.waitForFunction(() =>
      (window as unknown as Fixture).messages.some((message) => message.type === 'doop:frame-ready'),
    )
    runtime = page.frames().find((frame) => frame.parentFrame())!
    await runtime.evaluate(() => {
      ;(window as unknown as FrameState).violations = []
      document.addEventListener('securitypolicyviolation', (event) =>
        (window as unknown as FrameState).violations.push(event.effectiveDirective),
      )
    })
    foreignRequests.length = 0
  })

  afterAll(async () => {
    await page?.close()
    await browser?.close()
    await vite?.close()
    await new Promise<void>((resolve, reject) => external.close((error) => (error ? reject(error) : resolve())))
  })

  async function ask(message: Record<string, unknown>, reply: string): Promise<Message> {
    const reqId = `csp-${++sequence}`
    await page.evaluate(
      (data) => document.querySelector<HTMLIFrameElement>('#runtime')!.contentWindow!.postMessage(data, '*'),
      {
        ...message,
        reqId,
      },
    )
    await page.waitForFunction(
      (reqId, reply) =>
        (window as unknown as Fixture).messages.some((message) => message.reqId === reqId && message.type === reply),
      {},
      reqId,
      reply,
    )
    return page.evaluate(
      (reqId) => (window as unknown as Fixture).messages.find((message) => message.reqId === reqId)!,
      reqId,
    )
  }

  it('blocks foreign resources before and after DOM morphing without breaking the null-origin editor', async () => {
    const ready = await page.evaluate(() =>
      (window as unknown as Fixture).messages.find((m) => m.type === 'doop:frame-ready'),
    )
    expect(ready?.origin).toBe('null')
    for (let version = 0; version < 2; version++) {
      await runtime.evaluate(() => {
        ;(window as unknown as FrameState).violations = []
      })
      await ask(
        {
          type: 'doop:html',
          html: `<!doctype html><html><head>
        <link rel="stylesheet" href="${foreign}/foreign-${version}.css">
        <style>@font-face{font-family:Foreign;src:url('${foreign}/foreign-${version}.woff2')}#target{font-family:Foreign}</style>
        </head><body><p id="target">Version ${version}</p><img src="${foreign}/foreign-${version}.svg">
        <script src="${foreign}/foreign-${version}.js">/* version ${version} */</script>
        <script>fetch('${foreign}/fetch-${version}').catch(function(){})</script></body></html>`,
        },
        'doop:html-result',
      )
      await runtime.evaluate(() => document.fonts.ready)
      await expect
        .poll(() => runtime.evaluate(() => [...new Set((window as unknown as FrameState).violations)]))
        .toEqual(expect.arrayContaining(['img-src', 'font-src', 'style-src-elem', 'script-src-elem', 'connect-src']))
      const selected = await ask({ type: 'doop:select', selector: '#target' }, 'doop:select-result')
      expect(selected.origin).toBe('null')
      expect(selected.hit?.selector).toBe('#target')
    }
    expect(foreignRequests).toEqual([])
    expect(await runtime.evaluate(() => (window as unknown as FrameState).foreignScript)).toBeUndefined()
  })

  it('loads instance, data and blob assets while retaining styles, inline scripts and editor updates', async () => {
    await ask(
      {
        type: 'doop:html',
        html: `<!doctype html><html><head>
      <link rel="stylesheet" href="${origin}/__csp__/local.css"></head>
      <body class="brand" style="margin:0"><h1 id="target">Editable</h1>
      <img id="local" src="${origin}/__csp__/local.svg">
      <img id="data" src="data:image/svg+xml,${encodeURIComponent(svg)}">
      <script src="${origin}/__csp__/local.js"></script>
      <script>window.inlineRan=true;var image=new Image();image.id='blob';image.src=URL.createObjectURL(new Blob([${JSON.stringify(svg)}],{type:'image/svg+xml'}));document.body.appendChild(image)</script>
      </body></html>`,
      },
      'doop:html-result',
    )
    await expect.poll(() => runtime.evaluate(() => (window as unknown as FrameState).localScript)).toBe(true)
    await runtime.waitForFunction(() =>
      ['local', 'data', 'blob'].every((id) => (document.getElementById(id) as HTMLImageElement)?.naturalWidth === 16),
    )
    expect(
      await runtime.evaluate(() => ({
        inline: (window as unknown as FrameState).inlineRan,
        brand: document.body.className,
        style: getComputedStyle(document.body).getPropertyValue('--asset-css'),
      })),
    ).toEqual({ inline: true, brand: 'brand', style: 'loaded' })
    const fonts = await runtime.evaluate(
      async (origin, base64) => {
        const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0))
        const urls = [
          `${origin}/__csp__/local.woff2`,
          `data:font/woff2;base64,${base64}`,
          URL.createObjectURL(new Blob([bytes], { type: 'font/woff2' })),
        ]
        return Promise.all(
          urls.map(async (url, index) => {
            const face = new FontFace(`Allowed${index}`, `url("${url}")`)
            document.fonts.add(face)
            await face.load()
            return face.status
          }),
        )
      },
      origin,
      font.toString('base64'),
    )
    expect(fonts).toEqual(['loaded', 'loaded', 'loaded'])
    expect(await runtime.evaluate(async (url) => (await fetch(url)).text(), `${origin}/__csp__/fetch`)).toBe('ok')
    const point = await runtime.$eval('#target', (element) => {
      const box = element.getBoundingClientRect()
      return { x: box.x + 10, y: box.y + box.height / 2 }
    })
    const hit = await ask({ type: 'doop:probe', ...point }, 'doop:probe-result')
    expect(hit.hit?.selector).toBe('#target')
    await ask({ type: 'doop:style', selector: '#target', styles: { color: 'rgb(1, 2, 3)' } }, 'doop:style-result')
    expect(await runtime.$eval('#target', (element) => getComputedStyle(element).color)).toBe('rgb(1, 2, 3)')
    await page.evaluate(() =>
      document
        .querySelector<HTMLIFrameElement>('#runtime')!
        .contentWindow!.postMessage({ type: 'doop:edit', on: false, flushId: 7 }, '*'),
    )
    await page.waitForFunction(() => (window as unknown as Fixture).messages.some((m) => m.type === 'doop:edited'))
    const edited = await page.evaluate(
      () => (window as unknown as Fixture).messages.find((m) => m.type === 'doop:edited')!.html!,
    )
    expect(edited).toContain('Editable')
    expect(edited).not.toContain('Content-Security-Policy')
    expect(await runtime.evaluate(() => (window as unknown as FrameState).violations)).toEqual([])
  })

  it('blocks hostile bases, redirects and executable data/blob documents', async () => {
    await ask(
      {
        type: 'doop:html',
        html: `<head><base href="${foreign}/"></head><body>
      <img id="relative" src="/__csp__/relative.svg"><img src="${origin}/__csp__/redirect">
      <iframe src="${foreign}/nested"></iframe>
      <script src="data:text/javascript,window.foreignScript=true"></script>
      </body>`,
      },
      'doop:html-result',
    )
    await runtime.waitForFunction(() => (document.getElementById('relative') as HTMLImageElement).naturalWidth === 16)
    await runtime.evaluate(() => {
      const url = URL.createObjectURL(new Blob(['window.foreignScript=true'], { type: 'text/javascript' }))
      const script = document.createElement('script')
      script.src = url
      document.body.appendChild(script)
      const child = document.createElement('iframe')
      child.src = URL.createObjectURL(new Blob(['<p>Nested blob</p>'], { type: 'text/html' }))
      document.body.appendChild(child)
      new Worker(url).onerror = (event) => event.preventDefault()
    })
    await expect
      .poll(() => runtime.evaluate(() => (window as unknown as FrameState).violations))
      .toEqual(expect.arrayContaining(['base-uri', 'img-src', 'frame-src', 'script-src-elem', 'worker-src']))
    expect(foreignRequests).toEqual([])
    expect(await runtime.evaluate(() => (window as unknown as FrameState).foreignScript)).toBeUndefined()
  })

  it.each(['document', 'fragment'])(
    'protects passive %s previews before their first resource request',
    async (format) => {
      const content = `<link rel="stylesheet" href="${foreign}/preview.css">
      <style>@font-face{font-family:Blocked;src:url('${foreign}/preview.woff2')}p{font-family:Blocked}</style>
      <p>Preview</p><img id="blocked" src="${foreign}/preview.svg"><img id="allowed" src="${origin}/__csp__/preview.svg">
      <script src="${foreign}/preview.js"></script>`
      const html = format === 'document' ? `<!doctype html><html><head></head><body>${content}</body></html>` : content
      await page.evaluate((html) => (window as unknown as Fixture).addPreview(html), html)
      const preview = (await page.$('#preview'))!
      const frame = (await preview.contentFrame())!
      await frame.evaluate(() => document.fonts.ready)
      expect(await frame.$eval('#allowed', (element) => (element as HTMLImageElement).naturalWidth)).toBe(16)
      expect(await frame.$eval('#blocked', (element) => (element as HTMLImageElement).naturalWidth)).toBe(0)
      expect(foreignRequests).toEqual([])
      expect(await preview.evaluate((element) => element.getAttribute('sandbox'))).toBe('')
    },
  )
})
