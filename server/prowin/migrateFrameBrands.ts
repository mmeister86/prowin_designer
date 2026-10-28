import { and, asc, eq, gt } from 'drizzle-orm'
import type { Db } from '../db/index.ts'
import { frames } from '../db/schema.ts'
import { normalizeFrameHtml } from './frameBrand.ts'
import { env } from '../env.ts'

/** Run before hydration/listening, including after a legacy JSON import.
 * Only HTML changes: attribution, timestamps and historical versions remain intact.
 * Keyset batches and content-conditional writes allow a failed run to be resumed.
 */
export async function migrateFrameBrands(database: Db, origin = env.BETTER_AUTH_URL): Promise<number> {
  let after: string | undefined
  let changed = 0
  for (;;) {
    const batch = await database
      .select({ id: frames.id, html: frames.html })
      .from(frames)
      .where(after === undefined ? undefined : gt(frames.id, after))
      .orderBy(asc(frames.id))
      .limit(100)
    if (!batch.length) return changed
    for (const frame of batch) {
      const html = normalizeFrameHtml(frame.html, origin)
      if (html === frame.html) continue
      const written = await database
        .update(frames)
        .set({ html })
        .where(and(eq(frames.id, frame.id), eq(frames.html, frame.html)))
        .returning({ id: frames.id })
      changed += written.length
    }
    after = batch[batch.length - 1]!.id
  }
}
