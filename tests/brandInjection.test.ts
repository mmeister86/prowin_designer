import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import type { Canvas, GuidelineDoc } from '../shared/types.ts'
import { Client, startServer, type Server } from './harness.ts'

const source = readFileSync(new URL('../DESIGN-prowin.md', import.meta.url), 'utf8')
const brandDocs = (canvas: Canvas) => canvas.guidelines?.filter((doc) => doc.name === 'prowin-brand') ?? []

it('fails clearly for missing, empty or oversized brand sources in the runtime module layout', () => {
  const root = mkdtempSync(join(tmpdir(), 'doop-brand-source-'))
  try {
    mkdirSync(join(root, 'server/prowin'), { recursive: true })
    mkdirSync(join(root, 'shared'))
    copyFileSync(new URL('../shared/guidelines.ts', import.meta.url), join(root, 'shared/guidelines.ts'))
    writeFileSync(join(root, 'package.json'), '{"type":"module"}')
    const module = join(root, 'server/prowin/brand.ts')
    copyFileSync(new URL('../server/prowin/brand.ts', import.meta.url), module)
    const run = () =>
      spawnSync(fileURLToPath(new URL('../node_modules/.bin/tsx', import.meta.url)), [module], {
        cwd: root,
        encoding: 'utf8',
      })
    const missing = run()
    expect(missing.status).not.toBe(0)
    expect(missing.stderr).toContain('DESIGN-prowin.md')
    expect(missing.stderr).toContain('ENOENT')
    writeFileSync(join(root, 'DESIGN-prowin.md'), ' \n\t')
    const empty = run()
    expect(empty.status).not.toBe(0)
    expect(empty.stderr).toContain('DESIGN-prowin.md must contain')
    writeFileSync(join(root, 'DESIGN-prowin.md'), 'x'.repeat(64_000))
    const oversized = run()
    expect(oversized.status).not.toBe(0)
    expect(oversized.stderr).toContain('seeded guideline would exceed 64000 characters')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

it('seeds fresh and missing-brand copies durably without replacing local edits or restoring deletions', async () => {
  let server: Server = await startServer({ RESIDENT_TASK_LIMIT: '0' })
  try {
    let owner = await new Client(server).signUp('brand@test.dev', 'Brand Owner')
    const fresh: Canvas = await (await owner.post('/api/canvases', { name: 'Brand' })).json()
    expect(brandDocs(fresh)).toHaveLength(1)
    expect(brandDocs(fresh)[0]).toMatchObject({ title: 'proWIN Brand', markdown: expect.stringContaining(source) })
    const untouched: Canvas = await (await owner.post('/api/canvases', { name: 'Untouched' })).json()
    const base = `/api/canvases/${fresh.id}`
    const edited = source + '\n\nLocal addition: keep this note.'
    expect(
      (
        await owner.req(`${base}/guidelines/prowin-brand`, {
          method: 'PUT',
          body: JSON.stringify({ markdown: edited, title: 'My brand' }),
        })
      ).status,
    ).toBe(200)
    expect(
      (await owner.req(`${base}/guidelines/prowin-brand`, { method: 'PUT', body: JSON.stringify({ x: -420, y: 321 }) }))
        .status,
    ).toBe(200)
    const copy: Canvas = await (await owner.post(`${base}/duplicate`)).json()
    expect(brandDocs(copy)).toHaveLength(1)
    expect(brandDocs(copy)[0]).toMatchObject({ title: 'My brand', markdown: edited.trim(), x: -420, y: 321 })
    expect(
      (await owner.req(`${base}/guidelines/prowin-brand`, { method: 'PUT', body: JSON.stringify({ markdown: '' }) }))
        .status,
    ).toBe(200)
    const legacyCopy: Canvas = await (await owner.post(`${base}/duplicate`)).json()
    expect(brandDocs(legacyCopy)).toHaveLength(1)
    expect(brandDocs(legacyCopy)[0]?.markdown).toContain(source)
    expect(brandDocs(await (await owner.get(base)).json())).toEqual([])

    const dataDir = server.dataDir
    server.stop({ keepData: true })
    await server.stopped
    server = await startServer({ RESIDENT_TASK_LIMIT: '0' }, dataDir)
    owner = new Client(server)
    expect(
      (await owner.post('/api/auth/sign-in/email', { email: 'brand@test.dev', password: 'password12345' })).status,
    ).toBe(200)
    for (const id of [untouched.id, legacyCopy.id]) {
      const restored: Canvas = await (await owner.get(`/api/canvases/${id}`)).json()
      expect(brandDocs(restored)).toHaveLength(1)
      expect(brandDocs(restored)[0]?.markdown).toContain(source)
    }
    const restored: Canvas = await (await owner.get(`/api/canvases/${copy.id}`)).json()
    expect(brandDocs(restored)).toHaveLength(1)
    expect(brandDocs(restored)[0]).toMatchObject({ title: 'My brand', markdown: edited.trim(), x: -420, y: 321 })
    expect(brandDocs(await (await owner.get(base)).json())).toEqual([])
  } finally {
    server.stop()
    await server.stopped
  }
}, 70_000)

it('serves the entire authoritative source through MCP and accepts full-source edits up to 64000 characters', async () => {
  const server = await startServer({ RESIDENT_TASK_LIMIT: '0' })
  try {
    const owner = await new Client(server).signUp('brand-limits@test.dev', 'Brand Editor')
    const canvas: Canvas = await (await owner.post('/api/canvases', { name: 'Limits' })).json()
    const key = await (await owner.post('/api/agent-keys', { name: 'Brand test' })).json()
    const call = async (name: string, args: Record<string, unknown>) => {
      const res = await fetch(`${server.base}/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.secret}` },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      })
      return (await res.json()).result
    }
    const guide = await call('get_guide', { topic: 'doop-instructions' })
    expect(guide.isError).not.toBe(true)
    expect.soft(guide.content.map((block: { text?: string }) => block.text ?? '').join('\n')).toContain(source)
    for (const markdown of [source + '\n\nLocal note.', 'x'.repeat(64_000)]) {
      const response = await owner.req(`/api/canvases/${canvas.id}/guidelines/prowin-brand`, {
        method: 'PUT',
        body: JSON.stringify({ markdown }),
      })
      expect(response.status).toBe(200)
      const result = await call('set_guidelines', {
        canvas_id: canvas.id,
        name: 'prowin-brand',
        markdown,
        agent_name: 'Brand',
      })
      expect(result.isError).not.toBe(true)
      const saved: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
      expect(brandDocs(saved)[0]?.markdown).toBe(markdown.trim())
    }
    const oversized = 'x'.repeat(64_001)
    expect(
      (
        await owner.req(`/api/canvases/${canvas.id}/guidelines/prowin-brand`, {
          method: 'PUT',
          body: JSON.stringify({ markdown: oversized }),
        })
      ).status,
    ).toBe(400)
    const rejected = await call('set_guidelines', {
      canvas_id: canvas.id,
      name: 'prowin-brand',
      markdown: oversized,
      agent_name: 'Brand',
    })
    expect(rejected.isError).toBe(true)
    const saved: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
    expect((brandDocs(saved)[0] as GuidelineDoc).markdown).toHaveLength(64_000)
  } finally {
    server.stop()
    await server.stopped
  }
}, 70_000)
