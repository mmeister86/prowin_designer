// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), native: false, addToDesktop: vi.fn() }))
vi.mock('../src/lib/claudeConnection', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/claudeConnection')>()),
  canAddToClaudeDesktop: () => mocks.native,
  addToClaudeDesktop: mocks.addToDesktop,
}))
vi.mock('../src/App', () => ({ navigate: mocks.navigate }))
vi.mock('../src/lib/store', () => ({
  useStore: (select: (s: { presences: Record<string, never> }) => unknown) => select({ presences: {} }),
}))
import { ConnectModal } from '../src/components/ConnectModal'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
const onClose = vi.fn()
const buttons = () => Array.from(document.body.querySelectorAll('button'))
const button = (label: string) => buttons().find((b) => b.textContent?.trim() === label)
const click = (label: string) =>
  act(async () => {
    const b = button(label)
    if (!b) throw new Error(`no button "${label}"`)
    b.click()
  })
const pickCard = (name: string) =>
  act(async () => {
    buttons()
      .find((b) => b.getAttribute('aria-pressed') !== null && b.textContent?.includes(name))!
      .click()
  })
const text = () => document.body.textContent ?? ''

const mount = async (canvasId?: string) => {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<ConnectModal canvasId={canvasId} onClose={onClose} />))
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.native = false
  vi.stubGlobal('location', new URL('http://localhost:4301'))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

it('opens on the agent picker and walks to an agent’s own steps and back', async () => {
  await mount('c1')
  expect(text()).toContain('Wähle Deinen Agenten')
  expect(text()).not.toContain('Connect your plan')
  expect(button('Verbinden')).toBeDefined()

  await pickCard('Codex')
  await click('Verbinden')
  expect(text()).toContain('Verbinden Codex')
  expect(text()).toContain(`codex mcp add doop --url ${location.origin}/mcp`)
  expect(text()).toContain('Arbeite auf der Doop-Arbeitsfläche c1.')
  expect(text()).toContain('Warte auf Codex')

  await click('Zurück')
  expect(text()).toContain('Wähle Deinen Agenten')
})

it('defaults to Claude Code and shows its command plus the sign-in step', async () => {
  await mount('c1')
  await click('Verbinden')
  expect(text()).toContain('Verbinden Claude Code')
  expect(text()).toContain(`claude mcp add --transport http doop "${location.origin}/mcp"`)
  expect(text()).toContain(
    'Gib in Claude Code /mcp ein, wähle doop und dann Authentifizieren. Ein Browser-Tab öffnet sich, in dem Du die Verbindung genehmigen kannst.',
  )
  await click('Fertig')
  expect(onClose).toHaveBeenCalledOnce()
})

it('offers general MCP clients without a ChatGPT app connector', async () => {
  await mount('c1')
  expect(buttons().some((b) => b.textContent?.includes('Connect in your browser'))).toBe(false)
  await pickCard('Anderer MCP-Client')
  await click('Verbinden')
  expect(text()).toContain(`${location.origin}/mcp`)
})

it('keeps the headless agent-key path on the generic MCP screen and returns to the canvas from Settings', async () => {
  await mount('c1')
  await pickCard('Anderer MCP-Client')
  await click('Verbinden')
  expect(text()).toContain('"mcpServers"')
  await click('Einstellungen → Agentenschlüssel')
  expect(mocks.navigate).toHaveBeenCalledWith('/settings?pane=keys&from=%2Fc%2Fc1')
})

it('skips the canvas prompt and the arrival status when opened without a canvas', async () => {
  await mount()
  await click('Verbinden')
  expect(text()).not.toContain('Arbeite auf der Doop-Arbeitsfläche')
  expect(text()).not.toContain('Warte auf')
  expect(text()).toContain('Öffne eine Arbeitsfläche und bitte den Agenten, darauf zu arbeiten')
})

it('explains the local desktop path and keeps file installation as a collapsed fallback', async () => {
  await mount('desktop-canvas')
  await pickCard('Doop zu Claude hinzufügen')
  await click('Verbinden')
  expect(button('Desktop-App')?.getAttribute('aria-pressed')).toBe('true')
  const download = document.querySelector<HTMLAnchorElement>('a[download="doop.mcpb"]')
  expect(download?.getAttribute('href')).toBe('/claude-extension/doop.mcpb')
  expect(download?.closest('[data-slot="disclosure"] > [data-state]')?.getAttribute('data-state')).toBe('closed')
  expect(text()).toContain('Doop-Server-URL')
  expect(text()).toContain(`${location.origin}/mcp`)
  expect(text()).toContain('Arbeite auf der Doop-Arbeitsfläche desktop-canvas.')
  expect(text()).toContain('Erweiterung installieren')

  await click('Online verbinden')
  expect(document.querySelector('a[download]')).toBeNull()
  expect(text()).toContain('öffentlich erreichbaren HTTPS-Server')
  expect(document.querySelector('a[href*="claude.ai"]')).toBeNull()
  await click('Desktop-App')
  expect(document.querySelector('a[download="doop.mcpb"]')).not.toBeNull()
})

it('defaults to a prefilled Add to Claude link on hosted Doop, without a download', async () => {
  vi.stubGlobal('location', new URL('https://design.example.com'))
  await mount('hosted-canvas')
  await pickCard('Doop zu Claude hinzufügen')
  await click('Verbinden')
  expect(button('Online verbinden')?.getAttribute('aria-pressed')).toBe('true')
  const link = document.querySelector<HTMLAnchorElement>('a[href*="claude.ai"]')!
  const url = new URL(link.href)
  expect(link.textContent).toBe('Zu Claude hinzufügen')
  expect(url.searchParams.get('modal')).toBe('add-custom-connector')
  expect(url.searchParams.get('connectorUrl')).toBe('https://design.example.com/mcp')
  expect(document.querySelector('a[download]')).toBeNull()
  expect(text()).toContain('Arbeite auf der Doop-Arbeitsfläche hosted-canvas.')
})

it('opens Claude directly in a capable shell and waits for Claude’s confirmation', async () => {
  mocks.native = true
  let finish!: () => void
  mocks.addToDesktop.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  await mount('local-canvas')
  await pickCard('Doop zu Claude hinzufügen')
  await click('Verbinden')
  await click('Zu Claude hinzufügen')
  expect(button('Claude wird geöffnet…')?.disabled).toBe(true)
  expect(mocks.addToDesktop).toHaveBeenCalledExactlyOnceWith('http://localhost:4301/mcp')
  await act(async () => finish())
  expect(text()).toContain('Bestätige die Installation in Claude')
  expect(text()).not.toContain('ist da — es hat geklappt')
})

it('shows native handoff errors and allows retry', async () => {
  mocks.native = true
  mocks.addToDesktop.mockRejectedValue(new Error('Install Claude Desktop first.'))
  await mount()
  await pickCard('Doop zu Claude hinzufügen')
  await click('Verbinden')
  await click('Zu Claude hinzufügen')
  expect(document.querySelector('[role="alert"]')?.textContent).toBe(
    'Claude konnte nicht geöffnet werden. Prüfe, ob Claude Desktop installiert ist, und versuche es erneut.',
  )
  expect(button('Zu Claude hinzufügen')?.disabled).toBe(false)
})

// Decode the actual rendered install link to catch a wrong config envelope or endpoint.
it.each(['https://doop.design', 'http://localhost:4301'])(
  'offers an Add to Cursor link for %s with a manual fallback and canvas prompt',
  async (origin) => {
    vi.stubGlobal('location', new URL(origin))
    await mount('cursor-canvas')
    await pickCard('Cursor')
    await click('Verbinden')

    const link = Array.from(document.body.querySelectorAll('a')).find((a) => a.textContent === 'Zu Cursor hinzufügen')!
    const installUrl = new URL(link.href)
    expect(installUrl.protocol).toBe('cursor:')
    expect(installUrl.host).toBe('anysphere.cursor-deeplink')
    expect(installUrl.pathname).toBe('/mcp/install')
    expect(installUrl.searchParams.get('name')).toBe('doop')
    expect(JSON.parse(atob(installUrl.searchParams.get('config')!))).toEqual({ url: `${origin}/mcp` })
    expect(document.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute('aria-expanded')).toBe('false')
    expect(text()).toContain('behalte bestehende Server bei')
    expect(text()).toContain('Arbeite auf der Doop-Arbeitsfläche cursor-canvas.')
    expect(text()).toContain('Warte auf Cursor')
    expect(text()).not.toContain('es hat geklappt')
    expect(document.querySelector('a[download]')).toBeNull()
  },
)
