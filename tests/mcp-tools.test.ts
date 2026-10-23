import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { describe, expect, it } from 'vitest'
import { buildMcpServer } from '../server/mcp.ts'

interface ToolInputSchema {
  properties?: Record<string, unknown>
  required?: string[]
}

describe('MCP website tool contract', () => {
  it('offers frame tools without website viewing or importing', async () => {
    const server = buildMcpServer('Test Owner', 'test-owner-id')
    const client = new Client({ name: 'doop-tool-contract-test', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await server.connect(serverTransport)
    await client.connect(clientTransport)

    try {
      const { tools } = await client.listTools()
      const view = tools.find((tool) => tool.name === 'view_website')
      const importWebpage = tools.find((tool) => tool.name === 'import_webpage')

      expect(view).toBeUndefined()
      expect(importWebpage).toBeUndefined()
      expect(tools.map((tool) => tool.name)).toEqual(
        expect.arrayContaining(['create_frame', 'get_frame_screenshot', 'upload_asset']),
      )
      expect(client.getInstructions()).not.toContain('import_webpage')
      expect(client.getInstructions()).not.toContain('view_website')
    } finally {
      await client.close()
      await server.close()
    }
  })
})

describe('MCP generate_image tool contract', () => {
  it('scopes a generation to a canvas and lets the agent choose aspect and quality', async () => {
    const server = buildMcpServer('Test Owner', 'test-owner-id')
    const client = new Client({ name: 'doop-tool-contract-test', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()

    await server.connect(serverTransport)
    await client.connect(clientTransport)

    try {
      const { tools } = await client.listTools()
      const generate = tools.find((tool) => tool.name === 'generate_image')
      expect(generate).toBeDefined()
      const schema = generate!.inputSchema as ToolInputSchema
      expect(schema.properties).toEqual(
        expect.objectContaining({
          prompt: expect.any(Object),
          aspect: expect.any(Object),
          quality: expect.any(Object),
          canvas_id: expect.any(Object),
          agent_name: expect.any(Object),
        }),
      )
      expect(new Set(schema.required)).toEqual(new Set(['prompt', 'canvas_id', 'agent_name']))
      expect(client.getInstructions()).toContain('generate_image')

      /* an unknown canvas must be refused before anything is spent */
      const result = await client.callTool({
        name: 'generate_image',
        arguments: { prompt: 'a red circle', canvas_id: 'nope', agent_name: 'Test' },
      })
      expect(result.isError).toBe(true)
    } finally {
      await client.close()
      await server.close()
    }
  })
})

it('requires the original page list and rejects stale agent replacements', async () => {
  const { store } = await import('../server/store.ts')
  const canvas = {
    id: 'mcp-page-conflict',
    ownerId: 'test-owner-id',
    name: 'Pages',
    pages: [
      { id: 'first', name: 'Main' },
      { id: 'collaborator', name: 'New' },
    ],
    frames: [],
    createdAt: 0,
    updatedAt: 0,
  }
  store.canvases.set(canvas.id, canvas)
  const server = buildMcpServer('Test Owner', 'test-owner-id')
  const client = new Client({ name: 'pages-test', version: '1.0.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  await client.connect(a)
  try {
    const tool = (await client.listTools()).tools.find((tool) => tool.name === 'set_canvas_pages')!
    expect(tool.inputSchema.required).toContain('expectedPages')
    const result = await client.callTool({
      name: 'set_canvas_pages',
      arguments: {
        canvas_id: canvas.id,
        pages: [{ id: 'first', name: 'Renamed' }],
        expectedPages: [{ id: 'first', name: 'Main' }],
        agent_name: 'Agent',
      },
    })
    expect(result.isError).toBe(true)
    expect(JSON.stringify(result)).toContain('Pages changed')
    expect(canvas.pages).toHaveLength(2)
  } finally {
    store.canvases.delete(canvas.id)
    await client.close()
    await server.close()
  }
})

describe('MCP client contract', () => {
  async function connected() {
    const server = buildMcpServer('Test Owner', 'test-owner-id')
    const client = new Client({ name: 'doop-contract-test', version: '1.0.0' })
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
    await server.connect(serverTransport)
    await client.connect(clientTransport)
    return {
      client,
      close: async () => {
        await client.close()
        await server.close()
      },
    }
  }

  it('declares readOnlyHint, destructiveHint and openWorldHint explicitly on every tool, with a title', async () => {
    const { client, close } = await connected()
    try {
      const { tools } = await client.listTools()
      expect(tools.length).toBeGreaterThan(30)
      for (const tool of tools) {
        const a = tool.annotations ?? {}
        expect(typeof a.readOnlyHint, `${tool.name} readOnlyHint`).toBe('boolean')
        expect(typeof a.destructiveHint, `${tool.name} destructiveHint`).toBe('boolean')
        expect(typeof a.openWorldHint, `${tool.name} openWorldHint`).toBe('boolean')
        expect(tool.title, `${tool.name} title`).toBeTruthy()
        if (a.readOnlyHint) expect(a.destructiveHint, `${tool.name} read-only but destructive`).toBe(false)
      }
      const byName = Object.fromEntries(tools.map((t) => [t.name, t]))
      expect(byName.delete_frame!.annotations!.destructiveHint).toBe(true)
      expect(byName.set_frame_html!.annotations!.destructiveHint).toBe(true)
      expect(byName.get_frame_screenshot!.annotations!.readOnlyHint).toBe(true)
      expect(byName.search_images!.annotations!.openWorldHint).toBe(true)
      expect(byName.list_backgrounds).toBeUndefined()
      expect(byName.search_inspiration).toBeUndefined()
    } finally {
      await close()
    }
  })

  it('exposes the connected account to standard MCP clients', async () => {
    const { client, close } = await connected()
    try {
      const { tools } = await client.listTools()
      const profile = tools.find((t) => t.name === 'get_profile')!
      expect(profile._meta?.['openai/profile']).toBeUndefined()
      expect(profile.annotations?.readOnlyHint).toBe(true)
      expect(profile.outputSchema).toBeDefined()
      const result = await client.callTool({ name: 'get_profile', arguments: {} })
      expect(result.structuredContent).toEqual({ id: 'test-owner-id', name: 'Test Owner' })
    } finally {
      await close()
    }
  })
})
