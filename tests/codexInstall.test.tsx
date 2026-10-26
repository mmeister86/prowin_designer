// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ navigate: vi.fn(), invoke: vi.fn() }))
vi.mock('../src/App', () => ({ navigate: mocks.navigate }))
vi.mock('../src/lib/store', () => ({
  useStore: (select: (s: { presences: Record<string, never> }) => unknown) => select({ presences: {} }),
}))
import { ConnectModal } from '../src/components/ConnectModal'
import { DesktopCodexSetup } from '../src/pages/DesktopCodexSetup'
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
const button = (label: string) =>
  Array.from(document.body.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)
const text = () => document.body.textContent ?? ''

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubGlobal('location', new URL('https://doop.design'))
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

async function mount() {
  await act(async () => root.render(<ConnectModal initialAgent="codex" canvasId="canvas-1" onClose={vi.fn()} />))
}

function native() {
  vi.stubGlobal('__DOOP_DESKTOP__', '0.4.0')
  vi.stubGlobal('__DOOP_CODEX_SETUP__', true)
  vi.stubGlobal('__TAURI__', { core: { invoke: mocks.invoke } })
}

it('opens the desktop setup from the browser and keeps the manual command available', async () => {
  await mount()
  const link = Array.from(document.body.querySelectorAll('a')).find(
    (a) => a.textContent?.trim() === 'Doop Desktop öffnen',
  )!
  expect(link.getAttribute('href')).toBe('doop://connect/codex?origin=https%3A%2F%2Fdoop.design&canvas=canvas-1')
  expect(document.querySelector('[data-slot="collapsible-trigger"]')?.getAttribute('aria-expanded')).toBe('false')
  expect(text()).toContain('codex mcp add doop --url https://doop.design/mcp')
  expect(text()).toContain('codex mcp login doop')
  expect(document.querySelector('a[download]')).toBeNull()
  expect(mocks.invoke).not.toHaveBeenCalled()
})

it('waits for successful native setup before displaying configured, without claiming agent presence', async () => {
  native()
  let finish!: () => void
  mocks.invoke.mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  await mount()
  await act(async () => button('Zu Codex hinzufügen')!.click())
  expect(button('Doop wird hinzugefügt…')?.disabled).toBe(true)
  expect(text()).not.toContain('Doop ist eingerichtet')
  await act(async () => finish())
  expect(button('Zu Codex hinzugefügt')?.disabled).toBe(true)
  expect(text()).toContain('Doop ist eingerichtet')
  expect(text()).toContain('Warte auf Codex')
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('codex_add_mcp')
})

it('shows a native config conflict and permits retry', async () => {
  native()
  mocks.invoke.mockRejectedValueOnce('Codex already has a different doop connection.')
  await mount()
  await act(async () => button('Zu Codex hinzufügen')!.click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain('andere doop-Verbindung')
  expect(text()).not.toContain('Doop ist eingerichtet')
  mocks.invoke.mockResolvedValueOnce(undefined)
  await act(async () => button('Zu Codex hinzufügen')!.click())
  expect(document.querySelector('[role="alert"]')).toBeNull()
  expect(text()).toContain('Doop ist eingerichtet')
})

it.each([
  [
    'Codex hat bereits eine andere doop-Verbindung. Benenne sie in den Codex-Einstellungen um oder entferne sie und versuche es erneut. Deine Einstellungen wurden nicht geändert.',
    'Benenne sie in den Codex-Einstellungen um oder entferne sie',
  ],
  ...[
    'Deine Codex-Konfiguration enthält kein gültiges TOML. Korrigiere sie in den Codex-Einstellungen und versuche es erneut.',
    'Your Codex config is not valid TOML. Fix it in Codex settings, then try again.',
  ].map((message) => [message, 'Korrigiere sie in den Codex-Einstellungen']),
  ...[
    'Die Einstellung mcp_servers in Deiner Codex-Konfiguration muss eine Tabelle sein. Korrigiere sie in den Codex-Einstellungen und versuche es erneut.',
    'The mcp_servers setting in your Codex config must be a table. Fix it in Codex settings, then try again.',
  ].map((message) => [message, 'mcp_servers']),
  ...[
    'Der doop-Eintrag in Deiner Codex-Konfiguration ist kein Server. Benenne ihn in den Codex-Einstellungen um oder entferne ihn und versuche es erneut.',
    'The doop entry in your Codex config is not a server. Rename or remove it in Codex settings, then try again.',
  ].map((message) => [message, 'Benenne ihn in den Codex-Einstellungen um oder entferne ihn']),
  ...[
    'Deine Codex-Konfiguration konnte nicht gelesen werden. Prüfe die Dateiberechtigungen und versuche es erneut.',
    'Could not read your Codex config. Check its file permissions and try again.',
    'Deine Codex-Konfiguration konnte nicht vorbereitet werden. Prüfe die Dateiberechtigungen.',
    'Could not prepare your Codex config. Check its file permissions.',
    'Deine Codex-Konfiguration konnte nicht ersetzt werden. Prüfe die Dateiberechtigungen und versuche es erneut.',
    'Could not replace your Codex config. Check its file permissions and try again.',
  ].map((message) => [message, 'Prüfe die Dateiberechtigungen']),
  ...[
    'CODEX_HOME muss auf ein vorhandenes Verzeichnis mit absolutem Pfad verweisen.',
    'CODEX_HOME must point to an existing absolute directory.',
  ].map((message) => [message, 'vorhandenes Verzeichnis mit absolutem Pfad']),
])('retains concrete recovery for native setup rejection %s', async (message, recovery) => {
  native()
  mocks.invoke.mockRejectedValueOnce(message)
  await mount()
  await act(async () => button('Zu Codex hinzufügen')!.click())
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(recovery)
  expect(button('Zu Codex hinzufügen')?.disabled).toBe(false)
})

it.each(['Permission denied: secret path', 'Deine Codex-Konfiguration: secret', new Error('provider secret')])(
  'hides unknown native diagnostics: %s',
  async (error) => {
    native()
    mocks.invoke.mockRejectedValueOnce(error)
    await mount()
    await act(async () => button('Zu Codex hinzufügen')!.click())
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      'Doop konnte nicht zu Codex hinzugefügt werden. Versuche es erneut oder nutze die manuelle Einrichtung.',
    )
  },
)

it('offers an update hint in older desktop shells instead of a broken command', async () => {
  vi.stubGlobal('__DOOP_DESKTOP__', '0.3.0')
  await mount()
  expect(text()).toContain('Aktualisiere Doop Desktop')
  expect(button('Zu Codex hinzufügen')).toBeUndefined()
  expect(document.querySelector('a[href^="doop:"]')).toBeNull()
  expect(mocks.invoke).not.toHaveBeenCalled()
})

it('opens a matching handoff as a review screen and requires a click to write config', async () => {
  native()
  vi.stubGlobal(
    'location',
    new URL('https://doop.design/desktop/connect/codex?origin=https%3A%2F%2Fdoop.design&canvas=from-browser'),
  )
  await act(async () => root.render(<DesktopCodexSetup />))
  expect(button('Zu Codex hinzufügen')).toBeDefined()
  expect(text()).toContain('Arbeite auf der Doop-Arbeitsfläche from-browser.')
  expect(text()).not.toContain('Warte auf')
  expect(mocks.invoke).not.toHaveBeenCalled()
  await act(async () => button('Fertig')!.click())
  expect(mocks.navigate).toHaveBeenCalledWith('/c/from-browser')
})

it('rejects a different server handoff without offering an installation button', async () => {
  native()
  vi.stubGlobal('location', new URL('https://doop.design/desktop/connect/codex?origin=http%3A%2F%2Flocalhost%3A4301'))
  await act(async () => root.render(<DesktopCodexSetup />))
  expect(text()).toContain('Öffne den passenden Doop-Server')
  expect(button('Zu Codex hinzufügen')).toBeUndefined()
  expect(mocks.invoke).not.toHaveBeenCalled()
})
