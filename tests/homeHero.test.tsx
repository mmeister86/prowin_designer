// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
vi.mock('../src/components/ModelPicker', () => ({ ModelPicker: () => null }))
import { HomeHero } from '../src/components/HomeHero'

it('keeps the composer and agent connection without offering removed import sources', () => {
  const html = renderToStaticMarkup(
    <HomeHero
      busy={false}
      focusAt={0}
      actions={{ onPrompt: vi.fn(), onConnectAgents: vi.fn(), onAutomations: vi.fn() }}
    />,
  )
  expect(html).toContain('Connect your agents')
  expect(html).toContain('<textarea')
  expect(html).not.toContain('Import a design')
  expect(html).not.toContain('>Files<')
  expect(html).not.toContain('Run an automation')
})
