// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { AgentExecutionPanel } from '../src/components/AgentExecutionPanel'
import { meterText } from '../src/components/TeamAllowance'

const state = vi.hoisted(() => ({ creator: false, admin: false }))
vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'alice' } } }) } }))
vi.mock('../src/lib/me', () => ({ useMe: () => ({ creator: state.creator, admin: state.admin }) }))
vi.mock('../src/lib/shell', () => ({ isDesktopShell: () => false }))
vi.mock('../src/components/LocalClaude', () => ({ LocalClaudeRow: () => <div>Local Agent controls</div> }))
vi.mock('../src/lib/localAgent', () => ({
  useLocalAgent: (select: (value: unknown) => unknown) => select({ preference: { enabled: true, model: 'default' } }),
  selectLocalAgent: vi.fn(),
}))
afterEach(() => {
  state.creator = false
  state.admin = false
})

it('shows centrally managed server execution without private account controls for advisors', () => {
  const html = renderToStaticMarkup(<AgentExecutionPanel />)
  expect(html).toContain('proWIN Agent')
  expect(html).not.toContain('Local Agent controls')
  expect(html).not.toMatch(/ChatGPT|OpenAI|OpenRouter|Gemini|API key|Authorize/)
  expect(html).not.toContain('<input')
})

it.each(['creator', 'admin'] as const)('preserves independent Local Agent controls for %s', (role) => {
  state[role] = true
  const html = renderToStaticMarkup(<AgentExecutionPanel />)
  expect(html).toContain('Local Agent controls')
  expect(html).toContain('Use server agent')
})

it('offers no private subscription as a remedy for an exhausted allowance', () => {
  const text = meterText({ used: 5, limit: 5, connected: false, localAgent: false })
  expect(text).toContain('administrator')
  expect(text).not.toMatch(/connect|ChatGPT|plan/i)
})
