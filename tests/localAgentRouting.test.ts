import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('../server/prowin/accounts.ts', () => ({ permissionIdentity: async () => ({ creator: true }) }))
const mocks = vi.hoisted(() => ({ preference: vi.fn(), account: vi.fn(), online: vi.fn() }))
vi.mock('../server/localAgentPreferences.ts', () => ({ getLocalAgentPreference: mocks.preference }))
vi.mock('../server/localAgentRuns.ts', () => ({ localAgentRuns: { online: mocks.online, start: vi.fn() } }))
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import { pickModel } from '../server/agentModel.ts'

afterEach(() => {
  vi.clearAllMocks()
  unstubAllEnvs()
})
describe('local provider routing', () => {
  it('selects the local harness even if a legacy cloud pilot setting is present', async () => {
    vi.stubEnv(
      'DOOP_GEMINI_CLOUD_WORKERS',
      JSON.stringify({ alice: { url: 'https://worker.example', token: 'x'.repeat(32) } }),
    )
    mocks.preference.mockResolvedValue({ enabled: true, model: 'opus' })
    mocks.online.mockReturnValue(true)
    const model = await pickModel('alice')
    expect(model).toMatchObject({ provider: 'claude-local', userId: 'alice' })
    expect(model?.runHarness).toBeTypeOf('function')
    expect(mocks.account).not.toHaveBeenCalled()
  })
  it('never falls back to the connected server account when Claude is offline', async () => {
    mocks.preference.mockResolvedValue({ enabled: true, model: 'sonnet' })
    mocks.online.mockReturnValue(false)
    expect(await pickModel('alice')).toBeNull()
    expect(mocks.account).not.toHaveBeenCalled()
  })
  it('chooses the complete local harness when connected', async () => {
    mocks.preference.mockResolvedValue({ enabled: true, model: 'opus' })
    mocks.online.mockReturnValue(true)
    const model = await pickModel('alice')
    expect(model?.provider).toBe('claude-local')
    expect(model?.runHarness).toBeTypeOf('function')
    expect(mocks.account).not.toHaveBeenCalled()
  })
  it('uses the server when local execution is deselected', async () => {
    mocks.preference.mockResolvedValue({ enabled: false, model: 'default' })
    stubEnv('REQUESTY_API_KEY', 'test-server-key')
    expect((await pickModel('alice'))?.provider).toBe('requesty')
  })
})
