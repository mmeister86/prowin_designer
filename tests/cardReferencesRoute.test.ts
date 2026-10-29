import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { PGlite } from '@electric-sql/pglite'
import { join } from 'node:path'
import { Client, startServer, type Server } from './harness.ts'
import type { AgentTask, Canvas, Frame } from '../shared/types.ts'

let server: Server
let owner: Client
let canvas: Canvas
let foreign: Frame
let socket: WebSocket
const tasks = new Map<string, AgentTask>()
const unavailable = 'Eine Referenz ist nicht mehr verfügbar. Erstelle den Auftrag mit verfügbaren Referenzen neu.'
const serverEnv = {
  RESIDENT_TASK_LIMIT: '30',
  DOOP_AGENT_PROVIDER: 'requesty',
  REQUESTY_API_KEY: 'requesty-integration-key',
  ANTHROPIC_API_KEY: '',
  NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./fixtures/requesty-router.mjs', import.meta.url).href}`,
}
const invalid = 'Bitte verwende höchstens vier verfügbare Referenzen dieser Arbeitsfläche.'
beforeAll(async () => {
  server = await startServer(serverEnv)
  owner = await new Client(server).signUp('card-references@test.dev', 'Reference Tester')
  canvas = await (await owner.post('/api/canvases', { name: 'References' })).json()
  const other: Canvas = await (await owner.post('/api/canvases', { name: 'Other' })).json()
  foreign = await (await owner.post(`/api/canvases/${other.id}/frames`, { name: 'Foreign' })).json()
  socket = new WebSocket(`ws://localhost:${server.port}/ws`, { headers: { Cookie: owner.header() } })
  await new Promise<void>((resolve, reject) => {
    socket.on('error', reject)
    socket.on('open', () => socket.send(JSON.stringify({ type: 'join', canvasId: canvas.id, clientId: 'refs' })))
    socket.on('message', (data) => {
      const event = JSON.parse(String(data))
      if (event.type === 'init') resolve()
      if (event.type === 'task') tasks.set(event.task.id, event.task)
    })
  })
}, 70_000)
afterAll(async () => {
  socket?.close()
  server?.stop()
  await server?.stopped
})
const allowance = async () => (await owner.get('/api/agent-allowance')).json()
const createFrame = async () =>
  (await (await owner.post(`/api/canvases/${canvas.id}/frames`, { name: 'Source' })).json()) as Frame
const createCard = async (title: string, attachments?: unknown) =>
  owner.post(`/api/canvases/${canvas.id}/cards`, { title: `Budget failure test ${title}`, attachments })

it.each(['deleted', 'foreign', 'non-array', 'non-string', 'empty', 'too-many'])(
  'rejects %s references before charging or queueing',
  async (kind) => {
    const before = await allowance()
    const count = tasks.size
    const source = await createFrame()
    await owner.delete(`/api/frames/${source.id}`)
    const inputs: Record<string, unknown> = {
      deleted: [source.id],
      foreign: [foreign.id],
      'non-array': 'bad',
      'non-string': [12],
      empty: [''],
      'too-many': ['one', 'two', 'three', 'four', 'five'],
    }
    const response = await createCard(`invalid ${kind}`, inputs[kind])
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: invalid })
    expect(await allowance()).toEqual(before)
    expect(tasks.size).toBe(count)
    const valid = await createFrame()
    const accepted = await createCard(`valid after ${kind}`, [valid.id, valid.id])
    expect(accepted.status).toBe(200)
    const card: AgentTask = await accepted.json()
    expect(card.attachments).toEqual([valid.id])
    await vi.waitFor(() => expect(tasks.has(card.id)).toBe(true))
  },
)

it('rejects retry with a missing reference before charging', async () => {
  const source = await createFrame()
  const card: AgentTask = await (await createCard('retry source', [source.id])).json()
  await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
  await owner.delete(`/api/frames/${source.id}`)
  const before = await allowance()
  const original = { ...tasks.get(card.id) }
  const response = await owner.post(`/api/canvases/${canvas.id}/cards/${card.id}/retry`)
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: unavailable })
  expect(await allowance()).toEqual(before)
  await vi.waitFor(() => expect(tasks.get(card.id)?.attachments).toEqual([source.id]))
  expect(tasks.get(card.id)?.failedAt).toBe(original.failedAt)
})

it('rejects an unknown card without charging', async () => {
  const before = await allowance()
  expect((await owner.post(`/api/canvases/${canvas.id}/cards/unknown/retry`)).status).toBe(404)
  expect(await allowance()).toEqual(before)
})

it('rejects a foreign stored retry source without charging', async () => {
  const source = await createFrame()
  const card: AgentTask = await (await createCard('foreign retry', [source.id])).json()
  await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
  const failedAt = tasks.get(card.id)!.failedAt
  // Persisted legacy cards can contain foreign IDs; seed that state while the
  // real server is stopped, then test its hydrated retry boundary over HTTP.
  socket.close()
  const { dataDir, port } = server
  server.stop({ keepData: true })
  await server.stopped
  const db = new PGlite(join(dataDir, 'data', 'pg'))
  await db.query('UPDATE tasks SET attachments = $1 WHERE id = $2', [foreign.id, card.id])
  await db.close()
  server = await startServer({ ...serverEnv, PORT: String(port) }, dataDir)
  const before = await allowance()
  const response = await owner.post(`/api/canvases/${canvas.id}/cards/${card.id}/retry`)
  expect(response.status).toBe(400)
  expect(await response.json()).toEqual({ error: unavailable })
  expect(await allowance()).toEqual(before)
  socket = new WebSocket(`ws://localhost:${server.port}/ws`, { headers: { Cookie: owner.header() } })
  const hydrated = await new Promise<AgentTask[]>((resolve, reject) => {
    socket.on('error', reject)
    socket.on('open', () => socket.send(JSON.stringify({ type: 'join', canvasId: canvas.id, clientId: 'retry-refs' })))
    socket.on('message', (data) => {
      const event = JSON.parse(String(data))
      if (event.type === 'init') resolve(event.tasks)
      if (event.type === 'task') tasks.set(event.task.id, event.task)
    })
  })
  expect(hydrated.find((item) => item.id === card.id)).toMatchObject({ attachments: [foreign.id], failedAt })
}, 70_000)

it.each([false, true])('keeps the existing valid retry behavior (references=%s)', async (withReference) => {
  const source = await createFrame()
  const card: AgentTask = await (
    await createCard(`valid retry ${withReference}`, withReference ? [source.id] : undefined)
  ).json()
  await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
  const before = await allowance()
  const response = await owner.post(`/api/canvases/${canvas.id}/cards/${card.id}/retry`)
  expect(response.status).toBe(200)
  expect((await response.json()).id).toBe(card.id)
  expect((await allowance()).used).toBe(before.used + 1)
})
