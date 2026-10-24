import { eq } from 'drizzle-orm'
import { Router } from 'express'
import { db } from '../db/index.ts'
import { prowinCreators } from '../db/schema.ts'
import { user } from '../db/auth-schema.ts'
import type { PermissionIdentity } from '../../shared/prowin/permissions.ts'

/** Fresh database reads keep instance-role revocations effective for queued work. */
export async function permissionIdentity(userId: string): Promise<PermissionIdentity> {
  const [account] = await db.select({ role: user.role }).from(user).where(eq(user.id, userId))
  const [creator] = await db.select().from(prowinCreators).where(eq(prowinCreators.userId, userId))
  const admin = account?.role === 'admin'
  return { userId, admin, creator: !!account && (admin || !!creator) }
}

export const creatorRouter = Router()
creatorRouter.post('/creator', (req, res, next) => {
  void db
    .insert(prowinCreators)
    .values({ userId: req.user!.id, registeredAt: Date.now() })
    .onConflictDoNothing()
    .then(() => res.json({ creator: true, canCreateWorkspace: true }))
    .catch(next)
})
