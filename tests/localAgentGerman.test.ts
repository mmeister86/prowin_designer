// @vitest-environment happy-dom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import type { LocalAgentJob, LocalAgentResult } from '../shared/localAgent'

const mocks = vi.hoisted(() => ({
  localAgent: vi.fn(),
  pollLocalAgent: vi.fn(),
  finishLocalAgent: vi.fn(),
}))
vi.mock('../src/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/api')>()),
  api: mocks,
}))
vi.mock('../src/lib/auth', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/auth')>()),
  authClient: { useSession: () => ({ data: { user: { id: 'user' } } }) },
}))
const { invokeClaude, startLocalAgent, useLocalAgent } = await import('../src/lib/localAgent')
const { LocalClaudeRow } = await import('../src/components/LocalClaude')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let stop: (() => void) | undefined
afterEach(() => {
  stop?.()
  stop = undefined
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

it('uses a German app fallback when local Claude is unavailable', async () => {
  vi.stubGlobal('__DOOP_CLAUDE_CLI__', false)
  await expect(invokeClaude('claude_status')).rejects.toThrow(
    'Aktualisiere die Doop-Desktop-App, um Claude lokal zu verwenden.',
  )
})

it.each([
  { success: true, text: 'CLI result: not authenticated — keep these diagnostic details.' },
  { success: false, text: 'Custom CLI result: please keep these English details.' },
  {
    rejection: 'Permission denied (os error 13)',
    text: 'Claude konnte die Aufgabe auf diesem Gerät nicht ausführen. Prüfe Deine CLI-Installation und Dateiberechtigungen und versuche es erneut.',
  },
  {
    rejection: new Error('internal secret'),
    text: 'Claude konnte die Aufgabe auf diesem Gerät nicht ausführen. Prüfe Deine CLI-Installation und Dateiberechtigungen und versuche es erneut.',
  },
  {
    rejection: 'Verbinde zuerst Claude auf diesem Gerät',
    text: 'Verbinde zuerst Claude auf diesem Gerät und versuche es erneut.',
  },
  {
    rejection: 'Die Claude-Ausgabe konnte nicht gelesen werden: secret path',
    text: 'Die Claude-Ausgabe konnte nicht gelesen werden. Prüfe Deine CLI-Installation und versuche es erneut.',
  },
  {
    rejection:
      'Die Claude-Ausgabe hat die Zeilengrenze von 2 MB überschritten. Der Lauf wurde gestoppt. Versuche es mit einem kleineren Tool-Ergebnis erneut.',
    text: 'Die Claude-Ausgabe hat die Zeilengrenze von 2 MB überschritten. Der Lauf wurde gestoppt. Versuche es mit einem kleineren Tool-Ergebnis erneut.',
  },
])('separates IPC rejection from returned CLI content: %j', async (scenario) => {
  vi.useFakeTimers()
  const result: LocalAgentResult = { success: scenario.success ?? false, text: scenario.text }
  const job: LocalAgentJob = {
    id: 'job',
    token: 'token',
    prompt: 'User prompt',
    system: 'System',
    model: 'default',
    maxTurns: 10,
  }
  const native = { installed: true, connected: true, enabled: true }
  mocks.localAgent.mockResolvedValue({ enabled: true, model: 'default' })
  mocks.pollLocalAgent.mockResolvedValue({ enabled: true, job: null }).mockResolvedValueOnce({ enabled: true, job })
  mocks.finishLocalAgent.mockResolvedValue(undefined)
  vi.stubGlobal('__DOOP_CLAUDE_CLI__', true)
  vi.stubGlobal('__TAURI__', {
    core: {
      invoke: vi.fn(async (command: string) => {
        if (command === 'claude_status') return native
        if (command === 'claude_run') {
          if ('rejection' in scenario) throw scenario.rejection
          return { ...result }
        }
      }),
    },
    event: { listen: vi.fn(async () => () => {}) },
  })
  stop = startLocalAgent('user')
  await vi.advanceTimersByTimeAsync(6000)
  expect(useLocalAgent.getState()).toMatchObject({
    running: false,
    progress: result.text,
    error: result.success ? '' : result.text,
  })
  expect(mocks.finishLocalAgent).toHaveBeenCalledWith('job', expect.any(String), result)
  vi.stubGlobal('__DOOP_DESKTOP__', '0.4.0')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(createElement(LocalClaudeRow)))
    if (!result.success) {
      await act(async () =>
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent?.includes('Letzte Aufgabe fehlgeschlagen'))!
          .click(),
      )
      expect(container.querySelector('pre[aria-live="polite"]')?.textContent).toBe(result.text)
    }
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
