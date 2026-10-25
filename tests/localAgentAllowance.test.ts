import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import { residentUsage } from '../server/db/schema.ts'
import { getAllowance, consumeResidentTask } from '../server/allowance.ts'
import { pickModel } from '../server/agentModel.ts'

const state = vi.hoisted(() => ({ creator: false, enabled: true, online: true, insert: vi.fn() }))
vi.mock('../server/prowin/accounts.ts', () => ({ permissionIdentity: async () => ({ creator: state.creator }) }))
vi.mock('../server/localAgentPreferences.ts', () => ({
  getLocalAgentPreference: async () => ({ enabled: state.enabled, model: 'default' }),
}))
vi.mock('../server/localAgentRuns.ts', () => ({ localAgentRuns: { online: () => state.online } }))
vi.mock('../server/db/index.ts', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () =>
          Object.assign(Promise.resolve(table === residentUsage ? [{ used: 0 }] : []), { limit: async () => [] }),
      }),
    }),
    insert: state.insert,
  },
}))

beforeEach(() => {
  state.creator = false
  state.enabled = true
  state.online = true
  stubEnv('REQUESTY_API_KEY', 'synthetic-requesty-key')
  stubEnv('DOOP_AGENT_PROVIDER', 'requesty')
})
afterEach(() => {
  vi.clearAllMocks()
  unstubAllEnvs()
})

it('ignores stale Local Agent preferences for advisors without bypassing quota or blocking Requesty', async () => {
  expect(await getAllowance('advisor')).toMatchObject({ localAgent: false, limit: 0 })
  expect((await consumeResidentTask('advisor')).ok).toBe(false)
  expect(await pickModel('advisor')).toMatchObject({ provider: 'requesty' })
  expect(state.insert).not.toHaveBeenCalled()
})

it('permits Creator local execution and quota bypass, then honors role revocation', async () => {
  state.creator = true
  expect(await getAllowance('creator')).toMatchObject({ localAgent: true })
  expect((await consumeResidentTask('creator')).ok).toBe(true)
  expect(await pickModel('creator')).toMatchObject({ provider: 'claude-local' })
  state.creator = false
  expect((await consumeResidentTask('creator')).ok).toBe(false)
  expect(await pickModel('creator')).toMatchObject({ provider: 'requesty' })
  expect(state.insert).not.toHaveBeenCalled()
})

it('keeps an explicitly selected offline Local Agent paused for an eligible Creator', async () => {
  state.creator = true
  state.online = false
  expect(await pickModel('creator')).toBeNull()
  state.enabled = false
  expect(await pickModel('creator')).toMatchObject({ provider: 'requesty' })
})
