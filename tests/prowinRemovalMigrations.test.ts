import { mkdtemp, readFile, rm, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import { expect, it } from 'vitest'

it('removes import credentials and sync data while preserving designs, settings and task history', async () => {
  const migrationsFolder = path.resolve('server/db/migrations')
  const journal = JSON.parse(await readFile(path.join(migrationsFolder, 'meta/_journal.json'), 'utf8')) as {
    entries: { tag: string; idx: number; when: number }[]
  }
  const baseline = await mkdtemp(path.join(tmpdir(), 'prowin-removal-'))
  const client = new PGlite()
  try {
    await mkdir(path.join(baseline, 'meta'))
    const entries = journal.entries.filter((entry) => entry.tag < '0036')
    await writeFile(path.join(baseline, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }))
    for (const entry of entries) {
      await copyFile(path.join(migrationsFolder, `${entry.tag}.sql`), path.join(baseline, `${entry.tag}.sql`))
    }
    const db = drizzle(client)
    await migrate(db, { migrationsFolder: baseline })
    await client.exec(`
      INSERT INTO canvases (id, name, owner_id, created_at, updated_at) VALUES ('existing', 'Keep me', 'alice', 1, 1);
      INSERT INTO frames (id, canvas_id, name, x, y, width, height, html, created_at, updated_at, updated_by)
        VALUES ('imported', 'existing', 'Imported', 0, 0, 100, 100, '<p>Keep this design</p>', 1, 1, 'alice');
      INSERT INTO github_connections (id, canvas_id, repo, branch, token, created_by, created_at)
        VALUES ('connection', 'existing', 'owner/repo', 'main', 'old-credential', 'alice', 1);
      INSERT INTO tasks (id, canvas_id, agent_name, color, status, started_at, queued_by, kind, payload)
        VALUES ('pending', 'existing', '', 'red', 'Import', 1, 'alice', 'sketch', '{}');
      INSERT INTO local_agent_preferences (user_id, enabled, model) VALUES ('alice', true, 'default');
      INSERT INTO sync_keys (id, secret, canvas_id, name, created_by, created_at)
        VALUES ('sync', 'old-secret', 'existing', 'App', 'alice', 1);
      INSERT INTO sync_links (key_id, page, to_page, x, y, width, height)
        VALUES ('sync', '/', '/next', 0, 0, 10, 10);
      INSERT INTO sync_edges (key_id, from_page, to_page, count, last_at)
        VALUES ('sync', '/', '/next', 5, 1);
    `)
    await migrate(db, { migrationsFolder })
    await migrate(db, { migrationsFolder })
    expect((await client.query("SELECT to_regclass('public.github_connections') AS name")).rows).toEqual([
      { name: null },
    ])
    expect((await client.query('SELECT id, canvas_id, html FROM frames')).rows).toEqual([
      { id: 'imported', canvas_id: 'existing', html: '<p>Keep this design</p>' },
    ])
    expect((await client.query('SELECT name FROM canvases')).rows).toEqual([{ name: 'Keep me' }])
    expect((await client.query('SELECT enabled FROM local_agent_preferences')).rows).toEqual([{ enabled: true }])
    const tasks = await client.query<{ ended_at: number | null; queued_by: string | null }>(
      'SELECT ended_at, queued_by FROM tasks',
    )
    expect(tasks.rows[0]?.ended_at).not.toBeNull()
    expect(tasks.rows[0]?.queued_by).toBeNull()
    for (const table of ['sync_keys', 'sync_links', 'sync_edges']) {
      expect((await client.query('SELECT to_regclass($1) AS name', [`public.${table}`])).rows).toEqual([{ name: null }])
    }
  } finally {
    await client.close()
    await rm(baseline, { recursive: true, force: true })
  }
}, 30_000)
