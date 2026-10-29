import { afterAll, beforeAll, expect, it, vi } from 'vitest'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import WebSocket from 'ws'
import sharp from 'sharp'
import { Client, startServer, type Server } from './harness.ts'
import { createEgressDirectory } from './egressJournal.ts'
import { findBrowserPath } from '../server/screenshot.ts'
import type { AgentTask, Canvas, DesignDecision, MemoryProposal } from '../shared/types.ts'

let server: Server
let owner: Client
let canvas: Canvas
let socket: WebSocket
const tasks = new Map<string, AgentTask>()
const decisions = new Map<string, DesignDecision>()
const proposals = new Map<string, MemoryProposal>()
const directory = createEgressDirectory()
const journal = join(directory, 'requests.jsonl')
const referenceScreenshot = join(directory, 'reference-screenshot.png')

beforeAll(async () => {
  writeFileSync(journal, '')
  server = await startServer({
    DOOP_AGENT_PROVIDER: 'requesty',
    DOOP_AGENT_MODEL: 'policy/prowin-layout-gen',
    DOOP_DISTILL_MODEL: 'policy/prowin-text-gen',
    REQUESTY_API_KEY: 'requesty-integration-key',
    RESIDENT_TASK_LIMIT: '4',
    ANTHROPIC_API_KEY: '',
    SMTP_HOST: '',
    CHROME_NO_SANDBOX: 'true',
    PROWIN_TEST_EGRESS_JOURNAL: journal,
    PROWIN_TEST_REFERENCE_SCREENSHOT: referenceScreenshot,
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --import=${new URL('./fixtures/requesty-router.mjs', import.meta.url).href}`,
  })
  owner = await new Client(server).signUp('requesty-resident@test.dev', 'Requesty Tester')
  canvas = await (await owner.post('/api/canvases', { name: 'Requesty integration' })).json()
  socket = new WebSocket(`ws://localhost:${server.port}/ws`, { headers: { Cookie: owner.header() } })
  await new Promise<void>((resolve, reject) => {
    socket.on('error', reject)
    socket.on('open', () =>
      socket.send(JSON.stringify({ type: 'join', canvasId: canvas.id, clientId: 'requesty-test' })),
    )
    socket.on('message', (data) => {
      const message = JSON.parse(String(data))
      if (message.type === 'init') resolve()
      if (message.type === 'task') tasks.set(message.task.id, message.task)
      if (message.type === 'decision') decisions.set(message.decision.id, message.decision)
      if (message.type === 'proposal') proposals.set(message.proposal.id, message.proposal)
    })
  })
}, 70_000)
afterAll(async () => {
  socket?.close()
  server?.stop()
  await server?.stopped
  try {
    const entries = readFileSync(journal, 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line))
    expect(entries.length).toBeGreaterThan(0)
    // Check independently: Resident and Distiller intentionally catch transport failures.
    expect(entries.filter((entry) => !entry.allowed)).toEqual([])
    expect(new Set(entries.map((entry) => entry.origin))).toEqual(new Set(['https://router.eu.requesty.ai']))
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('completes a real resident card with EU-only screenshot, summary and pending rule proposal', async () => {
  expect(findBrowserPath(), 'The M2 smoke requires Chrome/Chromium; set CHROME_PATH').not.toBeNull()
  const pixels = Buffer.alloc(64 * 32 * 3)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 64; x++) {
      const offset = (y * 64 + x) * 3
      pixels[offset] = x < 32 ? 255 : 0
      pixels[offset + 1] = x < 32 ? 0 : 255
      pixels[offset + 2] = x < 32 ? 255 : 0
    }
  }
  const png = await sharp(pixels, { raw: { width: 64, height: 32, channels: 3 } })
    .png()
    .toBuffer()
  const upload = await owner.req(`/api/canvases/${canvas.id}/assets`, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: new Uint8Array(png),
  })
  expect(upload.status).toBe(200)
  const asset = await upload.json()
  const frameResponse = await owner.post(`/api/canvases/${canvas.id}/frames`, {
    name: 'Requesty reference fixture',
    width: 64,
    height: 32,
    html: `<!doctype html><html><head><style>html,body{margin:0;padding:0;width:64px;height:32px;overflow:hidden}img{display:block;width:64px;height:32px;border:0}</style></head><body><img src="${asset.url}"></body></html>`,
  })
  expect(frameResponse.status).toBe(200)
  const source = await frameResponse.json()
  const res = await owner.post(`/api/canvases/${canvas.id}/cards`, {
    title: 'Create an EU integration frame',
    attachments: [source.id],
  })
  expect(res.status).toBe(200)
  const card: AgentTask = await res.json()
  await vi.waitFor(() => expect(tasks.get(card.id)?.endedAt).toBeTypeOf('number'), { timeout: 20_000 })
  expect(tasks.get(card.id)?.failedAt).toBeUndefined()
  const updated: Canvas = await (await owner.get(`/api/canvases/${canvas.id}`)).json()
  expect(updated.frames).toHaveLength(2)
  expect(updated.frames.find((frame) => frame.id === source.id)).toEqual(source)
  expect(updated.frames.find((frame) => frame.id !== source.id)?.html).toContain('EU integration')
  // This is the image_url immediately following the source screenshot result,
  // captured at the deterministic EU router boundary, not the result screenshot.
  const { data, info } = await sharp(readFileSync(referenceScreenshot))
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })
  expect([info.width, info.height, info.channels]).toEqual([64, 32, 3])
  for (const [x, expected] of [
    [16, [255, 0, 255]],
    [48, [0, 255, 0]],
  ] as const) {
    const offset = (16 * info.width + x) * info.channels
    for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(data[offset + channel]! - expected[channel]!)).toBeLessThanOrEqual(5)
    }
  }
  await vi.waitFor(() => {
    expect([...decisions.values()]).toMatchObject([{ summary: 'Prefer blue accents' }])
    expect([...proposals.values()]).toMatchObject([{ status: 'pending', rule: '- Use blue accents' }])
  })
  const entries = readFileSync(journal, 'utf8')
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line))
  // Five layout turns plus the two Distiller calls pass the same boundary.
  expect(entries).toHaveLength(7)
  expect(entries.every((entry) => entry.allowed && entry.pathname === '/v1/chat/completions')).toBe(true)
}, 25_000)

it('pauses a budget-rejected resident card for manual retry without completing it', async () => {
  const res = await owner.post(`/api/canvases/${canvas.id}/cards`, { title: 'Budget failure test' })
  expect(res.status).toBe(200)
  const card: AgentTask = await res.json()
  await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
  expect(tasks.get(card.id)?.endedAt).toBeUndefined()
  expect(tasks.get(card.id)?.failureReason).not.toMatch(/reconnect/i)
})

it.each(['Credential failure test', 'Policy failure test'])(
  'directs %s to the administrator without leaking upstream diagnostics',
  async (title) => {
    const response = await owner.post(`/api/canvases/${canvas.id}/cards`, { title })
    expect(response.status).toBe(200)
    const card: AgentTask = await response.json()
    await vi.waitFor(() => expect(tasks.get(card.id)?.failedAt).toBeTypeOf('number'))
    const failed = tasks.get(card.id)!
    expect(failed.endedAt).toBeUndefined()
    expect(failed.failureReason).toBe(
      'Der Server-Agent benötigt Unterstützung durch die Administration, bevor Du es erneut versuchen kannst.',
    )
    expect(failed.failureReason).not.toMatch(/internal operator diagnostic|reconnect|Retry when you are ready/i)
  },
)

it('enforces the configured task limit before queueing further paid work', async () => {
  const response = await owner.post(`/api/canvases/${canvas.id}/cards`, { title: 'Over the task allowance' })
  expect(response.status).toBe(403)
  expect(await response.json()).toMatchObject({ error: 'resident_limit', used: 4, limit: 4 })
})
