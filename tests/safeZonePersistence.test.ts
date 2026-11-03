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
    id: 'safe',
    name: 'Safe',
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

it('persists safe-zone overrides through writes and reloads', async () => {
  const frame = store.createFrame(
    'safe',
    { name: 'Post', preset: 'ig-post', safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } },
    'test',
  )!
  expect(await reloadFrame(frame.id)).toMatchObject({
    safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 },
  })
  store.updateFrame(frame.id, { safeZoneOverride: null }, 'test')
  expect(await reloadFrame(frame.id)).not.toHaveProperty('safeZoneOverride')
})

it('preserves overrides through page and canvas copies', async () => {
  const frame = store.createFrame(
    'safe',
    { name: 'Post', preset: 'ig-post', safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } },
    'test',
  )!
  await reloadFrame(frame.id)
  const pageCopy = (await store.duplicatePage('safe', 'page', 'test'))!
  expect(pageCopy.frames[0]).toMatchObject({ safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } })
  expect(await reloadFrame(pageCopy.frames[0]!.id)).toHaveProperty('safeZoneOverride')
  const canvasCopy = (await store.duplicateCanvas('safe', 'owner', 'test'))!
  const restored = (await persist.hydrate()).canvases.find((canvas) => canvas.id === canvasCopy.id)!
  expect(restored.frames[0]).toMatchObject({ safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } })
})

it('rejects corrupt stored overrides gracefully on load', async () => {
  const frame = store.createFrame('safe', { name: 'Post', preset: 'ig-post' }, 'test')!
  await persist.flush((id) => store.getFrame(id))
  await pg.exec(`UPDATE frames SET safe_zone_override = '{"top":-1}' WHERE id = '${frame.id}'`)
  expect(await reloadFrame(frame.id)).not.toHaveProperty('safeZoneOverride')
})

it('adds a nullable safe_zone_override to legacy rows', async () => {
  const legacy = new PGlite()
  try {
    await legacy.exec(`CREATE TABLE frames (id text PRIMARY KEY, width double precision, height double precision);
      INSERT INTO frames VALUES ('legacy', 321, 654);`)
    for (const file of ['0041_frame_presets.sql', '0042_frame_safe_zones.sql'])
      await legacy.exec(readFileSync(`server/db/migrations/${file}`, 'utf8'))
    expect((await legacy.query('SELECT width, height, safe_zone_override FROM frames')).rows).toEqual([
      { width: 321, height: 654, safe_zone_override: null },
    ])
  } finally {
    await legacy.close()
  }
})
