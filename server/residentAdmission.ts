import { eq, sql } from 'drizzle-orm'
import { db } from './db/index.ts'
import { comments, feedback, residentUsage, tasks } from './db/schema.ts'
import { RESIDENT_TASK_LIMIT } from './allowance.ts'

export type ResidentWorkKind = 'card' | 'feedback' | 'comment'
const tables = { card: tasks, feedback, comment: comments }

/** Moving queued local work onto the server is a paid admission. Lock its row
 * and update admission + account usage in one transaction, so restarts and
 * concurrent claims cannot double-charge or grant unlimited server work. */
export async function admitServerWork(userId: string, kind: ResidentWorkKind, id: string): Promise<boolean> {
  if (RESIDENT_TASK_LIMIT <= 0) return false
  const table = tables[kind]
  return db.transaction(async (tx) => {
    const [work] = await tx.select({ paid: table.serverPaid }).from(table).where(eq(table.id, id)).for('update')
    if (work?.paid === true) return true
    // Unknown historical admission is paused for an explicit, metered retry.
    if (work?.paid !== false) return false
    const spent = await tx
      .insert(residentUsage)
      .values({ userId, used: 1, updatedAt: Date.now() })
      .onConflictDoUpdate({
        target: residentUsage.userId,
        set: { used: sql`${residentUsage.used} + 1`, updatedAt: Date.now() },
        setWhere: sql`${residentUsage.used} < ${RESIDENT_TASK_LIMIT}`,
      })
      .returning({ used: residentUsage.used })
    if (!spent.length) return false
    await tx.update(table).set({ serverPaid: true }).where(eq(table.id, id))
    return true
  })
}

/** A failed write/admission pauses only this claim. The caller keeps processing
 * the batch; earlier successful admissions stay paid and can execute normally. */
export async function prepareServerWork(
  userId: string | undefined,
  kind: ResidentWorkKind,
  work: { id: string; serverPaid?: boolean },
  flush: () => PromiseLike<unknown>,
  fail: (reason: string) => void,
): Promise<boolean> {
  let reason = 'Server task allowance exhausted or queued work needs an explicit retry after upgrade.'
  try {
    await flush()
    if (userId && (await admitServerWork(userId, kind, work.id))) {
      work.serverPaid = true
      return true
    }
  } catch (error) {
    console.error('[resident] server admission failed', error)
    reason = 'Server task admission failed. Please retry when the service is available.'
  }
  fail(reason)
  return false
}
