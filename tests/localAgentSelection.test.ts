import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ save: vi.fn(), status: vi.fn(), changed: vi.fn() }))
vi.mock('../src/lib/api', () => ({
  api: { setLocalAgent: mocks.save, localAgent: mocks.status },
  ApiError: class extends Error {},
}))
vi.mock('../src/lib/store', () => ({ useStore: { getState: () => ({ allowanceChanged: mocks.changed }) } }))
import { refreshLocalAgent, selectLocalAgent, useLocalAgent } from '../src/lib/localAgent'
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllGlobals()
  useLocalAgent.setState({ preference: null, native: null, running: false, progress: '', error: '' })
})
it('publishes the server preference even when native status rejects', async () => {
  const preference = { enabled: true, model: 'claude-opus-5' } as const
  const error = new Error('CLI unavailable')
  vi.stubGlobal('__DOOP_CLAUDE_CLI__', true)
  vi.stubGlobal('__TAURI__', { core: { invoke: vi.fn().mockRejectedValue(error) } })
  mocks.status.mockResolvedValue(preference)

  await expect(refreshLocalAgent('alice')).rejects.toBe(error)

  expect(useLocalAgent.getState().preference).toEqual(preference)
  expect(useLocalAgent.getState().native).toBeNull()
})

it('publishes the server preference while native status is still pending', async () => {
  const preference = { enabled: true, model: 'claude-opus-5' } as const
  const native = { installed: true, connected: true, enabled: true }
  let resolveStatus!: (value: typeof native) => void
  const pendingStatus = new Promise<typeof native>((resolve) => {
    resolveStatus = resolve
  })
  vi.stubGlobal('__DOOP_CLAUDE_CLI__', true)
  vi.stubGlobal('__TAURI__', { core: { invoke: vi.fn().mockReturnValue(pendingStatus) } })
  mocks.status.mockResolvedValue(preference)
  let settled = false
  const refresh = refreshLocalAgent('alice').finally(() => {
    settled = true
  })

  try {
    // Allow the already-resolved server read to publish without resolving the CLI.
    await vi.waitFor(() => expect(useLocalAgent.getState().preference).toEqual(preference))
    expect(useLocalAgent.getState().native).toBeNull()
    expect(settled).toBe(false)
  } finally {
    resolveStatus(native)
    await refresh
  }
  expect(useLocalAgent.getState().native).toEqual(native)
})

it.each([null, { enabled: true, model: 'claude-opus-5' }] as const)(
  'preserves preference %j when the server read rejects',
  async (previous) => {
    useLocalAgent.setState({ preference: previous })
    vi.stubGlobal('__DOOP_CLAUDE_CLI__', true)
    vi.stubGlobal('__TAURI__', {
      core: { invoke: vi.fn().mockResolvedValue({ installed: true, connected: true, enabled: false }) },
    })
    const error = new Error('Server unavailable')
    mocks.status.mockRejectedValue(error)

    await expect(refreshLocalAgent('alice')).rejects.toBe(error)

    expect(useLocalAgent.getState().preference).toEqual(previous)
    expect(useLocalAgent.getState().native).toBeNull()
  },
)

it('selects the server without depending on native CLI status', async () => {
  const invoke = vi.fn().mockRejectedValue(new Error('CLI unavailable'))
  vi.stubGlobal('__DOOP_CLAUDE_CLI__', true)
  vi.stubGlobal('__TAURI__', { core: { invoke } })
  useLocalAgent.setState({ preference: { enabled: true, model: 'claude-opus-5' } })
  const saved = { enabled: false, model: 'claude-opus-5' } as const
  mocks.save.mockResolvedValue(saved)
  await selectLocalAgent('alice', saved)
  expect(useLocalAgent.getState().preference).toEqual(saved)
  expect(invoke).not.toHaveBeenCalled()
  expect(mocks.status).not.toHaveBeenCalled()
  expect(mocks.changed).toHaveBeenCalledOnce()
})
it('preserves local routing state when the server rejects the switch', async () => {
  const previous = { enabled: true, model: 'claude-opus-5' } as const
  useLocalAgent.setState({ preference: previous })
  mocks.save.mockRejectedValue(new Error('Network failure'))
  await expect(selectLocalAgent('alice', { ...previous, enabled: false })).rejects.toThrow('Network failure')
  expect(useLocalAgent.getState().preference).toEqual(previous)
  expect(mocks.changed).not.toHaveBeenCalled()
})
