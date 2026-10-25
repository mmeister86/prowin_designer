import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import WebSocket from 'ws'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let owner: Client
let socket: WebSocket
let canvasId: string
const states = new Map<string, { failedAt?: number; failureReason?: string }>()
beforeAll(async () => {
  server = await startServer({
    DOOP_AGENT_PROVIDER: 'requesty',
    REQUESTY_API_KEY: 'synthetic-requesty-key',
    RESIDENT_TASK_LIMIT: '1',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./fixtures/requesty-router.mjs', import.meta.url).href}`,
  })
  owner = await new Client(server).signUp('local-queue@test.dev', 'Local Creator')
  await owner.post('/api/prowin/creator')
  const canvas = await (await owner.post('/api/canvases', { name: 'Local queue admission' })).json()
  canvasId = canvas.id
  socket = new WebSocket(`ws://localhost:${server.port}/ws`, { headers: { Cookie: owner.header() } })
  await new Promise<void>((resolve, reject) => {
    socket.on('error', reject)
    socket.on('open', () => socket.send(JSON.stringify({ type: 'join', canvasId, clientId: 'admission-test' })))
    socket.on('message', (data) => {
      const event = JSON.parse(String(data))
      if (event.type === 'init') resolve()
      const item = event.task ?? event.comment ?? event.feedback
      if (item) states.set(item.id, item)
    })
  })
}, 70_000)
afterAll(() => {
  socket?.close()
  server?.stop()
})

it('charges local-queued work on server switch and pauses excess cards, comments and feedback', async () => {
  await owner.req('/api/local-agent', { method: 'PUT', body: JSON.stringify({ enabled: true, model: 'default' }) })
  const card = await (await owner.post(`/api/canvases/${canvasId}/cards`, { title: 'Budget failure test card' })).json()
  const frame = await (
    await owner.post(`/api/canvases/${canvasId}/frames`, { name: 'Frame', html: '<p/>', width: 100, height: 100 })
  ).json()
  const comment = await (
    await owner.post(`/api/frames/${frame.id}/comments`, { selector: 'p', text: '@Doop Budget failure test comment' })
  ).json()
  const feedback = await (
    await owner.post(`/api/tasks/${card.id}/feedback`, { text: 'Budget failure test feedback' })
  ).json()
  expect(await (await owner.get('/api/agent-allowance')).json()).toMatchObject({ used: 0, localAgent: true })
  await owner.req('/api/local-agent', { method: 'PUT', body: JSON.stringify({ enabled: false, model: 'default' }) })
  await vi.waitFor(
    () => {
      for (const item of [card, comment, feedback]) expect(states.get(item.id)?.failedAt).toBeTypeOf('number')
    },
    { timeout: 15_000 },
  )
  expect(await (await owner.get('/api/agent-allowance')).json()).toMatchObject({ used: 1, limit: 1, localAgent: false })
  expect(
    [card, comment, feedback].filter((item) => /allowance/i.test(states.get(item.id)?.failureReason ?? '')),
  ).toHaveLength(2)
}, 20_000)
