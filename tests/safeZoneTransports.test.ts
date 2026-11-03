import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { Canvas } from '../shared/types.ts'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let owner: Client
let canvas: Canvas
beforeAll(async () => {
  server = await startServer()
  owner = await new Client(server).signUp('safezone-owner@test.dev', 'Owner')
  await owner.post('/api/prowin/creator')
  canvas = await (await owner.post('/api/canvases', { name: 'SafeZones' })).json()
}, 70_000)
afterAll(() => server?.stop())

async function countFrames(): Promise<number> {
  const loaded: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
  return loaded.frames.length
}

describe('safe-zone REST boundaries', () => {
  it.each([false, 0, ''])('rejects falsy explicit metadata %j with a German 400 and creates nothing', async (value) => {
    const before = await countFrames()
    const res = await owner.post(`/api/canvases/${canvas.id}/frames`, {
      name: 'Bad',
      preset: 'ig-post',
      safeZoneOverride: value,
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.any(String) })
    expect(await countFrames()).toBe(before)
  })

  it('treats explicit null on create as absent and round-trips set/reset over PATCH', async () => {
    const created = await (
      await owner.post(`/api/canvases/${canvas.id}/frames`, {
        name: 'Null',
        preset: 'ig-post',
        safeZoneOverride: null,
      })
    ).json()
    expect(created).not.toHaveProperty('safeZoneOverride')
    const set = await (
      await owner.patch(`/api/frames/${created.id}`, { safeZoneOverride: { top: 1, right: 2, bottom: 3, left: 4 } })
    ).json()
    expect(set).toMatchObject({ safeZoneOverride: { top: 1, right: 2, bottom: 3, left: 4 } })
    const reset = await (await owner.patch(`/api/frames/${created.id}`, { safeZoneOverride: null })).json()
    expect(reset).not.toHaveProperty('safeZoneOverride')
  })

  it('denied resize reports the specific German safe-zone reason', async () => {
    const created = await (
      await owner.post(`/api/canvases/${canvas.id}/frames`, {
        name: 'Tight',
        preset: 'ig-post',
        safeZoneOverride: { top: 500, right: 0, bottom: 500, left: 0 },
      })
    ).json()
    const res = await owner.patch(`/api/frames/${created.id}`, { height: 900 })
    expect(res.status).toBe(400)
    expect(await res.json()).toMatchObject({ error: expect.stringMatching(/Safe-Zone/) })
  })
})
