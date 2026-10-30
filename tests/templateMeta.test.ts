import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Canvas, Frame } from '../shared/types'
import { Client, startServer, type Server } from './harness.ts'

/**
 * Narrow server metadata guard (TASK-29 Task 3): `actions.updateFrame` rejects
 * template-metadata changes without `manageLocks` (403) and duplicate/invalid
 * metadata for everyone (400). Tested over HTTP so the status mapping in
 * `server/index.ts` is covered too.
 */

let server: Server
let owner: Client
let mate: Client
let canvas: Canvas

const FIELD = '<h1 data-od-id="titel" data-od-role="headline" data-od-label="Titel">Hallo</h1>'
const LOCKED =
  '<p data-od-id="intro" data-od-role="body" data-od-locked="true" data-od-max-length="60" data-od-allowed-colors="prowin-ci-blau">Text</p>'

beforeAll(async () => {
  server = await startServer()
  owner = new Client(server)
  await owner.signUp('meta@test.dev', 'Meta Owner')
  await owner.post('/api/prowin/creator')
  mate = new Client(server)
  await mate.signUp('meta-mate@test.dev', 'Meta Mate')
  canvas = await (await owner.post('/api/canvases', { name: 'Meta' })).json()
  expect((await owner.post(`/api/canvases/${canvas.id}/members`, { email: 'meta-mate@test.dev' })).status).toBe(200)
}, 60_000)

afterAll(() => server?.stop())

async function newFrame(html: string): Promise<Frame> {
  const res = await owner.post(`/api/canvases/${canvas.id}/frames`, { name: 'Meta', html })
  expect(res.status).toBe(200)
  return (await res.json()) as Frame
}

async function storedHtml(frameId: string): Promise<string> {
  const loaded: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
  return loaded.frames.find((f) => f.id === frameId)!.html
}

describe('template metadata guard on frame updates', () => {
  it('creator adds a valid field and changes constraints', async () => {
    const frame = await newFrame(`<div>${FIELD}${LOCKED}</div>`)
    const next = (await storedHtml(frame.id))
      .replace('data-od-max-length="60"', 'data-od-max-length="80"')
      .replace('</div>', '<p data-od-id="neu" data-od-role="body">Neu</p></div>')
    const res = await owner.patch(`/api/frames/${frame.id}`, { html: next })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toContain('data-od-id="neu"')
  })

  it('member edits only text content of an unlocked field', async () => {
    const frame = await newFrame(`<div>${FIELD}${LOCKED}</div>`)
    const next = (await storedHtml(frame.id)).replace('>Hallo<', '>Hallo Welt<')
    const res = await mate.patch(`/api/frames/${frame.id}`, { html: next })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toContain('Hallo Welt')
  })

  it('member resaves reserialized html without a metadata change', async () => {
    const frame = await newFrame(`<div>${FIELD}${LOCKED}</div>`)
    const next = (await storedHtml(frame.id))
      .replace('data-od-locked="true"', 'data-od-locked=""')
      .replace('data-od-id="intro" data-od-role="body"', 'data-od-role="body" data-od-id="intro"')
    const res = await mate.patch(`/api/frames/${frame.id}`, { html: next })
    expect(res.status).toBe(200)
  })

  it('member removing a lock or changing max-length gets 403', async () => {
    const frame = await newFrame(`<div>${FIELD}${LOCKED}</div>`)
    const before = await storedHtml(frame.id)
    expect(
      (await mate.patch(`/api/frames/${frame.id}`, { html: before.replace(' data-od-locked="true"', '') })).status,
    ).toBe(403)
    expect(
      (
        await mate.patch(`/api/frames/${frame.id}`, {
          html: before.replace('data-od-max-length="60"', 'data-od-max-length="90"'),
        })
      ).status,
    ).toBe(403)
  })

  it('duplicate data-od-id is rejected with 400 even for the creator', async () => {
    const frame = await newFrame(`<div>${FIELD}${LOCKED}</div>`)
    const next = (await storedHtml(frame.id)).replace('</div>', `${FIELD}</div>`)
    expect((await owner.patch(`/api/frames/${frame.id}`, { html: next })).status).toBe(400)
    expect((await mate.patch(`/api/frames/${frame.id}`, { html: next })).status).toBe(400)
  })

  it('invalid role, unknown color token and max-length 0 are rejected with 400', async () => {
    const frame = await newFrame(`<div>${FIELD}${LOCKED}</div>`)
    const before = await storedHtml(frame.id)
    const badRole = before.replace('data-od-role="body"', 'data-od-role="hero"')
    const badColor = before.replace('data-od-allowed-colors="prowin-ci-blau"', 'data-od-allowed-colors="neon-pink"')
    const badLength = before.replace('data-od-max-length="60"', 'data-od-max-length="0"')
    for (const [name, html] of [
      ['role', badRole],
      ['color', badColor],
      ['length', badLength],
    ] as const) {
      expect((await owner.patch(`/api/frames/${frame.id}`, { html })).status, name).toBe(400)
    }
  })

  it('createFrame with template metadata stays allowed (TASK-30 remainder)', async () => {
    const res = await owner.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Mit Meta',
      html: `<div>${FIELD}${LOCKED}</div>`,
    })
    expect(res.status).toBe(200)
    expect(((await res.json()) as Frame).html).toContain('data-od-id="titel"')
  })
})
