import { describe, expect, it, vi } from 'vitest'
import { executeGuardedBatch } from '../server/guardedBatch.ts'

describe('guarded tool batches', () => {
  it('skips remaining tool calls when the task is canceled during a batch', async () => {
    const calls = [{ name: 'create_frame' }, { name: 'set_frame_html' }]
    const executed: string[] = []
    let blocked: string | undefined
    const execute = vi.fn(async (call: (typeof calls)[number]) => {
      executed.push(call.name)
      blocked = 'task canceled'
      return `${call.name}:executed`
    })

    const results = await executeGuardedBatch(calls, {
      blocked: () => blocked,
      execute,
      skipped: (call, reason) => `${call.name}:skipped:${reason}`,
    })

    expect(executed).toEqual(['create_frame'])
    expect(results).toEqual(['create_frame:executed', 'set_frame_html:skipped:task canceled'])
  })

  it('executes every call in order when the task is active', async () => {
    const calls = [{ name: 'create_frame' }, { name: 'set_frame_html' }]
    const execute = vi.fn(async (call: (typeof calls)[number]) => `${call.name}:executed`)

    const results = await executeGuardedBatch(calls, {
      blocked: () => undefined,
      execute,
      skipped: (call, reason) => `${call.name}:skipped:${reason}`,
    })

    expect(execute).toHaveBeenCalledTimes(2)
    expect(results).toEqual(['create_frame:executed', 'set_frame_html:executed'])
  })
})
