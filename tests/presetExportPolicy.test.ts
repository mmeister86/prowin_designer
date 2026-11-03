// TASK-34 Task 1 RED: preset-aware download dimensions (unit policy).
// Fails on current code: no defaultExportScale, forced scale=2 URLs,
// getImage ignores preset/download, MCP download_url forces scale=2.
import { describe, expect, it, vi } from 'vitest'
import type { Frame } from '../shared/types'
import { FORMAT_PRESETS, defaultExportScale } from '../shared/prowin/formats.ts'

const mocks = vi.hoisted(() => ({ renderFrame: vi.fn() }))
vi.mock('../server/screenshot.ts', () => ({ renderFrame: mocks.renderFrame }))
vi.mock('../server/storage.ts', () => ({
  putObject: vi.fn(async () => {}),
  getObject: vi.fn(async () => null),
  deleteObject: vi.fn(async () => {}),
}))

import { getImage } from '../server/previews.ts'
import { frameExportUrl } from '../src/lib/frameExport.ts'

let seq = 0
const frame = (over: Partial<Frame> = {}): Frame =>
  ({
    id: `p${seq++}`,
    canvasId: 'c',
    name: 'f',
    x: 0,
    y: 0,
    width: 640,
    height: 480,
    html: '',
    updatedAt: 1,
    updatedBy: 't',
    ...over,
  }) as Frame

const base = (over: Record<string, unknown> = {}) => ({
  ext: 'png' as const,
  quality: 90,
  preview: false,
  ip: `policy-ip${seq++}`,
  isAuthenticated: () => Promise.resolve(false),
  ...over,
})

describe('defaultExportScale', () => {
  it('returns the preset exportScale (A4 3.125, social 1)', () => {
    expect(defaultExportScale('a4')).toBe(3.125)
    expect(defaultExportScale('ig-post')).toBe(1)
    expect(defaultExportScale('ig-story')).toBe(1)
    expect(defaultExportScale('fb-post')).toBe(1)
  })

  it('defaults free frames (no preset) to 2', () => {
    expect(defaultExportScale(undefined)).toBe(2)
  })
})

describe('frameExportUrl (UI/clipboard)', () => {
  it('requests download intent without a forced scale', () => {
    const f = frame()
    expect(frameExportUrl(f, 'png')).toBe(`/i/${f.id}.png?download`)
  })

  it('has no scale param for png and jpg', () => {
    const f = frame()
    expect(frameExportUrl(f, 'png')).toBe(`/i/${f.id}.png?download`)
    expect(frameExportUrl(f, 'jpg')).toBe(`/i/${f.id}.jpg?download`)
  })
})

describe('getImage preset-aware scale', () => {
  it('renders downloads at the preset default scale (A4 3.125)', async () => {
    mocks.renderFrame.mockResolvedValue(Buffer.from('x'))
    const f = frame({ preset: 'a4' })
    await getImage(f, base({ download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(f, 3.125, expect.anything())
  })

  it('renders social preset downloads at 1x', async () => {
    mocks.renderFrame.mockResolvedValue(Buffer.from('x'))
    const f = frame({ preset: 'ig-post' })
    await getImage(f, base({ download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(f, 1, expect.anything())
  })

  it('renders free-frame downloads at 2x', async () => {
    mocks.renderFrame.mockResolvedValue(Buffer.from('x'))
    const f = frame()
    await getImage(f, base({ download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(f, 2, expect.anything())
  })

  it('renders non-downloads at 1x regardless of preset', async () => {
    mocks.renderFrame.mockResolvedValue(Buffer.from('x'))
    const f = frame({ preset: 'a4' })
    await getImage(f, base({}))
    expect(mocks.renderFrame).toHaveBeenCalledWith(f, 1, expect.anything())
  })

  it.each([1, 2])('explicit scale %i overrides the preset default', async (scale) => {
    mocks.renderFrame.mockResolvedValue(Buffer.from('x'))
    const f = frame({ preset: 'a4' })
    await getImage(f, base({ scale, download: true }))
    expect(mocks.renderFrame).toHaveBeenCalledWith(f, scale, expect.anything())
  })

  it('download+preview never serves the persisted thumbnail', async () => {
    const { getObject } = await import('../server/storage.ts')
    vi.mocked(getObject).mockResolvedValueOnce(Buffer.from('stored'))
    mocks.renderFrame.mockResolvedValue(Buffer.from('live'))
    const f = frame({ preset: 'ig-post' })
    const r = await getImage(f, base({ ext: 'jpg', preview: true, download: true }))
    expect(r.status).toBe('ok')
    expect(mocks.renderFrame).toHaveBeenCalled()
    if (r.status === 'ok') expect(r.buf.toString()).toBe('live')
  })
})

describe('MCP export_frame', () => {
  it('keeps image_url/width/height semantics and reports truthful download dimensions', async () => {
    const { buildMcpServer } = await import('../server/mcp.ts')
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js')
    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js')
    const { store } = await import('../server/store.ts')
    const canvasId = 'policy-canvas'
    const f = frame({ canvasId, width: 101, height: 77, preset: 'ig-post' }) as Frame
    store.init([{ id: canvasId, ownerId: 'o', name: 'C', frames: [f], createdAt: 0, updatedAt: 0 }] as never)
    const server = buildMcpServer('Owner', 'o')
    const client = new Client({ name: 't', version: '1.0.0' })
    const [a, b] = InMemoryTransport.createLinkedPair()
    await server.connect(b)
    await client.connect(a)
    try {
      const res = (await client.callTool({
        name: 'export_frame',
        arguments: { frame_id: f.id },
      })) as { content: { text: string }[] }
      const payload = JSON.parse(res.content[0]!.text)
      // image_url keeps scale=2 semantics
      expect(payload.image_url).toContain('?scale=2')
      expect(payload.width).toBe(202)
      expect(payload.height).toBe(154)
      // download URL carries intent, no forced scale; dimensions are truthful
      expect(payload.download_url).toContain('download')
      expect(payload.download_url).not.toContain('scale=')
      expect(payload.download_width).toBe(Math.round(101 * FORMAT_PRESETS['ig-post'].exportScale))
      expect(payload.download_height).toBe(Math.round(77 * FORMAT_PRESETS['ig-post'].exportScale))
    } finally {
      await client.close()
      await server.close()
    }
  })
})
