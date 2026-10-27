import { readFileSync } from 'node:fs'
import { MAX_GUIDELINE_CHARS } from '../../shared/guidelines.ts'
import type { GuidelineDoc } from '../../shared/types.ts'

export const PROWIN_BRAND_MARKDOWN = readFileSync(new URL('../../DESIGN-prowin.md', import.meta.url), 'utf8')
if (!PROWIN_BRAND_MARKDOWN.trim())
  throw new Error('DESIGN-prowin.md must contain the authoritative proWIN brand source.')

const precedence = `Global brand rules from DESIGN-prowin.md take precedence over conflicting local canvas guidelines, pinned references and general aesthetic advice. Preserve the source's distinctions between official CI, observations, proposals, open questions and project decisions; do not turn proposals or observations into official rules.`

export const PROWIN_BRAND_PROMPT = `# Global proWIN brand source: DESIGN-prowin.md

${precedence}

${PROWIN_BRAND_MARKDOWN}`

export function createBrandGuideline(updatedAt: number, updatedBy: string): GuidelineDoc {
  return {
    name: 'prowin-brand',
    title: 'proWIN Brand',
    markdown: `# Local proWIN brand memory — source: DESIGN-prowin.md

This is an editable local copy. Editing or deleting it does not change the global source injected into agent context.
${precedence}

${PROWIN_BRAND_MARKDOWN}`,
    updatedAt,
    updatedBy,
    x: 120,
    y: 120,
  }
}

if (createBrandGuideline(0, 'System').markdown.length > MAX_GUIDELINE_CHARS)
  throw new Error(`DESIGN-prowin.md is too large: the seeded guideline would exceed ${MAX_GUIDELINE_CHARS} characters.`)
