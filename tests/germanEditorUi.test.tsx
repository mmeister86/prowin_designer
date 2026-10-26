// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Canvas } from '../shared/types'
import { Board } from '../src/components/Board'
import { MemoryPanel } from '../src/components/MemoryPanel'
import { useStore } from '../src/lib/store'

vi.mock('../src/components/TeamAllowance', () => ({
  useAllowance: () => ({ allowance: null, refresh: vi.fn() }),
  MeterLine: () => null,
  isResidentLimit: () => false,
}))

let container: HTMLDivElement
let root: Root
beforeEach(() => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  useStore.setState({ canvas: { id: 'c', frames: [] } as unknown as Canvas, tasks: [], decisions: [], proposals: [] })
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('shows German board columns and resolves legacy agent names without rewriting task text', () => {
  useStore.setState({
    tasks: [
      {
        id: 't',
        agentName: 'Copywriter',
        status: 'Keep this agent status in English',
        color: '#000000',
        startedAt: 1,
      },
    ],
  })
  act(() => root.render(<Board canvasId="c" />))
  for (const text of ['Das Team', 'In der Warteschlange', 'In Arbeit', 'Erledigt', '+ Neue Karte']) {
    expect(container.textContent).toContain(text)
  }
  expect(container.querySelector('[title="Karte für Text einreihen"]')?.textContent).toContain(
    'Keep this agent status in English',
  )
})

it('shows German design knowledge guidance while retaining saved reference titles', () => {
  act(() => root.render(<MemoryPanel />))
  expect(container.textContent).toContain('Im Designwissen merkt sich diese Arbeitsfläche Deinen Geschmack')
  expect(container.textContent).toContain('Referenzen')
  expect(container.textContent).toContain('Regeln')
  act(() =>
    useStore.setState({
      canvas: {
        id: 'c',
        frames: [],
        references: [
          {
            id: 'r',
            title: 'My English reference',
            html: '<p>Keep me</p>',
            width: 100,
            height: 100,
            pinnedAt: 1,
            pinnedBy: 'Ada',
          },
        ],
      } as unknown as Canvas,
    }),
  )
  expect(container.textContent).toContain('My English reference')
})
