// TASK-34 Task 1 RED: HTTP policy for GET /i/:id.:ext.
// Fails on current code: route coerces any non-'2' scale to 1 explicitly and
// always renders req.scale (no preset/download defaulting).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import type { Canvas, Frame } from '../shared/types.ts'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let owner: Client
let canvas: Canvas

beforeAll(async () => {
  server = await startServer()
  owner = await new Client(server).signUp('preset-http@test.dev', 'Owner')
  canvas = await (await owner.post('/api/canvases', { name: 'Preset HTTP' })).json()
}, 70_000)
afterAll(() => server?.stop())

async function makeFrame(input: Record<string, unknown>): Promise<Frame> {
  const res = await owner.post(`/api/canvases/${canvas.id}/frames`, {
    name: 'P',
    preset: 'ig-post',
    html: '<p>Hi</p>',
    ...input,
  })
  expect(res.status).toBe(200)
  return res.json()
}

async function dims(buf: Buffer) {
  const { info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true })
  return { width: info.width, height: info.height }
}

describe('GET /i/:id.:ext scale and download policy', () => {
  it('serves downloads without a scale param at the preset default (ig-post 1080×1080)', async () => {
    const f = await makeFrame({})
    const res = await fetch(`${server.base}/i/${f.id}.png?download`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-disposition')).toContain('attachment')
    expect(await dims(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 1080, height: 1080 })
  }, 60_000)

  it('ignores invalid scale values, falling back to the policy default', async () => {
    const f = await makeFrame({})
    for (const q of ['?scale=3', '?scale=0', '?scale=abc', '?scale=2.5']) {
      const res = await fetch(`${server.base}/i/${f.id}.png${q}`)
      expect(res.status).toBe(200)
      // invalid scale is not honored: plain view renders at 1x (no download default)
      expect(await dims(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 1080, height: 1080 })
    }
  }, 120_000)

  it('honors explicit scale=2 and sets attachment only with download', async () => {
    const f = await makeFrame({})
    const dl = await fetch(`${server.base}/i/${f.id}.png?scale=2&download`)
    expect(dl.status).toBe(200)
    expect(dl.headers.get('content-disposition')).toContain('attachment')
    expect(await dims(Buffer.from(await dl.arrayBuffer()))).toEqual({ width: 2160, height: 2160 })
    const view = await fetch(`${server.base}/i/${f.id}.png?scale=2`)
    expect(view.headers.get('content-disposition')).toBeNull()
  }, 60_000)

  it('clamps jpg quality without failing', async () => {
    const f = await makeFrame({})
    const res = await fetch(`${server.base}/i/${f.id}.jpg?download&quality=999`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/jpeg')
  }, 60_000)
})

describe('GET /i/:id.:ext invalid-scale downloads', () => {
  it('falls back to the preset default on A4 downloads (2481×3509)', async () => {
    const f = await makeFrame({ preset: 'a4' })
    for (const q of ['?download&scale=3', '?download&scale=0', '?download&scale=abc']) {
      const res = await fetch(`${server.base}/i/${f.id}.png${q}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-disposition')).toContain('attachment')
      expect(await dims(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 2481, height: 3509 })
    }
  }, 180_000)

  it('falls back to the 2x free-frame default on downloads', async () => {
    const f = await makeFrame({ preset: undefined, width: 300, height: 200 })
    expect(f.preset).toBeUndefined()
    for (const q of ['?download&scale=3', '?download&scale=abc']) {
      const res = await fetch(`${server.base}/i/${f.id}.png${q}`)
      expect(res.status).toBe(200)
      expect(res.headers.get('content-disposition')).toContain('attachment')
      expect(await dims(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 600, height: 400 })
    }
  }, 120_000)
})

describe('GET /i/:id.:ext unsettled-font downloads', () => {
  const FONT_ERROR = 'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.'
  const broken = (base: string) =>
    `<!doctype html><html><head><style>@font-face{font-family:'Nope';src:url('${base}/fonts/does-not-exist-400.woff2')}body{font-family:'Nope'}</style></head><body>Hi</body></html>`

  it('rejects preset downloads with a controlled German error and no bytes', async () => {
    const f = await makeFrame({ html: broken(server.base) })
    const res = await fetch(`${server.base}/i/${f.id}.png?download`)
    expect(res.status).toBe(500)
    expect(res.headers.get('content-type')).toContain('application/json')
    expect(await res.json()).toEqual({ error: FONT_ERROR })
  }, 60_000)

  it('still serves free-frame downloads leniently with the same broken font', async () => {
    const f = await makeFrame({ preset: undefined, width: 300, height: 200, html: broken(server.base) })
    const res = await fetch(`${server.base}/i/${f.id}.png?download`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('image/png')
    expect(await dims(Buffer.from(await res.arrayBuffer()))).toEqual({ width: 600, height: 400 })
  }, 60_000)
})
