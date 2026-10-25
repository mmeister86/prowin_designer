import { mkdtemp, readFile, rm, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { expect, it } from 'vitest'

it('drops all private credentials including orphaned and unknown accounts, preserving Local Agent and designs', async () => {
  const folder = path.resolve('server/db/migrations')
  const journal = JSON.parse(await readFile(path.join(folder, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string; idx: number; when: number }[]
  }
  const baseline = await mkdtemp(path.join(tmpdir(), 'prowin-byo-removal-'))
  const client = new PGlite()
  try {
    await mkdir(path.join(baseline, 'meta'))
    const entries = journal.entries.filter((entry) => entry.tag < '0039')
    await writeFile(path.join(baseline, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }))
    for (const entry of entries)
      await copyFile(path.join(folder, `${entry.tag}.sql`), path.join(baseline, `${entry.tag}.sql`))
    const db = drizzle(client)
    await migrate(db, { migrationsFolder: baseline })
    for (const kind of [
      'chatgpt',
      'openai-key',
      'anthropic-key',
      'openrouter-key',
      'gemini-key',
      'unknown-future-kind',
    ]) {
      await client.query(
        `INSERT INTO model_accounts (user_id, kind, access_token, refresh_token, api_key, connected_at, updated_at)
        VALUES ($1, $2, 'synthetic-access', 'synthetic-refresh', 'synthetic-key', 1, 1)`,
        [`orphan-${kind}`, kind],
      )
    }
    await client.exec(`
      INSERT INTO canvases (id, name, owner_id, created_at, updated_at) VALUES ('keep', 'Keep this', 'alice', 1, 1);
      INSERT INTO frames (id, canvas_id, name, x, y, width, height, html, created_at, updated_at, updated_by)
        VALUES ('design', 'keep', 'Design', 0, 0, 100, 100, '<p>Keep</p>', 1, 1, 'alice');
      INSERT INTO local_agent_preferences (user_id, enabled, model) VALUES ('alice', true, 'default');
      INSERT INTO image_prefs (user_id, model, updated_at) VALUES ('alice', 'gpt-image-2', 1);
      INSERT INTO resident_usage (user_id, used, updated_at) VALUES ('alice', 7, 1);
    `)
    await migrate(db, { migrationsFolder: folder })
    await migrate(db, { migrationsFolder: folder })
    expect((await client.query("SELECT to_regclass('public.model_accounts') AS name")).rows).toEqual([{ name: null }])
    expect((await client.query('SELECT html FROM frames')).rows).toEqual([{ html: '<p>Keep</p>' }])
    expect((await client.query('SELECT enabled, model FROM local_agent_preferences')).rows).toEqual([
      { enabled: true, model: 'default' },
    ])
    expect((await client.query('SELECT used FROM resident_usage')).rows).toEqual([{ used: 7 }])
    expect((await client.query('SELECT model FROM image_prefs')).rows).toEqual([{ model: 'gpt-image-2' }])
  } finally {
    await client.close()
    await rm(baseline, { recursive: true, force: true })
  }
}, 30_000)
