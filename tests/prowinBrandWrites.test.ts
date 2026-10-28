import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as actions from '../server/actions.ts'
import * as persist from '../server/db/persist.ts'
import { store } from '../server/store.ts'
import { normalizeFrameHtml } from '../server/prowin/frameBrand.ts'
import type { Canvas } from '../shared/types.ts'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { buildMcpServer } from '../server/mcp.ts'

vi.mock('../server/db/persist.ts', () => ({
  saveFrame: vi.fn(),
  saveCanvas: vi.fn(),
  saveActivity: vi.fn(),
  saveTask: vi.fn(),
  saveFrameVersion: vi.fn(),
  getFrameVersion: vi.fn(),
  saveCanvasCopy: vi.fn(),
  savePageCopy: vi.fn(),
  deleteCanvas: vi.fn(),
  deleteFrame: vi.fn(),
}))
vi.mock('../server/resident.ts', () => ({ onFeedback: () => {} }))
vi.mock('../server/distill.ts', () => ({ onDecision: () => {} }))

const actor = actions.resolveActor({ name: 'Vera', kind: 'user' })
const RAW =
  '<!doctype html><html><head><style data-od-brand>old</style><link href="https://fonts.googleapis.com/css2?family=Roboto" rel=stylesheet></head><body><p>Original</p></body></html>'

beforeEach(() => {
  vi.clearAllMocks()
  const canvas: Canvas = { id: 'brand-writes', name: 'Brand', ownerId: 'owner', createdAt: 1, updatedAt: 1, frames: [] }
  store.init([canvas])
})
afterEach(() => vi.useRealTimers())

function frame(html = '') {
  return actions.createFrame('brand-writes', { name: 'Test', html }, actor)!
}

it('normalizes create/update before persistence and treats repeated raw saves as no-ops for history', () => {
  const created = frame(RAW)
  expect(created.html).toBe(normalizeFrameHtml(RAW))
  expect(vi.mocked(persist.saveFrame).mock.calls.at(-1)![0].html).toBe(created.html)
  actions.updateFrame(created.id, { html: RAW }, actor)
  expect(persist.saveFrameVersion).not.toHaveBeenCalled()
  actions.updateFrame(created.id, { html: '<main>Entirely new design</main>' }, actor)
  expect(persist.saveFrameVersion).toHaveBeenCalledTimes(1)
  expect(vi.mocked(persist.saveFrameVersion).mock.calls[0]![0].html).toBe(normalizeFrameHtml(RAW))
})

it('does not file an empty branded placeholder as a design', () => {
  const created = frame()
  expect(created.html).toBe(normalizeFrameHtml(''))
  actions.updateFrame(created.id, { html: '<p>First real content</p>' }, actor)
  expect(persist.saveFrameVersion).not.toHaveBeenCalled()
})

it.each([10, 41, 51, 59, 83, 125])('reassembles split tags without accumulating generated CSS (%i)', (split) => {
  const created = frame('<p>Previous</p>')
  actions.appendFrameHtml(created.id, RAW.slice(0, split), actor, { start: true })
  expect(created.html.match(/<style data-od-brand>/g)).toHaveLength(1)
  actions.appendFrameHtml(created.id, RAW.slice(split), actor, { done: true })
  expect(created.html).toBe(normalizeFrameHtml(RAW))
  expect(persist.saveFrameVersion).toHaveBeenCalledTimes(1)
})

it('keeps the normalized last chunk on timeout, and never reapplies an interrupted raw stream', () => {
  vi.useFakeTimers()
  const created = frame()
  actions.appendFrameHtml(created.id, '<style>p{color:red}', actor, { start: true })
  vi.advanceTimersByTime(30_100)
  expect(created.html).toBe(normalizeFrameHtml('<style>p{color:red}</style>'))
  actions.appendFrameHtml(created.id, '<p>Abandoned', actor, { start: true })
  actions.updateFrame(created.id, { html: '<main>New human content</main>' }, actor)
  vi.advanceTimersByTime(31_000)
  expect(created.html).toBe(normalizeFrameHtml('<main>New human content</main>'))
})

it('replaces a raw stream when a new start arrives', () => {
  const created = frame()
  actions.appendFrameHtml(created.id, '<p>Discarded', actor, { start: true })
  actions.appendFrameHtml(created.id, '<p>Replacement', actor, { start: true })
  actions.appendFrameHtml(created.id, '</p>', actor, { done: true })
  expect(created.html).toBe(normalizeFrameHtml('<p>Replacement</p>'))
})

it('normalizes legacy versions on restore and skips a restore with identical normalized HTML', async () => {
  const created = frame(RAW)
  vi.mocked(persist.getFrameVersion).mockResolvedValue({
    id: 'old',
    frameId: created.id,
    canvasId: created.canvasId,
    html: RAW,
    width: created.width,
    height: created.height,
    savedAt: 1,
    savedBy: 'Vera',
    htmlBytes: RAW.length,
  })
  await actions.restoreFrameVersion(created.id, 'old', actor)
  expect(persist.saveFrameVersion).not.toHaveBeenCalled()
  actions.updateFrame(created.id, { html: '<p>Changed</p>' }, actor)
  await actions.restoreFrameVersion(created.id, 'old', actor)
  expect(created.html).toBe(normalizeFrameHtml(RAW))
})

it('normalizes direct legacy HTML copies without changing the source', async () => {
  const created = frame()
  created.html = RAW // Represents an old in-memory snapshot.
  const canvasCopy = await store.duplicateCanvas(created.canvasId, 'owner', 'Vera')
  const pageCopy = await store.duplicatePage(created.canvasId, created.pageId!, 'Vera')
  expect(canvasCopy!.frames[0]!.html).toBe(normalizeFrameHtml(RAW))
  expect(pageCopy!.frames[0]!.html).toBe(normalizeFrameHtml(RAW))
  expect(created.html).toBe(RAW)
})

it('normalizes actual MCP create, replace and append tools through the same store', async () => {
  const server = buildMcpServer('Vera', 'owner')
  const client = new Client({ name: 'brand-test', version: '1.0' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  await server.connect(b)
  await client.connect(a)
  const tool = async (name: string, args: Record<string, unknown>) => {
    const result = await client.callTool({ name, arguments: { ...args, agent_name: 'Claude' } })
    expect(result.isError, JSON.stringify(result)).not.toBe(true)
  }
  try {
    await tool('create_frame', { canvas_id: 'brand-writes', name: 'MCP', html: RAW })
    const created = store.getCanvas('brand-writes')!.frames[0]!
    expect(created.html).toBe(normalizeFrameHtml(RAW))
    await tool('set_frame_html', { frame_id: created.id, html: '<p>Replacement</p>' })
    expect(created.html).toBe(normalizeFrameHtml('<p>Replacement</p>'))
    await tool('append_frame_html', { frame_id: created.id, html_chunk: RAW.slice(0, 51), start: true })
    await tool('append_frame_html', { frame_id: created.id, html_chunk: RAW.slice(51), done: true })
    expect(created.html).toBe(normalizeFrameHtml(RAW))
  } finally {
    await client.close()
    await server.close()
  }
})
