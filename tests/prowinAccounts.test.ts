import { afterAll, beforeAll, expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let owner: Client
let advisor: Client
let creator: Client
let workspaceId: string
let advisorId: string
let creatorId: string
beforeAll(async () => {
  server = await startServer()
  owner = await new Client(server).signUp('creator-owner@test.dev', 'Owner')
  advisor = await new Client(server).signUp('advisor@test.dev', 'Advisor')
  creator = await new Client(server).signUp('creator@test.dev', 'Creator')
  advisorId = (await (await advisor.get('/api/me')).json()).id
  creatorId = (await (await creator.get('/api/me')).json()).id
}, 70_000)
afterAll(() => server?.stop())

it('requires explicit Creator registration before workspace creation', async () => {
  expect((await (await owner.get('/api/me')).json()).creator).toBe(false)
  expect((await owner.post('/api/workspaces', { name: 'Denied' })).status).toBe(403)
})
it('registers only the authenticated account, without granting instance admin', async () => {
  const res = await owner.post('/api/prowin/creator', { userId: advisorId, role: 'admin' })
  expect(res.status).toBe(200)
  expect(await (await owner.get('/api/me')).json()).toMatchObject({
    creator: true,
    admin: false,
    canCreateWorkspace: true,
  })
  expect(await (await advisor.get('/api/me')).json()).toMatchObject({ creator: false, admin: false })
  expect((await owner.post('/api/prowin/creator')).status).toBe(200)
  const created = await owner.post('/api/workspaces', { name: 'Creator team' })
  expect(created.status).toBe(200)
  workspaceId = (await created.json()).id
})
it('invites ordinary advisors as members and requires registration for Creator grants', async () => {
  expect((await owner.post(`/api/workspaces/${workspaceId}/members`, { email: 'advisor@test.dev' })).status).toBe(200)
  expect((await owner.patch(`/api/workspaces/${workspaceId}/members/${advisorId}`, { role: 'creator' })).status).toBe(
    400,
  )
  expect((await advisor.patch(`/api/workspaces/${workspaceId}/members/${advisorId}`, { role: 'creator' })).status).toBe(
    403,
  )
  expect((await creator.post('/api/prowin/creator')).status).toBe(200)
  expect(
    (await owner.post(`/api/workspaces/${workspaceId}/members`, { email: 'creator@test.dev', role: 'creator' })).status,
  ).toBe(200)
  expect((await creator.post(`/api/workspaces/${workspaceId}/members`, { email: 'new@test.dev' })).status).toBe(403)
  expect((await creator.patch(`/api/workspaces/${workspaceId}/members/${advisorId}`, { role: 'creator' })).status).toBe(
    403,
  )
  expect((await owner.patch(`/api/workspaces/${workspaceId}/members/${creatorId}`, { role: 'admin' })).status).toBe(400)
  expect(
    (await owner.post(`/api/workspaces/${workspaceId}/members`, { email: 'unknown@test.dev', role: 'creator' })).status,
  ).toBe(400)
  expect((await owner.post(`/api/workspaces/${workspaceId}/members`, { email: 'unknown@test.dev' })).status).toBe(200)
})
it('registration persists across restarts', async () => {
  server.stop({ keepData: true })
  await server.stopped
  server = await startServer({}, server.dataDir)
  expect(await (await owner.get('/api/me')).json()).toMatchObject({ creator: true, admin: false })
  const detail = await (await owner.get(`/api/workspaces/${workspaceId}`)).json()
  expect(detail.members.find((m: { userId: string }) => m.userId === creatorId).role).toBe('creator')
}, 70_000)
