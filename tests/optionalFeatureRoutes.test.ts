import { afterAll, beforeAll, expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let client: Client
beforeAll(async () => {
  server = await startServer({ META_APP_ID: 'old-id', META_APP_SECRET: 'old-secret' })
  client = new Client(server)
  await client.signUp('optional@test.dev', 'Optional Test')
}, 60_000)
afterAll(() => server?.stop())

it('rejects automation and Meta endpoints for signed-in users', async () => {
  for (const path of [
    '/api/automations',
    '/api/automations/stored',
    '/api/automations/stored/runs',
    '/api/integrations/meta/callback?code=old',
  ]) {
    expect((await client.get(path)).status, path).toBe(404)
  }
  for (const path of ['/api/automations', '/api/automations/stored/run', '/api/integrations/meta/start']) {
    expect((await client.post(path, {})).status, path).toBe(404)
  }
  expect((await client.patch('/api/automations/stored', { enabled: true })).status).toBe(404)
  expect((await client.delete('/api/automations/stored')).status).toBe(404)
  expect((await client.delete('/api/integrations/meta')).status).toBe(404)
  expect((await (await client.get('/api/integrations')).json()).meta).toEqual({ enabled: false, connected: false })
})
