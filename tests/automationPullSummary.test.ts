import { expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ created: ['new-frame'], skipped: 2 }))
vi.mock('../shared/prowin/features.ts', () => ({ OPTIONAL_FEATURES: { automations: true } }))
vi.mock('../server/auth.ts', () => ({ getUserName: async () => 'English Owner' }))
vi.mock('../server/access.ts', () => ({ hasDurableCanvasAccess: () => true }))
vi.mock('../server/store.ts', () => ({ store: { getCanvas: () => ({ id: 'c1', ownerId: 'alice' }) } }))
vi.mock('../server/meta.ts', () => ({
  getConnection: async () => ({}),
  pullCreatives: async () => ({ created: state.created, skipped: state.skipped }),
  MetaAuthError: class extends Error {},
}))
vi.mock('../server/db/index.ts', () => {
  const row = {
    id: 'a1',
    ownerId: 'alice',
    name: 'English Automation',
    enabled: true,
    steps: [{ id: 's1', type: 'pull', provider: 'meta', accountId: 'act_1', filter: 'active', canvasId: 'c1' }],
  }
  return {
    db: {
      select: () => ({
        from: () => ({
          where: () => ({
            then: (resolve: (rows: unknown[]) => void) => resolve([row]),
            orderBy: () => ({ offset: async () => [] }),
          }),
        }),
      }),
      insert: () => ({ values: async () => {} }),
      update: () => ({ set: () => ({ where: async () => {} }) }),
    },
  }
})

const { runAutomation } = await import('../server/automations.ts')

it.each([
  [1, '1 neues Werbemotiv (2 bereits vorhanden)'],
  [2, '2 neue Werbemotive (2 bereits vorhanden)'],
])('reports %i imported creative(s) with skipped existing items', async (count, summary) => {
  state.created = Array.from({ length: count }, (_, i) => `frame-${i}`)
  expect(await runAutomation('a1')).toMatchObject({ status: 'ok', summary, error: null, canvasId: 'c1' })
})
