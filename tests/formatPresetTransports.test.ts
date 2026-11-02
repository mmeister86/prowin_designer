import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import WebSocket from 'ws'
import type { Canvas, Frame } from '../shared/types.ts'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let owner: Client
let mate: Client
let creator: Client
let canvas: Canvas
let workspace: string
let creatorId: string
let mateKey: string
let ownerKey: string
beforeAll(async () => {
  server = await startServer()
  owner = await new Client(server).signUp('preset-owner@test.dev', 'Owner')
  mate = await new Client(server).signUp('preset-mate@test.dev', 'Mate')
  creator = await new Client(server).signUp('preset-creator@test.dev', 'Creator')
  await owner.post('/api/prowin/creator')
  await creator.post('/api/prowin/creator')
  creatorId = (await (await creator.get('/api/me')).json()).id
  workspace = (await (await owner.post('/api/workspaces', { name: 'Presets' })).json()).id
  await owner.post(`/api/workspaces/${workspace}/members`, { email: 'preset-mate@test.dev' })
  await owner.post(`/api/workspaces/${workspace}/members`, { email: 'preset-creator@test.dev', role: 'creator' })
  canvas = await (await owner.post('/api/canvases', { name: 'Presets', workspaceId: workspace })).json()
  mateKey = (await (await mate.post('/api/agent-keys', { name: 'presets' })).json()).secret
  ownerKey = (await (await owner.post('/api/agent-keys', { name: 'presets' })).json()).secret
}, 70_000)
afterAll(() => server?.stop())

async function frame(input: Record<string, unknown> = {}): Promise<Frame> {
  const res = await owner.post(`/api/canvases/${canvas.id}/frames`, {
    name: 'Preset',
    preset: 'ig-post',
    html: '<p>Design</p>',
    ...input,
  })
  expect(res.status).toBe(200)
  return res.json()
}
async function snapshot(id: string): Promise<Frame> {
  const loaded: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
  return loaded.frames.find((f) => f.id === id)!
}
async function tool(key: string, name: string, args: Record<string, unknown>) {
  const res = await fetch(`${server.base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name, arguments: { ...args, agent_name: 'Owner' } },
    }),
  })
  return (await res.json()).result as { isError?: boolean; content: { text: string }[] }
}

describe('REST and MCP preset boundaries', () => {
  it('advertises the validated preset choices on MCP create and update schemas', async () => {
    const response = await fetch(`${server.base}/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerKey}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    })
    const { result } = await response.json()
    for (const name of ['create_frame', 'update_frame']) {
      const schema = result.tools.find((t: { name: string }) => t.name === name).inputSchema.properties.preset
      expect(JSON.stringify(schema)).toContain('ig-post')
      expect(JSON.stringify(schema)).toContain('wa-status')
      expect(JSON.stringify(schema)).toContain('a4')
    }
  })
  it.each([
    ['ig-post', 1080, 1080],
    ['ig-story', 1080, 1920],
    ['wa-status', 1080, 1920],
    ['fb-post', 1200, 630],
    ['a4', 794, 1123],
  ])('REST creates canonical %s dimensions', async (preset, width, height) => {
    expect(await frame({ preset, width: 10, height: 20 })).toMatchObject({ preset, width, height })
  })
  it.each(['__proto__', 'constructor', 'toString', 'bogus', null, {}])(
    'REST rejects invalid preset %j',
    async (preset) => {
      const before = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
      expect((await owner.post(`/api/canvases/${canvas.id}/frames`, { name: 'Invalid', preset })).status).toBe(400)
      expect(await (await owner.get(`/api/canvases/${canvas.id}`)).json()).toEqual(before)
    },
  )
  it.each([{ width: 400 }, { height: 400 }, { preset: null }, { preset: 'a4' }, { preset: null, width: 400 }])(
    'REST denies protected %j without changing frame/history',
    async (patch) => {
      const f = await frame()
      const before = await snapshot(f.id)
      expect((await mate.patch(`/api/frames/${f.id}`, patch)).status).toBe(403)
      expect(await snapshot(f.id)).toEqual(before)
      expect(await (await owner.get(`/api/frames/${f.id}/versions`)).json()).toEqual([])
    },
  )
  it('REST permits movement, equal sizes, free resize and preset application', async () => {
    const f = await frame()
    expect(
      (await mate.patch(`/api/frames/${f.id}`, { x: 42, y: 77, width: 1080, height: 1080, preset: 'ig-post' })).status,
    ).toBe(200)
    const free = await frame({ preset: undefined })
    expect((await mate.patch(`/api/frames/${free.id}`, { width: 123 })).status).toBe(200)
    expect(await (await mate.patch(`/api/frames/${free.id}`, { preset: 'a4', width: 1 })).json()).toMatchObject({
      preset: 'a4',
      width: 794,
      height: 1123,
    })
    expect((await owner.patch(`/api/frames/${f.id}`, { preset: '__proto__' })).status).toBe(400)
  })
  it('REST keeps a customized preset on Creator resize and verified copies', async () => {
    const f = await frame()
    expect((await owner.patch(`/api/frames/${f.id}`, { width: 1111, height: 777 })).status).toBe(200)
    const copy = await mate.post(`/api/canvases/${canvas.id}/frames`, { name: 'Copy', sourceFrameId: f.id })
    expect(copy.status).toBe(200)
    expect(await copy.json()).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
    expect(
      (await mate.post(`/api/canvases/${canvas.id}/frames`, { name: 'Forged', sourceFrameId: f.id, width: 100 }))
        .status,
    ).toBe(403)
    expect(await snapshot(f.id)).toMatchObject({ preset: 'ig-post', width: 1111, height: 777 })
    expect((await owner.patch(`/api/frames/${f.id}`, { preset: null })).status).toBe(200)
    expect(await snapshot(f.id)).not.toHaveProperty('preset')
  })
  it.each([{ width: 500 }, { height: 500 }, { preset: null }, { preset: 'a4' }, { preset: null, width: 500 }])(
    'MCP rejects protected %j, not merely strips it',
    async (patch) => {
      const f = await frame()
      const before = await snapshot(f.id)
      expect((await tool(mateKey, 'update_frame', { frame_id: f.id, x: 999, ...patch })).isError).toBe(true)
      expect(await snapshot(f.id)).toEqual(before)
    },
  )
  it('MCP creates/applies valid presets, rejects bad IDs and preserves summaries and copy provenance', async () => {
    const created = await tool(mateKey, 'create_frame', {
      canvas_id: canvas.id,
      name: 'MCP',
      html: '<p>MCP</p>',
      preset: 'fb-post',
      width: 1,
    })
    expect(created.isError).not.toBe(true)
    const f = JSON.parse(created.content[0]!.text).frame as Frame
    expect(f).toMatchObject({ preset: 'fb-post', width: 1200, height: 630 })
    expect(
      (await tool(ownerKey, 'create_frame', { canvas_id: canvas.id, name: 'Bad', html: '', preset: '__proto__' }))
        .isError,
    ).toBe(true)
    expect((await tool(ownerKey, 'update_frame', { frame_id: f.id, preset: 'constructor', x: 100 })).isError).toBe(true)
    expect((await tool(ownerKey, 'update_frame', { frame_id: f.id, width: 1111 })).isError).not.toBe(true)
    const copy = await tool(mateKey, 'create_frame', {
      canvas_id: canvas.id,
      name: 'Copy',
      html: '<p>MCP</p>',
      source_frame_id: f.id,
    })
    expect(copy.isError).not.toBe(true)
    expect(JSON.parse(copy.content[0]!.text).frame).toMatchObject({ preset: 'fb-post', width: 1111, height: 630 })
    const loaded = await tool(mateKey, 'get_frame', { frame_id: f.id })
    expect(JSON.parse(loaded.content[0]!.text)).toMatchObject({ preset: 'fb-post', width: 1111 })
    const changed = await tool(ownerKey, 'update_frame', { frame_id: f.id, preset: 'a4' })
    expect(changed.isError).not.toBe(true)
    expect(JSON.parse(changed.content[0]!.text).frame).toMatchObject({ preset: 'a4', width: 794, height: 1123 })
    const removed = await tool(ownerKey, 'update_frame', { frame_id: f.id, preset: null })
    expect(removed.isError).not.toBe(true)
    expect(await snapshot(f.id)).not.toHaveProperty('preset')
  })
  it('REST restore denies protected dimensions, while Creator restore retains preset identity', async () => {
    const f = await frame()
    await owner.patch(`/api/frames/${f.id}`, { html: '<section>New design</section>', width: 700 })
    // Persistence is asynchronous; listing an existing history row is the readiness condition.
    let versions: { id: string }[] = []
    for (let n = 0; n < 60 && !versions.length; n++) {
      versions = await (await owner.get(`/api/frames/${f.id}/versions`)).json()
      if (!versions.length) await new Promise((r) => setTimeout(r, 50))
    }
    expect(versions).toHaveLength(1)
    const before = await snapshot(f.id)
    expect((await mate.post(`/api/frames/${f.id}/versions/${versions[0]!.id}/restore`)).status).toBe(403)
    expect(await snapshot(f.id)).toEqual(before)
    expect(
      (await tool(mateKey, 'restore_frame_version', { frame_id: f.id, version_id: versions[0]!.id })).isError,
    ).toBe(true)
    expect((await owner.post(`/api/frames/${f.id}/versions/${versions[0]!.id}/restore`)).status).toBe(200)
    expect(await snapshot(f.id)).toMatchObject({ preset: 'ig-post', width: 1080, height: 1080 })
  })
})

async function socket(client: Client, canvasId = canvas.id) {
  const ws = new WebSocket(`ws://localhost:${server.port}/ws`, { headers: { Cookie: client.header() } })
  const received: Record<string, unknown>[] = []
  ws.on('message', (data) => received.push(JSON.parse(String(data))))
  await new Promise<void>((resolve, reject) => {
    ws.once('error', reject)
    ws.on('open', () =>
      ws.send(
        JSON.stringify({ type: 'join', canvasId, clientId: `preset-${Math.random()}`, name: 'Owner', creator: true }),
      ),
    )
    ws.on('message', (data) => {
      if (JSON.parse(String(data)).type === 'init') resolve()
    })
  })
  return { ws, received }
}
// A viewport sent after the drag is a wire barrier: the receiver has processed preceding relays.
async function relay(
  sender: Awaited<ReturnType<typeof socket>>,
  receiver: Awaited<ReturnType<typeof socket>>,
  drag: Record<string, unknown>,
) {
  receiver.received.length = 0
  const barrier = new Promise<void>((resolve) => {
    const handler = (data: WebSocket.RawData) => {
      if (JSON.parse(String(data)).type !== 'viewport') return
      receiver.ws.off('message', handler)
      resolve()
    }
    receiver.ws.on('message', handler)
  })
  sender.ws.send(JSON.stringify({ type: 'frame:drag', x: 42, y: 77, ...drag }))
  // Permission checks are async; let the drag finish before sending the wire barrier.
  await new Promise((r) => setTimeout(r, 150))
  sender.ws.send(JSON.stringify({ type: 'viewport', viewport: { x: 1, y: 2, width: 100, height: 100, zoom: 1 } }))
  await barrier
  return receiver.received.filter((m) => m.type === 'frame:drag')
}

it('live drag validates preset dimensions, frame room, current role and access rather than client flags', async () => {
  const f = await frame()
  const free = await frame({ preset: undefined })
  const hidden: Canvas = await (await owner.post('/api/canvases', { name: 'Hidden' })).json()
  const foreign: Frame = await (
    await owner.post(`/api/canvases/${hidden.id}/frames`, { name: 'Foreign', preset: 'ig-post' })
  ).json()
  const viewer = await socket(owner)
  const member = await socket(mate)
  const author = await socket(creator)
  try {
    expect(await relay(member, viewer, { frameId: f.id, width: 500 })).toEqual([])
    expect(await relay(member, viewer, { frameId: f.id, height: 500 })).toEqual([])
    expect(await relay(member, viewer, { frameId: foreign.id, width: 500 })).toEqual([])
    expect(await relay(member, viewer, { frameId: 'missing' })).toEqual([])
    expect(await relay(member, viewer, { frameId: f.id })).toHaveLength(1)
    expect(await relay(member, viewer, { frameId: f.id, width: 1080, height: 1080 })).toHaveLength(1)
    expect(await relay(member, viewer, { frameId: free.id, width: 500 })).toHaveLength(1)
    expect(await relay(author, viewer, { frameId: foreign.id, width: 500 })).toEqual([])
    expect(await relay(author, viewer, { frameId: f.id, width: 500 })).toHaveLength(1)
    await owner.patch(`/api/workspaces/${workspace}/members/${creatorId}`, { role: 'member' })
    expect((await creator.patch(`/api/frames/${f.id}`, { width: 500 })).status).toBe(403)
    expect(await relay(author, viewer, { frameId: f.id, width: 500 })).toEqual([])
    expect(await relay(author, viewer, { frameId: f.id })).toHaveLength(1)
    await owner.delete(`/api/workspaces/${workspace}/members/${creatorId}`)
    expect(await relay(author, viewer, { frameId: f.id })).toEqual([])
    expect(await snapshot(f.id)).toMatchObject({ preset: 'ig-post', width: 1080, height: 1080 })
  } finally {
    viewer.ws.close()
    member.ws.close()
    author.ws.close()
  }
}, 20_000)

it('stops live drag relays after the joined session signs out', async () => {
  const visitor = await new Client(server).signUp('preset-session@test.dev', 'Session')
  await owner.post(`/api/workspaces/${workspace}/members`, { email: 'preset-session@test.dev' })
  const f = await frame()
  const viewer = await socket(owner)
  const sender = await socket(visitor)
  try {
    expect(await relay(sender, viewer, { frameId: f.id })).toHaveLength(1)
    expect((await visitor.post('/api/auth/sign-out')).status).toBe(200)
    expect(await relay(sender, viewer, { frameId: f.id })).toEqual([])
  } finally {
    viewer.ws.close()
    sender.ws.close()
  }
}, 20_000)
