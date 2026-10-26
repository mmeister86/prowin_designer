// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(),
  refresh: vi.fn(),
  canInstall: true,
  native: { installed: false, connected: false, enabled: false },
  runnerError: '',
}))
vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'tester' } } }) } }))
vi.mock('../src/lib/api', async (original) => ({ ...(await original<typeof import('../src/lib/api')>()), api: {} }))
vi.mock('../src/lib/shell', () => ({ isDesktopShell: () => true }))
vi.mock('../src/lib/localAgent', () => ({
  hasLocalClaude: () => true,
  canInstallClaude: () => mocks.canInstall,
  invokeClaude: mocks.invoke,
  refreshLocalAgent: mocks.refresh,
  disconnectLocalAgent: vi.fn(),
  selectLocalAgent: vi.fn(),
  useLocalAgent: () => ({
    preference: null,
    native: mocks.native,
    running: false,
    progress: mocks.runnerError,
    error: mocks.runnerError,
  }),
}))
import { LocalClaudeRow } from '../src/components/LocalClaude'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let container: HTMLDivElement
const button = (label: string) => Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.canInstall = true
  mocks.runnerError = ''
  mocks.native = { installed: false, connected: false, enabled: false }
  mocks.refresh.mockResolvedValue(undefined)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<LocalClaudeRow />))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('shows progress, prevents duplicate clicks, and refreshes into sign-in after installation', async () => {
  let finish!: () => void
  mocks.invoke.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  await act(async () => button('Claude Code installieren')!.click())
  expect(button('Wird installiert…')?.disabled).toBe(true)
  expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('claude_install')
  mocks.native.installed = true
  await act(async () => finish())
  expect(mocks.refresh).toHaveBeenLastCalledWith('tester')
  expect(button('Anmelden')).toBeDefined()
  expect(button('Claude Code installieren')).toBeUndefined()
})

it('shows installer errors and allows retry', async () => {
  mocks.invoke.mockRejectedValue(new Error('Installation failed'))
  await act(async () => button('Claude Code installieren')!.click())
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    'Die Installation ist fehlgeschlagen. Prüfe Deine Internetverbindung oder nutze die Installationsanleitung.',
  )
  expect(button('Claude Code installieren')?.disabled).toBe(false)
})

it('keeps the guide fallback for older shells', async () => {
  mocks.canInstall = false
  await act(async () => root.render(<LocalClaudeRow />))
  expect(button('Claude Code installieren')).toBeUndefined()
  expect(container.querySelector('a')?.textContent).toBe('Installationsanleitung')
})

it.each([
  'Sign-in did not complete. Run claude auth login in your terminal, then Refresh.',
  'Die Anmeldung wurde nicht abgeschlossen. Führe claude auth login im Terminal aus und klicke anschließend auf Aktualisieren.',
])('retains terminal login recovery for native message %s', async (message) => {
  mocks.native.installed = true
  await act(async () => root.render(<LocalClaudeRow />))
  mocks.invoke.mockRejectedValue(message)
  await act(async () => button('Anmelden')!.click())
  expect(mocks.invoke).toHaveBeenCalledWith('claude_login')
  const alert = container.querySelector('[role="alert"]')?.textContent
  expect(alert).toContain('claude auth login')
  expect(alert).toContain('Terminal')
  expect(alert).toContain('Aktualisieren')
  expect(button('Aktualisieren')).toBeDefined()
})

it.each([
  ['Installation did not finish in time. Refresh to check, or use the installation guide.', 'Zeit', 'Aktualisieren'],
  [
    'Die Installation wurde nicht rechtzeitig abgeschlossen. Klicke zum Prüfen auf Aktualisieren oder nutze die Installationsanleitung.',
    'Zeit',
    'Aktualisieren',
  ],
  ['Could not start the installer: permission denied', 'gestartet', 'Installationsanleitung'],
  ['Das Installationsprogramm konnte nicht gestartet werden: permission denied', 'gestartet', 'Installationsanleitung'],
  ['Claude Code was installed but could not start. See the installation guide.', 'starten', 'Installationsanleitung'],
  [
    'Claude Code wurde installiert, konnte aber nicht gestartet werden. Sieh in der Installationsanleitung nach.',
    'starten',
    'Installationsanleitung',
  ],
  [
    'Die Installation ist fehlgeschlagen. Prüfe Deine Internetverbindung oder nutze die Installationsanleitung.',
    'Internetverbindung',
    'Installationsanleitung',
  ],
  ['Claude Code installation is already running.', 'bereits', 'Aktualisieren'],
  ['Die Installation von Claude Code läuft bereits.', 'bereits', 'Aktualisieren'],
  ['Installation cancelled.', 'abgebrochen', 'erneut'],
  ['Die Installation wurde abgebrochen.', 'abgebrochen', 'erneut'],
])('keeps actionable installer recovery for %s', async (message, reason, recovery) => {
  mocks.invoke.mockRejectedValue(new Error(message))
  await act(async () => button('Claude Code installieren')!.click())
  const alert = container.querySelector('[role="alert"]')?.textContent
  expect(alert).toContain(reason)
  expect(alert).toContain(recovery)
  expect(alert).not.toContain('permission denied')
  expect(mocks.invoke).toHaveBeenCalledWith('claude_install')
  expect(button('Claude Code installieren')?.disabled).toBe(false)
})

it('uses a safe actionable fallback for unknown native action errors', async () => {
  mocks.invoke.mockRejectedValue('unknown internal path /private/token')
  await act(async () => button('Claude Code installieren')!.click())
  expect(container.querySelector('[role="alert"]')?.textContent).toBe(
    'Die Aktion konnte nicht abgeschlossen werden. Versuche es erneut.',
  )
})

it.each([
  'Mein individuelles Ergebnis: Kontingent erschöpft; Anmeldung am Montag erneuern.',
  'Custom CLI result: upgrade CLI 2.0 and check usage limits.',
])('preserves actual failed agent result details: %s', async (result) => {
  mocks.runnerError = result
  await act(async () => root.render(<LocalClaudeRow />))
  await act(async () => container.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!.click())
  expect(container.querySelector('pre')?.textContent).toBe(result)
})

it.each([
  [
    'Claude did not complete the task. Check your login and usage limits, then retry.',
    'Prüfe Deine Anmeldung und Nutzungslimits',
  ],
  [
    'Claude hat die Aufgabe nicht abgeschlossen. Prüfe Deine Anmeldung und Nutzungslimits und versuche es erneut.',
    'Prüfe Deine Anmeldung und Nutzungslimits',
  ],
  [
    'Claude exited without a result. Check your CLI login and version, then retry.',
    'Prüfe Deine CLI-Anmeldung und -Version',
  ],
  [
    'Claude wurde ohne Ergebnis beendet. Prüfe Deine CLI-Anmeldung und -Version und versuche es erneut.',
    'Prüfe Deine CLI-Anmeldung und -Version',
  ],
])('shows German recovery for known native runner fallback %s', async (message, recovery) => {
  mocks.runnerError = message
  await act(async () => root.render(<LocalClaudeRow />))
  await act(async () => container.querySelector<HTMLButtonElement>('[data-slot="collapsible-trigger"]')!.click())
  expect(container.querySelector('pre')?.textContent).toContain(recovery)
})
