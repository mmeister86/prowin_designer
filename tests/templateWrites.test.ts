import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Canvas, Frame } from '../shared/types'
import { Client, startServer, type Server } from './harness.ts'

/**
 * TASK-30 Task 2 RED: guarded action writes over HTTP. Every invalid edit
 * must leave the full frame snapshot plus versions unchanged; protected
 * resize/delete is 403 for non-Creators; creator duplicate metadata is 400;
 * source-backed copies work for members with access, sourceless fresh
 * template creation and inaccessible sources fail closed.
 */

let server: Server
let owner: Client
let mate: Client
let canvas: Canvas

const FIELD = '<h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel">Hallo</h1>'
const LOCKED =
  '<p data-od-id="intro" data-od-role="body" data-od-locked="true" data-od-max-length="60" data-od-allowed-colors="prowin-ci-blau">Text</p>'
const TEMPLATE = `<div>${FIELD}${LOCKED}</div>`

beforeAll(async () => {
  server = await startServer()
  owner = new Client(server)
  await owner.signUp('writes@test.dev', 'Writes Owner')
  await owner.post('/api/prowin/creator')
  mate = new Client(server)
  await mate.signUp('writes-mate@test.dev', 'Writes Mate')
  canvas = await (await owner.post('/api/canvases', { name: 'Writes' })).json()
  expect((await owner.post(`/api/canvases/${canvas.id}/members`, { email: 'writes-mate@test.dev' })).status).toBe(200)
}, 60_000)

afterAll(() => server?.stop())

async function newFrame(html: string): Promise<Frame> {
  const res = await owner.post(`/api/canvases/${canvas.id}/frames`, { name: 'Writes', html })
  expect(res.status).toBe(200)
  return (await res.json()) as Frame
}

async function snapshot(frameId: string): Promise<Frame> {
  const loaded: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
  return loaded.frames.find((f) => f.id === frameId)!
}

async function versionCount(frameId: string): Promise<number> {
  return ((await (await owner.get(`/api/frames/${frameId}/versions`)).json()) as unknown[]).length
}

/* versions are filed behind the response — poll until the count settles */
async function eventuallyVersions(frameId: string, count: number): Promise<void> {
  const deadline = Date.now() + 3000
  for (;;) {
    if ((await versionCount(frameId)) === count) return
    if (Date.now() > deadline) throw new Error(`versions for ${frameId} never settled at ${count}`)
    await new Promise((r) => setTimeout(r, 50))
  }
}

describe('guarded frame writes', () => {
  it('member structural edit leaves snapshot and versions unchanged', async () => {
    const frame = await newFrame(TEMPLATE)
    const before = await snapshot(frame.id)
    const beforeVersions = await versionCount(frame.id)
    const next = before.html.replace('</div>', '<section>Injected</section></div>')
    const res = await mate.patch(`/api/frames/${frame.id}`, { html: next })
    expect(res.status).toBe(403)
    expect(await snapshot(frame.id)).toEqual(before)
    expect(await versionCount(frame.id)).toBe(beforeVersions)
  })

  it('member resize of a template frame is 403 and changes nothing', async () => {
    const frame = await newFrame(TEMPLATE)
    const before = await snapshot(frame.id)
    const res = await mate.patch(`/api/frames/${frame.id}`, { width: 1200 })
    expect(res.status).toBe(403)
    expect(await snapshot(frame.id)).toEqual(before)
  })

  it('member delete of a template frame is 403 and keeps the frame', async () => {
    const frame = await newFrame(TEMPLATE)
    const res = await mate.req(`/api/frames/${frame.id}`, { method: 'DELETE' })
    expect(res.status).toBe(403)
    expect((await snapshot(frame.id)).id).toBe(frame.id)
  })

  it('creator duplicate metadata is 400 and changes nothing', async () => {
    const frame = await newFrame(TEMPLATE)
    const before = await snapshot(frame.id)
    const next = before.html.replace('</div>', `${FIELD}</div>`)
    const res = await owner.patch(`/api/frames/${frame.id}`, { html: next })
    expect(res.status).toBe(400)
    expect(await snapshot(frame.id)).toEqual(before)
  })

  it('member creates metadata-free HTML without a source', async () => {
    const res = await mate.post(`/api/canvases/${canvas.id}/frames`, { name: 'Free', html: '<p>Frei</p>' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toContain('Frei')
  })

  it('member fresh template creation without a source is 403', async () => {
    const res = await mate.post(`/api/canvases/${canvas.id}/frames`, { name: 'Fresh', html: TEMPLATE })
    expect(res.status).toBe(403)
  })

  it('member source-backed copy of a template frame succeeds', async () => {
    const source = await newFrame(TEMPLATE)
    const sourceHtml = (await snapshot(source.id)).html
    const res = await mate.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Copy',
      html: sourceHtml,
      sourceFrameId: source.id,
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toBe(sourceHtml)
  })

  it('missing or inaccessible sources fail closed', async () => {
    const missing = await mate.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Missing',
      html: TEMPLATE,
      sourceFrameId: 'no-such-frame',
    })
    expect(missing.status).toBe(404)
    const other = await mate.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Other',
      html: '<p>Anderer</p>',
    })
    expect(other.status).toBe(200)
    const stranger = new Client(server)
    await stranger.signUp('writes-stranger@test.dev', 'Writes Stranger')
    const foreign = await newFrame(TEMPLATE)
    const denied = await stranger.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Foreign',
      html: TEMPLATE,
      sourceFrameId: foreign.id,
    })
    expect([403, 404]).toContain(denied.status)
  })

  it('member restore removing a present lock is 403 and files nothing', async () => {
    const frame = await newFrame('<div><p>Vorlage ohne Schloss</p></div>')
    const lockedHtml = `<div>${FIELD}<p data-od-id="intro" data-od-role="body" data-od-locked="true">Mit Schloss</p></div>`
    expect((await owner.patch(`/api/frames/${frame.id}`, { html: lockedHtml })).status).toBe(200)
    await eventuallyVersions(frame.id, 1)
    const versions = (await (await owner.get(`/api/frames/${frame.id}/versions`)).json()) as { id: string }[]
    expect(versions).toHaveLength(1)
    const before = await snapshot(frame.id)
    const res = await mate.post(`/api/frames/${frame.id}/versions/${versions[0]!.id}/restore`)
    expect(res.status).toBe(403)
    expect(await snapshot(frame.id)).toEqual(before)
    expect(await versionCount(frame.id)).toBe(1)
  })

  it('member source-backed copy with unnormalized html validates the normalized candidate', async () => {
    const raw = `<link href="https://fonts.googleapis.com/css2?family=Roboto" rel="stylesheet">${TEMPLATE}`
    const source = await newFrame(raw)
    const sourceHtml = (await snapshot(source.id)).html
    expect(sourceHtml).not.toContain('fonts.googleapis.com')
    const res = await mate.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Copy',
      html: raw,
      sourceFrameId: source.id,
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toBe(sourceHtml)
  })

  it('member valid text edit still succeeds', async () => {
    const frame = await newFrame(TEMPLATE)
    const next = (await snapshot(frame.id)).html.replace('>Hallo<', '>Hallo Welt<')
    const res = await mate.patch(`/api/frames/${frame.id}`, { html: next })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toContain('Hallo Welt')
  })

  it.each([
    [
      'script',
      '<div data-od-id="edit"><script>console.log("safe")</script></div>',
      'console.log("safe")',
      'alert("changed")',
    ],
    ['style', '<div data-od-id="edit"><style>.locked{color:blue}</style></div>', 'color:blue', 'color:red'],
    [
      'CSS priority',
      '<p data-od-id="edit" data-od-allowed-colors="prowin-ci-blau" style="color:var(--prowin-ci-blau)">Text</p>',
      'color:var(',
      'color:red!important;color:var(',
    ],
    [
      'SVG namespace',
      '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><image data-od-id="logo" data-od-locked href="/safe.png" xlink:href="/safe.png"/></svg>',
      ' href="/safe.png"',
      ' href="/changed.png"',
    ],
  ])('rejects the %s review bypass over PATCH and append without saving', async (_name, html, find, replace) => {
    const frame = await newFrame(html)
    const before = await snapshot(frame.id)
    const versions = await versionCount(frame.id)
    const candidate = before.html.replace(find, replace)
    expect((await mate.patch(`/api/frames/${frame.id}`, { html: candidate })).status).toBe(403)
    expect(await snapshot(frame.id)).toEqual(before)
    expect(await versionCount(frame.id)).toBe(versions)

    expect(
      (await mate.post(`/api/frames/${frame.id}/append`, { html_chunk: candidate.slice(0, 20), start: true })).status,
    ).toBe(200)
    expect(
      (await mate.post(`/api/frames/${frame.id}/append`, { html_chunk: candidate.slice(20), done: true })).status,
    ).toBe(403)
    expect(await snapshot(frame.id)).toEqual(before)
    expect(await versionCount(frame.id)).toBe(versions)
  })

  it('member saves a DOM-edited fragment with the production editor doctype', async () => {
    const { Window } = await import('happy-dom')
    const frame = await newFrame(TEMPLATE)
    const before = await snapshot(frame.id)
    const window = new Window()
    try {
      window.document.write(before.html)
      window.document.querySelector('[data-od-id="titel"]')!.textContent = 'Hallo Welt'
      const html = '<!doctype html>\n' + window.document.documentElement.outerHTML
      const res = await mate.patch(`/api/frames/${frame.id}`, { html })
      expect(res.status).toBe(200)
      expect(((await res.json()) as Frame).html).toContain('Hallo Welt')
      expect((await snapshot(frame.id)).html).toContain('data-od-locked="true"')
    } finally {
      await window.close()
    }
  })

  it('revoked member cannot commit a started stream', async () => {
    const frame = await newFrame('<p>Stream Basis</p>')
    expect((await mate.post(`/api/frames/${frame.id}/append`, { html_chunk: '<p>Neu ', start: true })).status).toBe(200)
    const memberRow = (await (await owner.get(`/api/canvases/${canvas.id}/members`)).json()) as {
      userId: string
      owner?: boolean
    }[]
    const mateId = memberRow.find((m) => !m.owner)!
    expect((await owner.req(`/api/canvases/${canvas.id}/members/${mateId.userId}`, { method: 'DELETE' })).status).toBe(
      200,
    )
    const done = await mate.post(`/api/frames/${frame.id}/append`, { html_chunk: 'Entwurf</p>', done: true })
    expect(done.status).toBe(403)
    expect((await snapshot(frame.id)).html).toContain('Stream Basis')
  })
})
