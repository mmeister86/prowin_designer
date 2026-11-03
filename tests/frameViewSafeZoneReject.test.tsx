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
  },
}))
const { FrameView } = await import('../src/components/FrameView')
const { TooltipProvider } = await import('../src/components/ui/tooltip')
const { useStore } = await import('../src/lib/store')
const { ApiError, api } = await import('../src/lib/api')
const history = await import('../src/lib/history')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ZONE = { top: 500, right: 0, bottom: 500, left: 0 }
const zoned: Frame = {
  id: 'zoned',
  canvasId: 'c',
  name: 'Story',
  preset: 'ig-post',
  x: 0,
  y: 0,
  width: 1080,
  height: 1080,
  safeZoneOverride: { ...ZONE },
  html: '',
  createdAt: 0,
  updatedAt: 1,
  updatedBy: 'Me',
}
const updateFrame = vi.mocked(api.updateFrame)
const flush = () => new Promise((r) => setTimeout(r, 0))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  permissions.manageLocks = true
  vi.clearAllMocks()
  history.clearHistory()
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...zoned }] } as Canvas)
  useStore.setState({ selectedIds: ['zoned'], selectedId: 'zoned', tool: 'select', panMode: false, notice: null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function grip() {
  await act(async () =>
    root.render(
      <TooltipProvider>
        <FrameView frame={{ ...zoned }} layoutZoom={1} />
      </TooltipProvider>,
    ),
  )
  return container
    .querySelector(`iframe[title="${zoned.name}"]`)!
    .parentElement!.parentElement!.querySelector<HTMLElement>('.cursor-nwse-resize')!
}

/* shrink the frame so the retained override (top+bottom 1000) no longer fits */
async function dragShrink(el: HTMLElement) {
  await act(async () => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 0, clientY: 0 }),
    )
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 0, clientY: -200 }))
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
    await flush()
    await flush()
  })
}

function rejectedResize() {
  return new ApiError(
    400,
    JSON.stringify({ error: 'Der Safe-Zone-Abstand ist größer als die Zeichenfläche. Verkleinere die Abstände.' }),
  )
}

it('rejected drag-resize restores authoritative geometry with a German notice and no history', async () => {
  updateFrame.mockRejectedValueOnce(rejectedResize())
  await dragShrink(await grip())

  expect(updateFrame).toHaveBeenCalledTimes(1)
  expect(updateFrame).toHaveBeenCalledWith('zoned', expect.objectContaining({ width: 1080, height: 880 }))
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'zoned')).toMatchObject({
    width: 1080,
    height: 1080,
    safeZoneOverride: ZONE,
  })
  expect(useStore.getState().notice?.text).toMatch(/Safe-Zone/)

  /* no history entry was recorded: undo issues no further write */
  await act(async () => {
    await history.undo()
  })
  expect(updateFrame).toHaveBeenCalledTimes(1)
})

it('successful drag-resize still applies locally and records undo history', async () => {
  updateFrame.mockResolvedValueOnce({ ...zoned, width: 1080, height: 880 })
  await dragShrink(await grip())

  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'zoned')).toMatchObject({ height: 880 })
  await act(async () => {
    await history.undo()
  })
  expect(updateFrame).toHaveBeenCalledWith('zoned', expect.objectContaining({ height: 1080 }))
})
