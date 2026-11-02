import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import { readFileSync } from 'node:fs'
import * as schema from '../server/db/schema.ts'
import type { Canvas } from '../shared/types.ts'

const rig = vi.hoisted(() => ({ db: undefined as unknown as NodePgDatabase<typeof schema> }))
vi.mock('../server/db/index.ts', () => ({
  get db() {
    return rig.db
  },
}))
import * as persist from '../server/db/persist.ts'
import { store } from '../server/store.ts'

const pg = new PGlite()
beforeAll(async () => {
  const db = drizzle(pg, { schema })
  await migrate(db, { migrationsFolder: 'server/db/migrations' })
  rig.db = db as unknown as NodePgDatabase<typeof schema>
})
afterAll(async () => {
  await persist.flush((id) => store.getFrame(id))
  await pg.close()
})
beforeEach(async () => {
  await persist.flush((id) => store.getFrame(id))
  await pg.exec('TRUNCATE frames, canvases, guidelines')
  store.canvases.clear()
  const canvas: Canvas = {
    id: 'formats',
    name: 'Formats',
    createdAt: 1,
    updatedAt: 1,
    pages: [{ id: 'page', name: 'Page 1' }],
    frames: [],
  }
  store.init([canvas])
  await persist.saveCanvasCopy(canvas)
})

async function reloadFrame(id: string) {
  await persist.flush((frameId) => store.getFrame(frameId))
  return (await persist.hydrate()).canvases.flatMap((canvas) => canvas.frames).find((frame) => frame.id === id)!
}

it('persists creation metadata without changing supplied dimensions', async () => {
  const frame = store.createFrame('formats', { name: 'Story', preset: 'ig-story', width: 450, height: 800 }, 'test')!
  expect(frame.preset).toBe('ig-story')
  expect(await reloadFrame(frame.id)).toMatchObject({ preset: 'ig-story', width: 450, height: 800 })
})

it('persists preset updates and explicit removal as database null, omitting it on reload', async () => {
  const frame = store.createFrame('formats', { name: 'Custom', width: 450, height: 800 }, 'test')!
  expect(frame).not.toHaveProperty('preset')
  store.updateFrame(frame.id, { preset: 'wa-status' }, 'test')
  expect(await reloadFrame(frame.id)).toMatchObject({ preset: 'wa-status', width: 450, height: 800 })
  store.updateFrame(frame.id, { name: 'Renamed' }, 'test')
  expect(await reloadFrame(frame.id)).toHaveProperty('preset', 'wa-status')
  expect(store.updateFrame(frame.id, { preset: null }, 'test')).not.toHaveProperty('preset')
  expect(await reloadFrame(frame.id)).not.toHaveProperty('preset')
  expect((await pg.query('SELECT preset FROM frames WHERE id = $1', [frame.id])).rows).toEqual([{ preset: null }])
})

it('preserves preset metadata through durable page and canvas copies', async () => {
  const frame = store.createFrame(
    'formats',
    { name: 'Status', preset: 'wa-status', width: 1080, height: 1920 },
    'test',
  )!
  await reloadFrame(frame.id)
  const pageCopy = (await store.duplicatePage('formats', 'page', 'test'))!
  expect(pageCopy.frames[0]).toMatchObject({ preset: 'wa-status', width: 1080, height: 1920 })
  expect(await reloadFrame(pageCopy.frames[0]!.id)).toHaveProperty('preset', 'wa-status')
  const canvasCopy = (await store.duplicateCanvas('formats', 'owner', 'test'))!
  const restored = (await persist.hydrate()).canvases.find((canvas) => canvas.id === canvasCopy.id)!
  expect(restored.frames).toHaveLength(2)
  for (const copied of restored.frames) {
    expect(copied).toMatchObject({ preset: 'wa-status', width: 1080, height: 1920 })
    expect(copied.id).not.toBe(frame.id)
  }
})

it('adds a nullable preset to legacy rows without changing dimensions', async () => {
  const legacy = new PGlite()
  try {
    await legacy.exec(`CREATE TABLE frames (id text PRIMARY KEY, width double precision, height double precision);
      INSERT INTO frames VALUES ('legacy', 321, 654);`)
    await legacy.exec(readFileSync('server/db/migrations/0041_frame_presets.sql', 'utf8'))
    expect((await legacy.query('SELECT width, height, preset FROM frames')).rows).toEqual([
      { width: 321, height: 654, preset: null },
    ])
  } finally {
    await legacy.close()
  }
  const frame = store.createFrame('formats', { name: 'Legacy', width: 321, height: 654 }, 'test')!
  const restored = await reloadFrame(frame.id)
  expect(restored).not.toHaveProperty('preset')
  expect(restored).toMatchObject({ width: 321, height: 654 })
})
