import type { Actor, Frame } from '../shared/types.ts'
import * as actions from './actions.ts'
import { importedPageSource, importPage, normalizeImportUrl, type ImportedPage } from './importer.ts'

interface WebpageImportDependencies {
  importPage: typeof importPage
  createFrame: typeof actions.createFrame
}

const dependencies: WebpageImportDependencies = {
  importPage,
  createFrame: actions.createFrame,
}

export interface ImportedWebpageFrame {
  imported: ImportedPage
  frame: Frame | undefined
}

/** Find an earlier snapshot of the same requested URL. Resident pipeline
 *  stages use this to reuse source material instead of adding megabyte-scale
 *  duplicates on every stage or retry. */
export function findImportedWebpageFrame(frames: Frame[], rawUrl: string): Frame | undefined {
  const source = normalizeImportUrl(rawUrl).href
  return frames.find((frame) => importedPageSource(frame.html) === source)
}

/** Shared agent-facing wrapper around the browser/UI importer. Keeping the
 *  page-to-frame mapping here ensures resident and connected agents create the
 *  exact same editable source artifact. Dependencies are injectable for a
 *  bounded unit test without launching Chrome or writing to the store. */
export async function createImportedWebpageFrame(
  input: {
    canvasId: string
    url: string
    actor: Actor
    includePreview?: boolean
  },
  deps: WebpageImportDependencies = dependencies,
): Promise<ImportedWebpageFrame> {
  const imported = await deps.importPage(input.url, { includePreview: input.includePreview })
  const frame = deps.createFrame(
    input.canvasId,
    {
      name: imported.title.slice(0, 80),
      width: imported.width,
      height: imported.height,
      html: imported.html,
    },
    input.actor,
  )
  return { imported, frame }
}
/** URLs and bare domains in work requests; file names are not sites. */
export function referencedUrls(text: string): string[] {
  const NOT_SITES = /\.(png|jpe?g|gif|svg|webp|ico|css|js|ts|tsx|json|html?|md|pdf|txt|mp4|webm|woff2?)$/i
  const matches =
    text.match(/\bhttps?:\/\/[^\s"'<>()]+|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s"'<>()]*)?/gi) ?? []
  const urls = matches.map((m) => m.replace(/[.,;:!?]+$/, '')).filter((m) => !NOT_SITES.test(m))
  return [...new Set(urls)]
}
