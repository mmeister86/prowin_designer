// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

const permissions = vi.hoisted(() => ({ manageLocks: true }))
vi.mock('../src/prowin/canvasPermissions', () => ({
  useCanvasCapabilities: () => ({ manageLocks: permissions.manageLocks }),
  canManageFrameLocks: () => permissions.manageLocks,
}))
vi.mock('../src/lib/ws', () => ({ sendWs: vi.fn() }))
vi.mock('../src/lib/api', async (original) => ({
  ...(await original<typeof import('../src/lib/api')>()),
  api: {
    updateFrame: vi.fn(async () => ({})),
    createFrame: vi.fn(async (_canvasId, input) => ({ ...input, id: 'copy' })),
    deleteFrame: vi.fn(async () => ({})),
  },
}))
const { FrameView } = await import('../src/components/FrameView')
const { TooltipProvider } = await import('../src/components/ui/tooltip')
const { useStore } = await import('../src/lib/store')
const { api } = await import('../src/lib/api')
const history = await import('../src/lib/history')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const base: Frame = {
  id: 'a',
  canvasId: 'c',
  name: 'A',
  x: 0,
  y: 0,
  width: 200,
  height: 200,
  html: '',
  createdAt: 0,
  updatedAt: 1,
  updatedBy: 'Me',
}
const updateFrame = vi.mocked(api.updateFrame)
const createFrame = vi.mocked(api.createFrame)
const deleteFrame = vi.mocked(api.deleteFrame)
const flush = () => new Promise((r) => setTimeout(r, 0))

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
  vi.clearAllMocks()
  history.clearHistory()
  const { resetGeometrySaves } = await import('../src/lib/geometrySaves')
  resetGeometrySaves()
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...base }] } as Canvas)
  useStore.setState({ selectedIds: ['a'], selectedId: 'a', tool: 'select', panMode: false, notice: null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function surface() {
  await act(async () =>
    root.render(
      <TooltipProvider>
        <FrameView frame={{ ...base }} layoutZoom={1} />
      </TooltipProvider>,
    ),
  )
  return container.querySelector(`iframe[title="A"]`)!.parentElement!
}

async function dragMove(el: HTMLElement, pointerId: number, dx: number) {
  await act(async () => {
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId, clientX: 0, clientY: 0 }))
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId, clientX: dx, clientY: 0 }))
    await flush()
  })
}

it('a different pointer cancel leaves the active drag running', async () => {
  const { isGeometrySaving } = await import('../src/lib/geometrySaves')
  const el = await surface()
  await dragMove(el, 1, 40)
  expect(isGeometrySaving('a')).toBe(true)
  await act(async () => {
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 2 }))
    await flush()
  })
  // Still reserved: the other pointer must not abort the gesture.
  expect(isGeometrySaving('a')).toBe(true)
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'a')).toMatchObject({ x: 40 })
  await act(async () => {
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    await flush()
    await flush()
  })
  expect(updateFrame).toHaveBeenCalledTimes(1)
})

it('cancelled duplicate drag with a resolved copy removes the copy and records no history', async () => {
  const el = await surface()
  await act(async () => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        altKey: true,
        shiftKey: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 0, altKey: true, shiftKey: true }),
    )
    await flush()
    await flush()
  })
  expect(createFrame).toHaveBeenCalledTimes(1)
  await act(async () => {
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }))
    await flush()
    await flush()
  })
  expect(deleteFrame).toHaveBeenCalledTimes(1)
  expect(deleteFrame).toHaveBeenCalledWith('copy')
  await act(async () => {
    await history.undo()
  })
  // Only the (deleted) copy path: no create history survived, no extra writes.
  expect(updateFrame).not.toHaveBeenCalled()
})

it('cancelled duplicate drag with a pending copy deletes it on resolve and records no history', async () => {
  const gate = deferred<Frame>()
  createFrame.mockImplementationOnce(() => gate.promise)
  const el = await surface()
  await act(async () => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        button: 0,
        pointerId: 1,
        clientX: 0,
        clientY: 0,
        altKey: true,
        shiftKey: true,
      }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 40, clientY: 0, altKey: true, shiftKey: true }),
    )
    await flush()
  })
  expect(createFrame).toHaveBeenCalledTimes(1)
  await act(async () => {
    window.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1 }))
    await flush()
  })
  await act(async () => {
    gate.resolve({ ...base, id: 'copy' } as Frame)
    await flush()
    await flush()
  })
  expect(deleteFrame).toHaveBeenCalledTimes(1)
  expect(deleteFrame).toHaveBeenCalledWith('copy')
  await act(async () => {
    await history.undo()
  })
  expect(updateFrame).not.toHaveBeenCalled()
})
