import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import type { Db } from '../server/db/index.ts'
import { admitServerWork, prepareServerWork } from '../server/residentAdmission.ts'

const state = vi.hoisted(() => ({ db: null as unknown as Db }))
vi.mock('../server/db/index.ts', () => ({
  get db() {
    return state.db
  },
}))
vi.mock('../server/allowance.ts', () => ({ RESIDENT_TASK_LIMIT: 1 }))
let client: PGlite
beforeEach(async () => {
  client = new PGlite()
  state.db = drizzle(client) as unknown as Db
  await client.exec(`
    CREATE TABLE tasks (id text PRIMARY KEY, server_paid boolean);
    CREATE TABLE comments (id text PRIMARY KEY, server_paid boolean);
    CREATE TABLE feedback (id text PRIMARY KEY, server_paid boolean);
    CREATE TABLE resident_usage (user_id text PRIMARY KEY, used integer NOT NULL, updated_at bigint NOT NULL);
  `)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await client.close()
})

it.each([
  ['card', 'tasks'],
  ['comment', 'comments'],
  ['feedback', 'feedback'],
] as const)('admits local %s once, rejects excess work and leaves legacy admission uncharged', async (kind, table) => {
  await client.exec(`INSERT INTO ${table} VALUES ('local', false), ('excess', false), ('legacy', NULL)`)
  expect(await admitServerWork('alice', kind, 'legacy')).toBe(false)
  expect((await client.query('SELECT * FROM resident_usage')).rows).toHaveLength(0)
  expect(await admitServerWork('alice', kind, 'local')).toBe(true)
  expect(await admitServerWork('alice', kind, 'local')).toBe(true)
  expect(await admitServerWork('alice', kind, 'excess')).toBe(false)
  expect((await client.query('SELECT used FROM resident_usage')).rows).toEqual([{ used: 1 }])
  expect((await client.query(`SELECT server_paid FROM ${table} WHERE id = 'local'`)).rows).toEqual([
    { server_paid: true },
  ])
  expect((await client.query(`SELECT server_paid FROM ${table} WHERE id = 'excess'`)).rows).toEqual([
    { server_paid: false },
  ])
})

it.each(['snapshot', 'transaction'])(
  'makes a %s failure retryable without charging or abandoning the next claim',
  async (stage) => {
    await client.exec("INSERT INTO tasks VALUES ('broken', false), ('next', false)")
    const failures: string[] = []
    const error = new Error('Database unavailable')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const flush = async () => {
      if (stage === 'snapshot') throw error
    }
    if (stage === 'transaction') vi.spyOn(state.db, 'transaction').mockRejectedValueOnce(error)
    const broken = { id: 'broken', serverPaid: false }
    expect(await prepareServerWork('alice', 'card', broken, flush, (reason) => failures.push(reason))).toBe(false)
    expect(failures).toEqual([expect.stringMatching(/nicht gestartet.*erneut/i)])
    expect((await client.query('SELECT * FROM resident_usage')).rows).toHaveLength(0)
    const next = { id: 'next', serverPaid: false }
    expect(
      await prepareServerWork(
        'alice',
        'card',
        next,
        async () => {},
        (reason) => failures.push(reason),
      ),
    ).toBe(true)
    expect(next.serverPaid).toBe(true)
  },
)

it('retains a previously confirmed admission when a later claim fails', async () => {
  await client.exec("INSERT INTO tasks VALUES ('paid', false), ('broken', false)")
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const failures: string[] = []
  const paid = { id: 'paid', serverPaid: false }
  expect(
    await prepareServerWork(
      'alice',
      'card',
      paid,
      async () => {},
      (reason) => failures.push(reason),
    ),
  ).toBe(true)
  expect(
    await prepareServerWork(
      'alice',
      'card',
      { id: 'broken', serverPaid: false },
      async () => {
        throw new Error('offline')
      },
      (reason) => failures.push(reason),
    ),
  ).toBe(false)
  expect(paid.serverPaid).toBe(true)
  expect(await admitServerWork('alice', 'card', paid.id)).toBe(true)
  expect((await client.query('SELECT used FROM resident_usage')).rows).toEqual([{ used: 1 }])
  expect(failures).toHaveLength(1)
})
