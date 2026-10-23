import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, expect, it, vi } from 'vitest'
import sharp from 'sharp'
import { buildMcpServer } from '../server/mcp.ts'
import { searchInspiration } from '../server/inspiration.ts'
import { createBackground, fetchThumb, taggingEnabled, tagWithModel, initBackgrounds } from '../server/backgrounds.ts'
import * as storage from '../server/storage.ts'
import { exchangeCode, metaEnabled } from '../server/meta.ts'
import { runAutomation, startScheduler, tick } from '../server/automations.ts'
import { db } from '../server/db/index.ts'
import { stubEnv, unstubAllEnvs } from './envStub.ts'

vi.mock('../server/db/index.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../server/db/index.ts')>()),
  db: {
    insert: vi.fn(() => {
      throw new Error('Unexpected database insert')
    }),
    select: vi.fn(() => {
      throw new Error('Disabled features must not access the database')
    }),
  },
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  unstubAllEnvs()
})

it('does not advertise or execute the optional MCP tools', async () => {
  const server = buildMcpServer('Test', 'test-owner')
  const client = new Client({ name: 'optional-features-test', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    const { tools } = await client.listTools()
    const names = tools.map((tool) => tool.name)
    expect(names).not.toContain('search_inspiration')
    expect(names).not.toContain('list_backgrounds')
    expect(names).toContain('search_images')
    expect(names).toContain('create_frame')
    expect(client.getInstructions()).not.toContain('list_backgrounds')
    const guide = await client.callTool({ name: 'get_guide', arguments: { topic: 'doop-instructions' } })
    expect(JSON.stringify(guide.content)).not.toMatch(/search_inspiration|list_backgrounds/)
    for (const name of ['search_inspiration', 'list_backgrounds']) {
      const result = await client.callTool({ name, arguments: { query: 'test', agent_name: 'test' } })
      expect(result.isError).toBe(true)
    }
  } finally {
    await client.close()
    await server.close()
  }
})

it('keeps outbound integrations off even with old keys and a remote background origin', async () => {
  stubEnv('META_APP_ID', 'old-id')
  stubEnv('META_APP_SECRET', 'old-secret')
  stubEnv('ANTHROPIC_API_KEY', 'old-key')
  stubEnv('BACKGROUNDS_ORIGIN', 'https://doop.design')
  const request = vi.fn().mockResolvedValue(new Response('{}', { headers: { 'content-type': 'application/json' } }))
  vi.stubGlobal('fetch', request)

  expect(metaEnabled()).toBe(false)
  expect(taggingEnabled()).toBe(false)
  expect(await searchInspiration('flyer')).toEqual([])
  expect(await fetchThumb('example')).toBeNull()
  await expect(exchangeCode('old-code')).rejects.toThrow(/disabled/)
  await expect(tagWithModel(Buffer.from('image'))).rejects.toThrow(/off|disabled/)
  expect(request).not.toHaveBeenCalled()
})

it('does not seed backgrounds or query, claim, or run scheduled automations', async () => {
  const interval = vi.spyOn(globalThis, 'setInterval')
  await initBackgrounds()
  expect(await tick()).toBe(0)
  expect(await runAutomation('stored-automation')).toBeUndefined()
  startScheduler()
  expect(db.select).not.toHaveBeenCalled()
  expect(interval).not.toHaveBeenCalled()
})

it('rejects background ingestion without writing objects or rows', async () => {
  const put = vi.spyOn(storage, 'putObject').mockResolvedValue(undefined)
  const image = await sharp({ create: { width: 1600, height: 1000, channels: 3, background: '#123456' } })
    .png()
    .toBuffer()
  await expect(createBackground(image, { skipModel: true })).rejects.toThrow(/disabled/)
  expect(put).not.toHaveBeenCalled()
  expect(db.insert).not.toHaveBeenCalled()
})
