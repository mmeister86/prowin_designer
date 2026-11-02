// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

const permissions = vi.hoisted(() => ({ manageLocks: false }))
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
const { FrameView } = await import('../src/components/FrameView')
const { TooltipProvider } = await import('../src/components/ui/tooltip')
const { useStore } = await import('../src/lib/store')
const { api } = await import('../src/lib/api')
const { clearHistory } = await import('../src/lib/history')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const preset: Frame = {
  id: 'preset',
  canvasId: 'c',
  name: 'Story',
  preset: 'ig-story',
  x: 0,
  y: 0,
  width: 900,
  height: 1700,
  html: '',
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'Me',
}
const free: Frame = { ...preset, id: 'free', name: 'Free', preset: undefined, x: 1000, width: 640, height: 480 }
let root: Root
let container: HTMLDivElement
beforeEach(() => {
  permissions.manageLocks = false
  vi.clearAllMocks()
  clearHistory()
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [preset, free] } as Canvas)
  useStore.setState({ selectedIds: ['preset', 'free'], selectedId: 'preset', tool: 'select', panMode: false })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})
async function inspector(frame = preset) {
  await act(async () =>
    root.render(
      <TooltipProvider>
        <Inspector frame={frame} />
      </TooltipProvider>,
    ),
  )
  return container.querySelector<HTMLInputElement>('[aria-label="Breite"]')!
}
async function views() {
  await act(async () =>
    root.render(
      <TooltipProvider>
        {[preset, free].map((frame) => (
          <FrameView key={frame.id} frame={frame} layoutZoom={1} />
        ))}
      </TooltipProvider>,
    ),
  )
}
const grip = (name: string) =>
  container
    .querySelector(`iframe[title="${name}"]`)!
    .parentElement!.parentElement!.querySelector<HTMLElement>('.cursor-nwse-resize')
async function drag(el: HTMLElement, modifiers: PointerEventInit = {}) {
  await act(async () => {
    el.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 0, clientY: 0, ...modifiers }),
    )
    window.dispatchEvent(
      new PointerEvent('pointermove', { pointerId: 1, clientX: 100, clientY: 100, altKey: true, ...modifiers }),
    )
    window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1 }))
  })
}

it('shows the preset label, disables size but leaves position editable for non-Creators', async () => {
  expect((await inspector()).disabled).toBe(true)
  expect(container.querySelector<HTMLInputElement>('[aria-label="Höhe"]')!.disabled).toBe(true)
  expect(container.querySelector<HTMLInputElement>('[aria-label="X-Position"]')!.disabled).toBe(false)
  expect(container.textContent).toContain('Instagram Story')
})

it.each([true, false])('keeps Creator preset / legacy sizing usable (Creator=%s)', async (creator) => {
  permissions.manageLocks = creator
  const input = await inspector(creator ? preset : free)
  expect(input.disabled).toBe(false)
  await act(async () => {
    input.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '800')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => input.blur())
  expect(api.updateFrame).toHaveBeenCalledWith(creator ? 'preset' : 'free', { width: 800 })
})

it('protects a preset in a mixed selection while leaving legacy resize and group movement usable', async () => {
  await views()
  expect(grip('Story')).toBeNull()
  expect(grip('Free')).not.toBeNull()
  await drag(grip('Free')!)
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'preset')).toMatchObject({ width: 900, height: 1700 })
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'free')).toMatchObject({ width: 740, height: 580 })
  const surface = container.querySelector('iframe[title="Story"]')!.parentElement!
  await drag(surface)
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'preset')).toMatchObject({
    x: 100,
    y: 100,
    width: 900,
    height: 1700,
  })
})

it('lets Creators resize preset frames', async () => {
  permissions.manageLocks = true
  await views()
  await drag(grip('Story')!)
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'preset')).toMatchObject({
    width: 1000,
    height: 1800,
    preset: 'ig-story',
  })
})

it('carries preset identity, actual dimensions and provenance on Alt-Shift drag copies', async () => {
  await views()
  await drag(container.querySelector('iframe[title="Story"]')!.parentElement!, { altKey: true, shiftKey: true })
  expect(api.createFrame).toHaveBeenCalledWith(
    'c',
    expect.objectContaining({ preset: 'ig-story', width: 900, height: 1700, sourceFrameId: 'preset' }),
  )
})
