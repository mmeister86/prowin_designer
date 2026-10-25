import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, expect, it, vi } from 'vitest'
import { photoSearchEnabled, searchPhotos } from '../server/imageSearch.ts'
import { buildMcpServer } from '../server/mcp.ts'
import { stubEnv, unstubAllEnvs } from './envStub.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  unstubAllEnvs()
})

it('keeps Pexels off without a key and rejects direct searches before fetching', async () => {
  stubEnv('PEXELS_API_KEY', undefined)
  const request = vi.fn()
  vi.stubGlobal('fetch', request)

  expect(photoSearchEnabled()).toBe(false)
  await expect(searchPhotos('flowers')).rejects.toThrow('PEXELS_API_KEY is not set')
  expect(request).not.toHaveBeenCalled()
})

it('keeps the MCP photo tool available but refuses unconfigured searches without network access', async () => {
  stubEnv('PEXELS_API_KEY', undefined)
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  const server = buildMcpServer('M1 Owner', 'm1-photo-owner')
  const client = new Client({ name: 'm1-photo-contract', version: '1' })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  await client.connect(clientTransport)
  try {
    expect((await client.listTools()).tools.map((tool) => tool.name)).toContain('search_images')
    const result = await client.callTool({
      name: 'search_images',
      arguments: { query: 'flowers', agent_name: 'M1 Test' },
    })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result.content)).toContain('PEXELS_API_KEY is not set')
    expect(request).not.toHaveBeenCalled()
  } finally {
    await client.close()
    await server.close()
  }
})

it('uses the configured Pexels key and returns usable stock photos', async () => {
  stubEnv('PEXELS_API_KEY', 'pexels-test-key')
  const request = vi.fn(async (_url: string, _options: RequestInit) =>
    Response.json({
      photos: [
        {
          width: 1200,
          height: 800,
          photographer: 'Test Photographer',
          avg_color: '#123456',
          alt: 'Flowers on a table',
          src: { large: 'https://images.pexels.com/photo.jpg', tiny: 'https://images.pexels.com/thumb.jpg' },
        },
      ],
    }),
  )
  vi.stubGlobal('fetch', request)

  expect(photoSearchEnabled()).toBe(true)
  expect(await searchPhotos('flowers on a table', { orientation: 'landscape', count: 3 })).toEqual([
    {
      image_url: 'https://images.pexels.com/photo.jpg',
      thumb_url: 'https://images.pexels.com/thumb.jpg',
      alt: 'Flowers on a table',
      photographer: 'Test Photographer',
      width: 1200,
      height: 800,
      avg_color: '#123456',
    },
  ])
  expect(request).toHaveBeenCalledOnce()
  const [url, options] = request.mock.calls[0]!
  expect(new URL(url).origin).toBe('https://api.pexels.com')
  expect(new URL(url).pathname).toBe('/v1/search')
  expect(Object.fromEntries(new URL(url).searchParams)).toEqual({
    query: 'flowers on a table',
    per_page: '3',
    orientation: 'landscape',
  })
  expect(options.headers).toEqual({ authorization: 'pexels-test-key' })
})
