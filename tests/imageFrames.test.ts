// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'
import { api } from '../src/lib/api'
import { useStore } from '../src/lib/store'
import { clearHistory, undo } from '../src/lib/history'
import { uploadImageFrames } from '../src/lib/frameClipboard'
import { validateImageFile } from '../src/lib/imageFiles'

const file = () => new File(['image'], 'a.png', { type: 'image/png' })
beforeEach(() => {
  vi.restoreAllMocks()
  clearHistory()
  useStore.getState().setCanvas({
    id: 'c1',
    frames: [],
    pages: [
      { id: 'p2', name: 'Two' },
      { id: 'p3', name: 'Three' },
    ],
  } as unknown as Canvas)
  useStore.getState().setActivePage('p2')
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 100
      naturalHeight = 100
      onload?: () => void
      set src(_: string) {
        this.onload?.()
      }
    },
  )
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(api, 'uploadAsset').mockResolvedValue({ url: '/asset' } as never)
  let id = 0
  vi.spyOn(api, 'createFrame').mockImplementation(
    async (canvasId, data) => ({ ...data, canvasId, id: `f${++id}` }) as Frame,
  )
  vi.spyOn(api, 'deleteFrame').mockResolvedValue(undefined as never)
})

it('validates supported types and the exact asset cap', () => {
  for (const type of ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'])
    expect(validateImageFile(new File([new Uint8Array(5 * 1024 * 1024)], 'a', { type }))).toBeNull()
  expect(
    validateImageFile(new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'a.png', { type: 'image/png' })),
  ).toBeTruthy()
  for (const type of ['application/pdf', 'text/html'])
    expect(validateImageFile(new File(['x'], 'a.png', { type }))).toBeTruthy()
  expect(validateImageFile(new File(['x'], 'a.png'))).toBeNull()
})

it('places a group at the captured world center and page', async () => {
  let release!: () => void
  vi.mocked(api.uploadAsset).mockImplementation(async () => {
    await new Promise<void>((r) => {
      release = r
    })
    return { url: '/asset' } as never
  })
  const pending = uploadImageFrames('c1', [file()], undefined, { center: { x: 300, y: 200 }, pageId: 'p2' })
  await vi.waitFor(() => expect(release).toBeDefined())
  useStore.getState().setViewport({ x: 999, y: 999, zoom: 3 })
  useStore.getState().setActivePage('p3')
  release()
  await pending
  expect(api.createFrame).toHaveBeenCalledWith('c1', expect.objectContaining({ x: 250, y: 150, pageId: 'p2' }))
  vi.mocked(api.uploadAsset).mockResolvedValue({ url: '/asset' } as never)
  await uploadImageFrames('c1', [file(), file()], undefined, { center: { x: 300, y: 200 }, pageId: 'p2' })
  expect(
    vi
      .mocked(api.createFrame)
      .mock.calls.slice(1)
      .map(([, d]) => [d.x, d.y]),
  ).toEqual([
    [180, 150],
    [320, 150],
  ])
})

it.each([2, 3])('keeps and groups successful siblings after a failure (%s files)', async (count) => {
  vi.mocked(api.uploadAsset).mockRejectedValueOnce(new Error('secret'))
  const results = await uploadImageFrames('c1', Array.from({ length: count }, file))
  expect(results).toHaveLength(count)
  expect(results[0]).toHaveProperty('error')
  expect(useStore.getState().canvas?.frames).toHaveLength(count - 1)
  await undo()
  expect(api.deleteFrame).toHaveBeenCalledTimes(count - 1)
  await undo()
  expect(api.deleteFrame).toHaveBeenCalledTimes(count - 1)
})

it('does not contaminate another canvas after navigation', async () => {
  let release!: () => void
  vi.mocked(api.uploadAsset).mockImplementationOnce(async () => {
    await new Promise<void>((r) => {
      release = r
    })
    return { url: '/asset' } as never
  })
  const pending = uploadImageFrames('c1', [file()])
  await vi.waitFor(() => expect(release).toBeDefined())
  useStore.getState().setCanvas({ id: 'c2', frames: [] } as unknown as Canvas)
  release()
  await pending
  expect(api.createFrame).toHaveBeenCalledWith('c1', expect.objectContaining({ pageId: 'p2' }))
  expect(useStore.getState().canvas?.frames).toEqual([])
  await undo()
  expect(api.deleteFrame).not.toHaveBeenCalled()
})

it('keeps bitmap aspect ratio and the 900px frame cap', async () => {
  vi.stubGlobal(
    'Image',
    class {
      naturalWidth = 1800
      naturalHeight = 900
      onload?: () => void
      set src(_: string) {
        this.onload?.()
      }
    },
  )
  await uploadImageFrames('c1', [])
  expect(api.uploadAsset).not.toHaveBeenCalled()
  const image = file()
  await uploadImageFrames('c1', [image])
  expect(api.uploadAsset).toHaveBeenCalledWith('c1', image)
  expect(api.createFrame).toHaveBeenCalledWith('c1', expect.objectContaining({ width: 900, height: 450 }))
})
