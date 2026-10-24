import { expect, it, vi } from 'vitest'
import { LocalAgentRuns } from '../server/localAgentRuns.ts'
const request = (execute = vi.fn(async () => ({ type: 'tool_result' as const, tool_use_id: 'x', content: 'ok' }))) => ({
  canvasId: 'canvas',
  prompt: 'Design',
  system: 'Rules',
  tools: [{ name: 'edit', input_schema: { type: 'object' as const } }],
  maxTurns: 2,
  execute,
})
it('rejects run creation and polling after Creator rights are revoked', async () => {
  let allowed = false
  const runs = new LocalAgentRuns(async () => allowed)
  expect((await runs.startAuthorized('alice', 'default', request())).success).toBe(false)
  expect(await runs.pollAuthorized('alice', 'desktop')).toBeNull()
  allowed = true
  const result = runs.startAuthorized('alice', 'default', request())
  // startAuthorized checks current privileges before publishing the job.
  await vi.waitFor(async () => expect(await runs.pollAuthorized('alice', 'desktop')).not.toBeNull())
  allowed = false
  expect(await runs.pollAuthorized('alice', 'desktop')).toBeNull()
  expect((await result).success).toBe(false)
})
it('rechecks privileges inside the serialized tool queue and rejects stale results', async () => {
  let allowed = true
  const runs = new LocalAgentRuns(async () => allowed)
  let release!: () => void
  const blocked = new Promise<void>((resolve) => {
    release = resolve
  })
  const execute = vi.fn(async () => {
    await blocked
    return { type: 'tool_result' as const, tool_use_id: 'x', content: 'ok' }
  })
  const result = runs.start('alice', 'default', request(execute))
  const job = runs.poll('alice', 'desktop')!
  const first = runs.execute(job.id, job.token, 'edit', {})
  await vi.waitFor(() => expect(execute).toHaveBeenCalledOnce())
  const second = runs.execute(job.id, job.token, 'edit', {})
  // Attach rejection handler before releasing the first operation.
  const rejected = expect(second).rejects.toThrow('Creator')
  allowed = false
  release()
  await first
  await rejected
  expect(execute).toHaveBeenCalledOnce()
  expect(await runs.finish(job.id, 'alice', 'desktop', { success: true, text: 'stale' })).toBe(false)
  await runs.cancel('alice')
  await result
})
