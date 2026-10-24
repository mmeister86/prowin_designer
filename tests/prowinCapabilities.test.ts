import { afterAll, beforeAll, expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'
let server: Server
let owner: Client
let member: Client
let creator: Client
let workspace: string
let canvas: string
let frame: string
let creatorId: string
beforeAll(async () => {
  server = await startServer()
  owner = await new Client(server).signUp('caps-owner@test.dev', 'Owner')
  member = await new Client(server).signUp('caps-member@test.dev', 'Member')
  creator = await new Client(server).signUp('caps-creator@test.dev', 'Creator')
  creatorId = (await (await creator.get('/api/me')).json()).id
  await owner.post('/api/prowin/creator')
  await creator.post('/api/prowin/creator')
  workspace = (await (await owner.post('/api/workspaces', { name: 'Caps' })).json()).id
  await owner.post(`/api/workspaces/${workspace}/members`, { email: 'caps-member@test.dev' })
  await owner.post(`/api/workspaces/${workspace}/members`, { email: 'caps-creator@test.dev', role: 'creator' })
  canvas = (await (await owner.post('/api/canvases', { name: 'Template', workspaceId: workspace })).json()).id
  frame = (await (await owner.post(`/api/canvases/${canvas}/frames`, { name: 'Hero' })).json()).id
}, 70_000)
afterAll(() => server?.stop())

const put = (client: Client, path: string, body: unknown) =>
  client.req(path, { method: 'PUT', body: JSON.stringify(body) })
it('restricts personal publishing to registered Creator owners', async () => {
  const personal = (await (await member.post('/api/canvases', { name: 'Personal' })).json()).id
  await member.post(`/api/canvases/${personal}/frames`, { name: 'F' })
  expect((await put(member, `/api/canvases/${personal}/publish`, { category: 'website' })).status).toBe(403)
  expect((await put(owner, `/api/canvases/${canvas}/publish`, { category: 'website' })).status).toBe(200)
  expect((await put(creator, `/api/canvases/${canvas}/publish`, { category: 'website' })).status).toBe(403)
})
it('guards lock creation and changes but allows ordinary editing', async () => {
  expect((await member.post(`/api/canvases/${canvas}/frames`, { name: 'Forbidden', locked: true })).status).toBe(403)
  expect((await member.patch(`/api/frames/${frame}`, { locked: true })).status).toBe(403)
  expect((await member.patch(`/api/frames/${frame}`, { html: '<p>Allowed</p>' })).status).toBe(200)
  expect((await creator.patch(`/api/frames/${frame}`, { locked: true })).status).toBe(200)
  expect((await member.patch(`/api/frames/${frame}`, { locked: false })).status).toBe(403)
  expect((await owner.patch(`/api/frames/${frame}`, { locked: false })).status).toBe(200)
})
it('does not grant Creator rights through direct invites or link editing', async () => {
  const personal = (await (await owner.post('/api/canvases', { name: 'Private' })).json()).id
  const f = (await (await owner.post(`/api/canvases/${personal}/frames`, { name: 'F' })).json()).id
  await owner.post(`/api/canvases/${personal}/members`, { email: 'caps-creator@test.dev' })
  expect((await creator.patch(`/api/frames/${f}`, { locked: true })).status).toBe(403)
  await owner.patch(`/api/canvases/${personal}`, { linkAccess: 'edit' })
  await member.post('/api/prowin/creator')
  expect((await member.patch(`/api/frames/${f}`, { locked: true })).status).toBe(403)
})
it('checks MCP identity instead of the agent display name', async () => {
  const key = await (await member.post('/api/agent-keys', { name: 'caps' })).json()
  const res = await fetch(`${server.base}/mcp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.secret}` },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'update_frame', arguments: { frame_id: frame, locked: true, agent_name: 'Owner' } },
    }),
  })
  expect((await res.json()).result.isError).toBe(true)
  const loaded = await (await owner.get(`/api/canvases/${canvas}`)).json()
  expect(loaded.frames.find((f: { id: string }) => f.id === frame).locked).not.toBe(true)
})
it('rechecks current workspace rights even for the canvas owner', async () => {
  const own = (await (await creator.post('/api/canvases', { name: 'Mine', workspaceId: workspace })).json()).id
  const f = (await (await creator.post(`/api/canvases/${own}/frames`, { name: 'F' })).json()).id
  expect((await creator.patch(`/api/frames/${f}`, { locked: true })).status).toBe(200)
  await owner.patch(`/api/workspaces/${workspace}/members/${creatorId}`, { role: 'member' })
  expect((await creator.patch(`/api/frames/${f}`, { locked: false })).status).toBe(403)
  expect((await creator.get(`/api/canvases/${own}/capabilities`)).status).toBe(200)
  expect(await (await creator.get(`/api/canvases/${own}/capabilities`)).json()).toEqual({
    manageLocks: false,
    publish: false,
    localAgent: false,
  })
  await owner.delete(`/api/workspaces/${workspace}/members/${creatorId}`)
  expect((await creator.patch(`/api/frames/${f}`, { locked: false })).status).toBe(403)
})
it('denies Local Agent routes for ordinary advisors', async () => {
  const advisor = await new Client(server).signUp('local-advisor@test.dev', 'Advisor')
  expect((await advisor.get('/api/local-agent')).status).toBe(403)
  expect((await put(advisor, '/api/local-agent', { enabled: true, model: 'default' })).status).toBe(403)
  expect((await advisor.post('/api/local-agent/poll', { deviceId: crypto.randomUUID() })).status).toBe(403)
  expect((await creator.get('/api/local-agent')).status).toBe(200)
})
