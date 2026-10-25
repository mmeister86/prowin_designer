import { env } from './env.ts'
import { getLocalAgentPreference } from './localAgentPreferences.ts'
import { eq, sql } from 'drizzle-orm'
import { db } from './db/index.ts'
import { residentUsage } from './db/schema.ts'
import { oauthAccessToken } from './db/auth-schema.ts'
import { permissionIdentity } from './prowin/accounts.ts'

/** Server-paid resident work consumes RESIDENT_TASK_LIMIT tasks per account.
 * Only currently eligible Creator/Admin local execution bypasses the meter.
 * MCP OAuth alone never grants server-paid work. Default limit remains zero. */

export const RESIDENT_TASK_LIMIT = env.RESIDENT_TASK_LIMIT

export interface Allowance {
  used: number
  limit: number
  /** the user has completed the MCP OAuth flow with their own agent */
  connected: boolean
  /** A currently eligible Creator/Admin explicitly selected Local Agent. */
  localAgent: boolean
}

/** An OAuth access token ever issued to this user = an agent of their own
 *  completed the connect flow. Expired rows still count — the point is proof
 *  they can connect, not a live session. */
async function hasOwnAgent(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: oauthAccessToken.id })
    .from(oauthAccessToken)
    .where(eq(oauthAccessToken.userId, userId))
    .limit(1)
  return !!row
}

async function usedCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ used: residentUsage.used })
    .from(residentUsage)
    .where(eq(residentUsage.userId, userId))
  return row?.used ?? 0
}

export async function getAllowance(userId: string): Promise<Allowance> {
  const [connected, used, local, identity] = await Promise.all([
    hasOwnAgent(userId),
    usedCount(userId),
    getLocalAgentPreference(userId),
    permissionIdentity(userId),
  ])
  return { used, limit: RESIDENT_TASK_LIMIT, connected, localAgent: local.enabled && identity.creator }
}

/** Spend one resident task. ok:false = the free tier is used up and the user
 *  has not selected an eligible Local Agent. */
export async function consumeResidentTask(userId: string): Promise<Allowance & { ok: boolean }> {
  const current = await getAllowance(userId)
  if (current.localAgent) return { ...current, ok: true }
  if (current.used >= current.limit) return { ...current, ok: false }
  /* guarded upsert: concurrent requests can never push `used` past the limit */
  const rows = await db
    .insert(residentUsage)
    .values({ userId, used: 1, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: residentUsage.userId,
      set: { used: sql`${residentUsage.used} + 1`, updatedAt: Date.now() },
      setWhere: sql`${residentUsage.used} < ${RESIDENT_TASK_LIMIT}`,
    })
    .returning({ used: residentUsage.used })
  const applied = rows[0]
  if (!applied) return { ...current, used: current.limit, ok: false }
  return { ...current, used: applied.used, ok: true }
}

/** Give back a task that was spent but never turned into work — the thread
 *  closed or its frame vanished between metering and the write. Only a
 *  metered spend (not a local-agent pass) is returned, never below zero. */
export async function refundResidentTask(gate: Allowance & { ok: boolean }, userId: string): Promise<void> {
  if (!gate.ok || gate.localAgent) return
  await db
    .update(residentUsage)
    .set({ used: sql`greatest(${residentUsage.used} - 1, 0)`, updatedAt: Date.now() })
    .where(eq(residentUsage.userId, userId))
}
