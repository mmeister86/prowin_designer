import type { Canvas } from '../../shared/types.ts'
import { diffTemplateMeta } from '../../shared/prowin/templateAttributes.ts'
import { canvasCapabilities, CreatorPermissionError } from './permissions.ts'

export class TemplateMetaError extends Error {
  readonly status = 400
}

/** Narrow TASK-29 backstop for `updateFrame`: duplicates/invalid metadata fail
 *  for everyone (first message), a metadata diff without `manageLocks` fails
 *  with `CreatorPermissionError`. Content, length/color usage and deletion
 *  checks are TASK-30. */
export function assertCanChangeTemplateMeta(canvas: Canvas, prevHtml: string, nextHtml: string): void {
  const { changed, duplicates, invalid } = diffTemplateMeta(prevHtml, nextHtml)
  if (duplicates.length > 0 || invalid.length > 0) {
    throw new TemplateMetaError(duplicates.length > 0 ? `Doppelte Template-ID "${duplicates[0]}".` : invalid[0]!)
  }
  if (changed && !canvasCapabilities(canvas).manageLocks) throw new CreatorPermissionError()
}
