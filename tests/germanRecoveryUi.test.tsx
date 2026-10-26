// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import type { Canvas } from '../shared/types'
import { FrameThumb } from '../src/components/FramePreview'
import { ActivityPanel } from '../src/components/ActivityPanel'
import { PanelTabButtons } from '../src/components/SideRail'
import { TooltipProvider } from '../src/components/ui/tooltip'
import { useStore } from '../src/lib/store'

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('shows Leer for the default small thumbnail and keeps preview failures distinct', () => {
  act(() => root.render(<FrameThumb />))
  expect(container.textContent).toBe('Leer')
  act(() => root.render(<FrameThumb frameId="f" />))
  act(() => container.querySelector('img')!.dispatchEvent(new Event('error')))
  expect(container.textContent).toBe('Vorschau nicht verfügbar')
})

it('formats both comment tooltip counts in German while preserving the badge cap', () => {
  useStore.setState({
    canvas: { id: 'c', frames: [], pages: [{ id: 'p', name: 'Page' }] } as unknown as Canvas,
    activePageId: 'p',
    panelTab: 'activity',
    tasks: [],
    activity: [],
    proposals: [],
    comments: Array.from({ length: 1234 }, (_, i) => ({
      id: String(i),
      canvasId: 'c',
      pageId: 'p',
      x: 0,
      y: 0,
      selector: '',
      snippet: '',
      from: 'Ada',
      text: 'Keep my text',
      at: i,
    })),
  })
  act(() =>
    root.render(
      <TooltipProvider>
        <ActivityPanel canvasId="c" onClose={() => {}} />
        <PanelTabButtons onOpen={() => {}} />
      </TooltipProvider>,
    ),
  )
  const commentsTab = container.querySelector('[data-slot="panel-icon-tab"][title^="Kommentare"]')
  expect(commentsTab?.getAttribute('title')).toBe('Kommentare · 1.234 offen')
  expect(commentsTab?.textContent).toContain('99+')
  expect(container.querySelector('[aria-label="Kommentare · 1.234 offen"]')).not.toBeNull()
})
