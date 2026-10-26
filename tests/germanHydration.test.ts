import { expect, it, vi } from 'vitest'
import * as schema from '../server/db/schema.ts'

// Exercise the real hydration logic; only the database transport is replaced.
const { rows } = vi.hoisted(() => ({ rows: new Map<unknown, unknown[]>() }))
vi.mock('../server/db/index.ts', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        const result = rows.get(table) ?? []
        return Object.assign(Promise.resolve(result), { orderBy: () => Promise.resolve(result) })
      },
    }),
    update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
  },
}))
const { hydrate } = await import('../server/db/persist.ts')

it('creates German interruption hints across all queues without translating stored content or failures', async () => {
  const common = { canvasId: 'c', at: 1, startedAt: 1, text: 'User text', status: 'User task' }
  for (const [table, claim] of [
    [schema.tasks, { queuedBy: 'user', agentName: 'Doop' }],
    [schema.feedback, { claimedBy: 'Doop', deliveredAt: 1 }],
    [schema.comments, { claimedBy: 'Doop' }],
  ] as const) {
    rows.set(table, [
      { ...common, ...claim, id: 'interrupted' },
      { ...common, ...claim, id: 'existing', failureReason: 'Existing English diagnostic' },
    ])
  }
  const result = await hydrate()
  for (const queue of [result.tasks, result.feedback, result.comments]) {
    const items = queue.get('c')!
    expect(items.find((item) => item.id === 'interrupted')?.failureReason).toBe(
      'Der Agent wurde vor dem Abschluss gestoppt. Versuche es erneut, wenn Du bereit bist.',
    )
    expect(items.find((item) => item.id === 'existing')?.failureReason).toBe('Existing English diagnostic')
  }
  expect(result.tasks.get('c')?.[0]?.status).toBe('User task')
  expect(result.feedback.get('c')?.[0]?.text).toBe('User text')
  expect(result.comments.get('c')?.[0]?.text).toBe('User text')
})
