import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { expect, it } from 'vitest'
import type { Db } from '../server/db/index.ts'
import { migrateFrameBrands } from '../server/prowin/migrateFrameBrands.ts'
import { normalizeFrameHtml } from '../server/prowin/frameBrand.ts'

it('migrates multiple batches, preserves metadata, and reruns safely after an origin change', async () => {
  const client = new PGlite()
  try {
    await client.exec(
      'CREATE TABLE frames (id text PRIMARY KEY, html text NOT NULL, updated_at bigint, updated_by text)',
    )
    for (let i = 0; i < 103; i++) {
      await client.query('INSERT INTO frames VALUES ($1, $2, 17, $3)', [
        String(i).padStart(3, '0'),
        '<p>Bestand</p>',
        'Original',
      ])
    }
    const db = drizzle(client) as unknown as Db
    expect(await migrateFrameBrands(db, 'https://first.example')).toBe(103)
    expect(await migrateFrameBrands(db, 'https://first.example')).toBe(0)
    expect(await migrateFrameBrands(db, 'https://new.example')).toBe(103)
    expect(await migrateFrameBrands(db, 'https://new.example')).toBe(0)
    const rows = (await client.query<{ html: string; updated_at: number; updated_by: string }>('SELECT * FROM frames'))
      .rows
    expect(rows).toHaveLength(103)
    for (const row of rows) {
      expect(row.html).toBe(normalizeFrameHtml('<p>Bestand</p>', 'https://new.example'))
      expect(Number(row.updated_at)).toBe(17)
      expect(row.updated_by).toBe('Original')
    }
  } finally {
    await client.close()
  }
}, 30_000)
