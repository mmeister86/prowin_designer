import type { Canvas } from '../../shared/types.ts'
import { assertTemplateWrite, TemplateMetaError } from './templateGuard.ts'

export { TemplateMetaError }

/** Narrow TASK-29 backstop for `updateFrame`, now delegated to the parser-backed
 *  TASK-30 guard: duplicates/invalid metadata fail for everyone (400, first
 *  German message), any other template change without `manageLocks` fails with
 *  `CreatorPermissionError` (403). Content, length/color usage and deletion
 *  checks are enforced by the guard. */
export function assertCanChangeTemplateMeta(canvas: Canvas, prevHtml: string, nextHtml: string): void {
  assertTemplateWrite(canvas, prevHtml, nextHtml)
}
