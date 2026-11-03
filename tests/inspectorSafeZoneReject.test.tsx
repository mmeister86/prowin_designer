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
const { Inspector } = await import('../src/components/Inspector')
const { TooltipProvider } = await import('../src/components/ui/tooltip')
const { useStore } = await import('../src/lib/store')
const { ApiError } = await import('../src/lib/api')
const { api } = await import('../src/lib/api')
const history = await import('../src/lib/history')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const ZONE = { top: 500, right: 0, bottom: 500, left: 0 }
const framed: Frame = {
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
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...framed }] } as Canvas)
  useStore.setState({ notice: null })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function heightInput() {
  await act(async () =>
    root.render(
      <TooltipProvider>
        <Inspector frame={{ ...framed }} />
      </TooltipProvider>,
    ),
  )
  return container.querySelector<HTMLInputElement>('[aria-label="Höhe"]')!
}

async function commitHeight(input: HTMLInputElement, value: string) {
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => {
    input.blur()
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

it('rejected resize leaves local geometry, override and undo stack intact with a German notice', async () => {
  updateFrame.mockRejectedValueOnce(rejectedResize())
  const input = await heightInput()
  await commitHeight(input, '900')

  expect(updateFrame).toHaveBeenCalledTimes(1)
  expect(updateFrame).toHaveBeenCalledWith('zoned', { height: 900 })
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

it('successful resize still applies locally and records undo history', async () => {
  updateFrame.mockResolvedValueOnce({ ...framed, height: 900 })
  const input = await heightInput()
  await commitHeight(input, '900')

  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'zoned')).toMatchObject({ height: 900 })
  await act(async () => {
    await history.undo()
  })
  expect(updateFrame).toHaveBeenCalledWith('zoned', { height: 1080 })
})
