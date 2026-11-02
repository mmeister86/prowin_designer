import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'
import { Client, startServer, type Server } from './harness'
import { useStore } from '../src/lib/store'
import { copyFrames, duplicateFrames, pasteFrameCentered } from '../src/lib/frameClipboard'
import { clearHistory, undo, redo } from '../src/lib/history'
import { duplicatePage } from '../src/lib/pageEdits'
import { api } from '../src/lib/api'

let server: Server
let owner: Client
let member: Client
let creator: Client
let creatorId: string
let workspaceId: string
let canvas: Canvas
let acting: Client
const writes: { input: Record<string, unknown>; status: number }[] = []
const nativeFetch = globalThis.fetch

beforeAll(async () => {
  server = await startServer()
  owner = await new Client(server).signUp('copy-owner@test.dev', 'Owner')
  member = await new Client(server).signUp('copy-member@test.dev', 'Member')
  creator = await new Client(server).signUp('copy-creator@test.dev', 'Creator')
  await owner.post('/api/prowin/creator')
  await creator.post('/api/prowin/creator')
  creatorId = (await (await creator.get('/api/me')).json()).id
  workspaceId = (await (await owner.post('/api/workspaces', { name: 'Copy runtime' })).json()).id
  await owner.post(`/api/workspaces/${workspaceId}/members`, { email: 'copy-member@test.dev' })
  await owner.post(`/api/workspaces/${workspaceId}/members`, { email: 'copy-creator@test.dev', role: 'creator' })
}, 70_000)
beforeEach(async () => {
  acting = owner
  canvas = await (await owner.post('/api/canvases', { name: 'Copy', workspaceId })).json()
  useStore.getState().setCanvas(canvas)
  useStore.getState().selectMany([])
  useStore.setState({ notice: null })
  clearHistory()
  writes.length = 0
  const storage = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
  })
  vi.stubGlobal('window', { innerWidth: 1200, innerHeight: 900 })
  vi.stubGlobal('document', { querySelector: () => null })
  vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof input !== 'string' || !input.startsWith('/')) return nativeFetch(input, init)
    const response = await nativeFetch(`${server.base}${input}`, {
      ...init,
      headers: { ...init?.headers, Cookie: acting.header() },
    })
    if (input.endsWith('/frames') && init?.method === 'POST')
      writes.push({ input: JSON.parse(init.body as string), status: response.status })
    return response
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
afterAll(() => server?.stop())

async function source(html = '<p>Plain preset</p>'): Promise<Frame> {
  const response = await owner.post(`/api/canvases/${canvas.id}/frames`, { name: 'Source', preset: 'a4', html })
  expect(response.status).toBe(200)
  const frame: Frame = await response.json()
  const customized = await owner.patch(`/api/frames/${frame.id}`, { width: 820, height: 1160 })
  expect(customized.status).toBe(200)
  return customized.json()
}
async function frames(): Promise<Frame[]> {
  return (await (await owner.get(`/api/canvases/${canvas.id}`)).json()).frames
}

it('redoes a customized page copy for an original Member with a live source absent from the local snapshot', async () => {
  const original = await source()
  acting = member // Never had Creator authority; the server copy is newer than this local snapshot.
  await duplicatePage(useStore.getState().canvas!, canvas.pages![0]!.id)
  const copied = useStore.getState().canvas!.frames[0]!
  expect(copied).toMatchObject({ preset: 'a4', width: 820, height: 1160 })
  await undo()
  await redo()
  expect(writes).toHaveLength(1)
  expect(writes[0]).toMatchObject({ status: 200, input: { sourceFrameId: original.id } })
  expect((await frames()).filter((f) => f.pageId === copied.pageId)).toEqual([
    expect.objectContaining({ preset: 'a4', width: 820, height: 1160 }),
  ])
})

it.each([false, true])(
  'pastes a deleted plain preset as explicit Creator authoring and redoes without dead provenance (cross-canvas=%s)',
  async (crossCanvas) => {
    const original = await source()
    copyFrames([original])
    expect((await owner.delete(`/api/frames/${original.id}`)).status).toBe(200)
    if (crossCanvas) {
      canvas = await (await owner.post('/api/canvases', { name: 'Paste destination', workspaceId })).json()
      useStore.getState().setCanvas(canvas)
    }
    pasteFrameCentered(canvas.id)
    await vi.waitFor(() => expect(useStore.getState().selectedIds).toHaveLength(1))
    expect(writes.map((w) => w.status)).toEqual([404, 200])
    expect(writes[1]!.input).toMatchObject({ preset: 'a4', width: 820, height: 1160, restoreDimensions: true })
    expect(writes[1]!.input).not.toHaveProperty('sourceFrameId')
    expect(await frames()).toEqual([expect.objectContaining({ preset: 'a4', width: 820, height: 1160 })])
    await undo()
    expect(await frames()).toEqual([])
    await redo()
    expect(writes).toHaveLength(3)
    expect(writes[2]!.status).toBe(200)
    expect(writes[2]!.input).not.toHaveProperty('sourceFrameId')
    expect(await frames()).toEqual([expect.objectContaining({ preset: 'a4', width: 820, height: 1160 })])
  },
)

it.each([
  'member',
  'canonical-member',
  'revoked-creator',
  'template',
  'escaped-template',
  'inaccessible-source',
] as const)('fails closed with visible feedback for %s paste', async (reason) => {
  let original = await source(reason === 'template' ? '<p data-od-id="title">Protected</p>' : undefined)
  if (reason === 'canonical-member')
    original = await (await owner.patch(`/api/frames/${original.id}`, { width: 794, height: 1123 })).json()
  copyFrames([original])
  if (reason === 'escaped-template')
    copyFrames([{ ...original, html: '&lt;p data-od-id="title"&gt;Protected&lt;/p&gt;' }])
  if (reason === 'inaccessible-source') {
    // The destination Creator cannot access this private source canvas.
    const privateCanvas: Canvas = await (await owner.post('/api/canvases', { name: 'Private source' })).json()
    const privateSource: Frame = await (
      await owner.post(`/api/canvases/${privateCanvas.id}/frames`, {
        name: 'Private',
        preset: 'a4',
        html: '<p>Plain</p>',
      })
    ).json()
    copyFrames([privateSource])
    acting = creator
  } else {
    await owner.delete(`/api/frames/${original.id}`)
    if (reason === 'member' || reason === 'canonical-member') acting = member
    if (reason === 'revoked-creator') {
      await owner.patch(`/api/workspaces/${workspaceId}/members/${creatorId}`, { role: 'member' })
      acting = creator
    }
  }
  try {
    const before = await frames()
    pasteFrameCentered(canvas.id)
    await vi.waitFor(() => expect(useStore.getState().notice?.text).toBeTruthy())
    expect(useStore.getState().notice?.text).toContain(
      reason === 'inaccessible-source' ? 'Creator' : 'Quell-Zeichenfläche',
    )
    expect(writes).toHaveLength(1)
    expect(writes[0]!.status).toBe(reason === 'inaccessible-source' ? 403 : 404)
    expect(await frames()).toEqual(before)
    expect(useStore.getState().selectedIds).toEqual([])
  } finally {
    if (reason === 'revoked-creator')
      await owner.patch(`/api/workspaces/${workspaceId}/members/${creatorId}`, { role: 'creator' })
  }
})

it('rechecks Creator authority on the server if it is revoked between capability lookup and unsourced authoring', async () => {
  const original = await source()
  copyFrames([original])
  await owner.delete(`/api/frames/${original.id}`)
  acting = creator
  const capabilities = api.canvasCapabilities
  vi.spyOn(api, 'canvasCapabilities').mockImplementation(async (id) => {
    const current = await capabilities(id)
    expect(current.manageLocks).toBe(true)
    const revoked = await owner.patch(`/api/workspaces/${workspaceId}/members/${creatorId}`, { role: 'member' })
    expect(revoked.status).toBe(200)
    return current
  })
  try {
    pasteFrameCentered(canvas.id)
    await vi.waitFor(() => expect(useStore.getState().notice?.text).toContain('Creator'))
    expect(writes.map((w) => w.status)).toEqual([404, 403])
    expect(await frames()).toEqual([])
    expect(useStore.getState().selectedIds).toEqual([])
  } finally {
    await owner.patch(`/api/workspaces/${workspaceId}/members/${creatorId}`, { role: 'creator' })
  }
})

it('shows denied duplication errors while preserving successful siblings and their undo', async () => {
  const missing = await source()
  const live = await source()
  await owner.delete(`/api/frames/${missing.id}`)
  acting = member
  duplicateFrames([missing, live])
  await vi.waitFor(() => expect(useStore.getState().notice?.text).toBeTruthy())
  expect(useStore.getState().selectedIds).toHaveLength(1)
  expect(await frames()).toHaveLength(2)
  await undo()
  expect(await frames()).toEqual([expect.objectContaining({ id: live.id })])
})
