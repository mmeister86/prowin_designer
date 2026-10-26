import { afterAll, beforeAll, expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'

let server: Server
let advisor: Client
let creator: Client
let admin: Client
beforeAll(async () => {
  server = await startServer({
    REQUESTY_API_KEY: '',
    RESIDENT_TASK_LIMIT: '0',
    CHATGPT_CONNECT_DISABLED: '1',
    ADMIN_EMAILS: 'byo-admin@test.dev',
    OPENAI_API_KEY: '',
    GEMINI_API_KEY: '',
    ARK_API_KEY: '',
  })
  advisor = await new Client(server).signUp('byo-advisor@test.dev', 'Advisor')
  creator = await new Client(server).signUp('byo-creator@test.dev', 'Creator')
  await creator.post('/api/prowin/creator')
  admin = await new Client(server).signUp('byo-admin@test.dev', 'Admin')
}, 70_000)
afterAll(() => server?.stop())

it.each([
  ['GET', ''],
  ['PATCH', ''],
  ['DELETE', ''],
  ['POST', '/chatgpt/authorize'],
  ['POST', '/chatgpt'],
  ['POST', '/chatgpt/device'],
  ['GET', '/chatgpt/device'],
  ['DELETE', '/chatgpt/device'],
  ['POST', '/openai-key'],
  ['POST', '/anthropic-key'],
  ['POST', '/openrouter-key'],
  ['POST', '/gemini-key'],
  ['PUT', '/unexpected'],
])('retires the private account API %s %s for every role', async (method, suffix) => {
  for (const client of [advisor, creator, admin]) {
    const response = await client.req(`/api/model-account${suffix}`, {
      method,
      ...(method === 'GET' ? {} : { body: JSON.stringify({ apiKey: 'synthetic-private-key', model: 'test' }) }),
    })
    expect(response.status).toBe(410)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.json()).toEqual({ error: 'Private Modellkonten wurden entfernt.' })
  }
})

it('denies all Local Agent control paths to advisors', async () => {
  for (const [method, suffix] of [
    ['GET', ''],
    ['PUT', ''],
    ['POST', '/poll'],
    ['POST', '/finish/stale'],
    ['POST', '/stop'],
  ]) {
    const response = await advisor.req(`/api/local-agent${suffix}`, {
      method,
      ...(method === 'GET'
        ? {}
        : {
            body: JSON.stringify({
              enabled: true,
              model: 'default',
              deviceId: crypto.randomUUID(),
              success: true,
              text: 'stale',
            }),
          }),
    })
    expect(response.status).toBe(403)
  }
})

it('preserves Local Agent selection and quota bypass for Creator and Admin only', async () => {
  for (const client of [creator, admin]) {
    expect(
      (
        await client.req('/api/local-agent', {
          method: 'PUT',
          body: JSON.stringify({ enabled: true, model: 'default' }),
        })
      ).status,
    ).toBe(200)
    expect(await (await client.get('/api/local-agent')).json()).toMatchObject({ enabled: true })
    expect(await (await client.get('/api/agent-allowance')).json()).toMatchObject({ localAgent: true, limit: 0 })
    await client.req('/api/local-agent', { method: 'PUT', body: JSON.stringify({ enabled: false, model: 'default' }) })
    const allowance = await (await client.get('/api/agent-allowance')).json()
    expect(allowance).toMatchObject({ localAgent: false, limit: 0 })
    expect(allowance).not.toHaveProperty('byoKind')
    expect(allowance).not.toHaveProperty('byoEmail')
  }
  expect(await (await advisor.get('/api/agent-allowance')).json()).toMatchObject({ localAgent: false, limit: 0 })
})

it('does not make private image providers available without server credentials', async () => {
  const { models } = await (await advisor.get('/api/image-model')).json()
  expect(models.every((model: { available: boolean }) => !model.available)).toBe(true)
  expect(
    (
      await advisor.req('/api/image-model', {
        method: 'PUT',
        body: JSON.stringify({ model: 'gemini-3.1-flash-image' }),
      })
    ).status,
  ).toBe(400)
})
