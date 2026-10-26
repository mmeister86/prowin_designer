// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'
import { Inspector } from '../src/components/Inspector'
import { useStore } from '../src/lib/store'
import { TooltipProvider } from '../src/components/ui/tooltip'

vi.mock('../src/prowin/canvasPermissions', () => ({ useCanvasCapabilities: () => ({ manageLocks: true }) }))
vi.mock('../src/lib/api', () => ({ api: { updateFrame: vi.fn(async () => ({})) } }))

it('shows German saving and saved messages while retaining the technical save states', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers()
  localStorage.setItem('doop:inspector-html', '1')
  const frame: Frame = {
    id: 'f',
    canvasId: 'c',
    name: 'My English name',
    html: '<p>Original</p>',
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    createdAt: 0,
    updatedAt: 0,
    updatedBy: 'Ada',
  }
  useStore.setState({ canvas: { id: 'c', frames: [frame] } as Canvas })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () =>
      root.render(
        <TooltipProvider>
          <Inspector frame={frame} />
        </TooltipProvider>,
      ),
    )
    const input = container.querySelector('textarea')!
    input.focus()
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, '<p>My custom text</p>')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(container.querySelector('footer')?.textContent).toContain('Wird gespeichert…')
    await act(async () => vi.advanceTimersByTimeAsync(700))
    expect(container.querySelector('footer')?.textContent).toContain('Gespeichert')
    expect(input.value).toBe('<p>My custom text</p>')
  } finally {
    act(() => root.unmount())
    container.remove()
    localStorage.removeItem('doop:inspector-html')
    vi.useRealTimers()
  }
})
