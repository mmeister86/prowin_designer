import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { Client, startServer, type Server } from './harness.ts'
import { findBrowserPath } from '../server/screenshot.ts'
import type { AgentTask, Canvas } from '../shared/types.ts'

let server: Server
let owner: Client
let canvas: Canvas
let socket: WebSocket
const tasks = new Map<string, AgentTask>()

beforeAll(async () => {
  server = await startServer({
    DOOP_AGENT_PROVIDER: 'requesty',
    DOOP_AGENT_MODEL: 'policy/prowin-layout-gen',
    REQUESTY_API_KEY: 'requesty-integration-key',
    RESIDENT_TASK_LIMIT: '4',
    ANTHROPIC_API_KEY: '',
    SMTP_HOST: '',
    CHROME_NO_SANDBOX: 'true',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./fixtures/requesty-router.mjs', import.meta.url).href}`,
  })
  owner = await new Client(server).signUp('requesty-resident@test.dev', 'Requesty Tester')
  canvas = await (await owner.post('/api/canvases', { name: 'Requesty integration' })).json()
  socket = new WebSocket(`ws://localhost:${server.port}/ws`, { headers: { Cookie: owner.header() } })
  await new Promise<void>((resolve, reject) => {
    socket.on('error', reject)
    socket.on('open', () =>
      socket.send(JSON.stringify({ type: 'join', canvasId: canvas.id, clientId: 'requesty-test' })),
    )
    socket.on('message', (data) => {
      const message = JSON.parse(String(data))
      if (message.type === 'init') resolve()
      if (message.type === 'task') tasks.set(message.task.id, message.task)
    })
  })
}, 70_000)
afterAll(() => {
  socket?.close()
  server?.stop()
})

it.skipIf(!findBrowserPath())(
  'completes a real resident card after creating a frame and sending its screenshot to Requesty',
  async () => {
    const res = await owner.post(`/api/canvases/${canvas.id}/cards`, { title: 'Create an EU integration frame' })
    expect(res.status).toBe(200)
    const card: AgentTask = await res.json()
    await vi.waitFor(() => expect(tasks.get(card.id)?.endedAt).toBeTypeOf('number'), { timeout: 20_000 })
    expect(tasks.get(card.id)?.failedAt).toBeUndefined()
    const updated: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
    expect(updated.frames).toHaveLength(1)
    expect(updated.frames[0]?.html).toContain('EU integration')
  },
  25_000,
)

it('pauses a budget-rejected resident card for manual retry without completing it', async () => {
  const res = await owner.post(`/api/canvases/${canvas.id}/cards`, { title: 'Budget failure test' })
  expect(res.status).toBe(200)
  const card: AgentTask = await res.json()
  await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
  expect(tasks.get(card.id)?.endedAt).toBeUndefined()
  expect(tasks.get(card.id)?.failureReason).not.toMatch(/reconnect/i)
})

it.each(['Credential failure test', 'Policy failure test'])(
  'directs %s to the administrator without leaking upstream diagnostics',
  async (title) => {
    const response = await owner.post(`/api/canvases/${canvas.id}/cards`, { title })
    expect(response.status).toBe(200)
    const card: AgentTask = await response.json()
    await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
    const failed = tasks.get(card.id)!
    expect(failed.endedAt).toBeUndefined()
    expect(failed.failureReason).toMatch(/administrator/i)
    expect(failed.failureReason).not.toMatch(/internal operator diagnostic|reconnect|Retry when you are ready/i)
  },
)

it.skipIf(!findBrowserPath())('enforces the configured task limit before queueing further paid work', async () => {
  const response = await owner.post(`/api/canvases/${canvas.id}/cards`, { title: 'Over the task allowance' })
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({ error: 'resident_limit', used: 4, limit: 4 })
})
