import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('migrates legacy workspace authors and invitations without granting instance administration', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      CREATE TABLE "user" (id text PRIMARY KEY, role text);
      CREATE TABLE workspace_members (user_id text, role text);
      CREATE TABLE workspace_invites (email text, role text);
      INSERT INTO "user" VALUES ('owner', NULL), ('old-admin', 'user'), ('member', 'user');
      INSERT INTO workspace_members VALUES ('owner', 'owner'), ('old-admin', 'admin'), ('member', 'member');
      INSERT INTO workspace_invites VALUES ('later@test.dev', 'admin');
    `)
    await db.exec(readFileSync('server/db/migrations/0038_prowin_creator_permissions.sql', 'utf8'))
    expect(
      (await db.query<{ user_id: string }>('SELECT user_id FROM prowin_creators ORDER BY user_id')).rows.map(
        (r) => r.user_id,
      ),
    ).toEqual(['old-admin', 'owner'])
    expect((await db.query("SELECT role FROM workspace_members WHERE user_id = 'old-admin'")).rows).toEqual([
      { role: 'creator' },
    ])
    expect((await db.query('SELECT role FROM workspace_invites')).rows).toEqual([{ role: 'member' }])
    expect((await db.query('SELECT role FROM "user" WHERE id = \'old-admin\'')).rows).toEqual([{ role: 'user' }])
  } finally {
    await db.close()
  }
})
