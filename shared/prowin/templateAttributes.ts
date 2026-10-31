import { collectFrameTags } from '../frameBrandHtml.ts'
import { BRAND_TOKENS } from './brandTokens.ts'

export const TEMPLATE_ROLES = ['headline', 'body', 'image', 'cta', 'logo', 'contact', 'date', 'decor'] as const

export type TemplateRole = (typeof TEMPLATE_ROLES)[number]

export const TEMPLATE_ATTRS = [
  'data-od-id',
  'data-od-role',
  'data-od-label',
  'data-od-locked',
  'data-od-max-length',
  'data-od-allowed-colors',
] as const

export interface TemplateField {
  id: string
  role: TemplateRole | null
  label: string | null
  locked: boolean
  maxLength: number | null
  allowedColors: string[]
}

/** Token names without `--`, the only valid values for data-od-allowed-colors. */
export function brandColorTokenNames(): string[] {
  return Object.keys(BRAND_TOKENS).map((token) => token.replace(/^--/, ''))
}

const TEMPLATE_ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/

export function isValidTemplateId(id: string): boolean {
  return TEMPLATE_ID_RE.test(id)
}

/** null when none of the six template attributes is present. Raw values are kept so validate flags them instead of silently dropping them. */
export function parseTemplateField(attrs: Map<string, string>): TemplateField | null {
  if (!TEMPLATE_ATTRS.some((attr) => attrs.has(attr))) return null
  const roleRaw = (attrs.get('data-od-role') ?? '').trim()
  const labelRaw = (attrs.get('data-od-label') ?? '').trim()
  const maxLengthRaw = (attrs.get('data-od-max-length') ?? '').trim()
  return {
    id: (attrs.get('data-od-id') ?? '').trim(),
    role: roleRaw === '' ? null : (roleRaw as TemplateRole),
    label: labelRaw === '' ? null : labelRaw,
    locked: attrs.has('data-od-locked'),
    maxLength: maxLengthRaw === '' ? null : Number(maxLengthRaw),
    allowedColors: (attrs.get('data-od-allowed-colors') ?? '')
      .split(',')
      .map((color) => color.trim())
      .filter((color) => color !== ''),
  }
}

/** German error messages; empty array means valid. */
export function validateTemplateField(field: TemplateField): string[] {
  const errors: string[] = []
  if (!isValidTemplateId(field.id)) {
    errors.push(
      `Ungültige Template-ID "${field.id}": muss mit einem Buchstaben beginnen und darf nur Buchstaben, Ziffern, _ und - enthalten (max. 64 Zeichen).`,
    )
  }
  if (field.role !== null && !(TEMPLATE_ROLES as readonly string[]).includes(field.role)) {
    errors.push(`Ungültige Template-Rolle "${field.role}": erlaubt sind ${TEMPLATE_ROLES.join(', ')}.`)
  }
  if (field.label !== null && field.label.length > 120) {
    errors.push('Ungültiges Template-Label: max. 120 Zeichen erlaubt.')
  }
  if (field.maxLength !== null && (!Number.isInteger(field.maxLength) || field.maxLength < 1)) {
    errors.push('Ungültige Template-Maximallänge: muss eine ganze Zahl ≥ 1 sein (leer = ungesetzt).')
  }
  const known = new Set(brandColorTokenNames())
  const unknown = field.allowedColors.filter((color) => !known.has(color))
  if (unknown.length > 0) {
    errors.push(
      `Ungültige Template-Farben: ${unknown.join(', ')} — erlaubt sind nur Token-Namen ohne "--" aus BRAND_TOKENS.`,
    )
  }
  return errors
}

/** Fields in document order; tag-shaped text in comments and raw-text elements is ignored. */
export function extractTemplateFields(html: string): TemplateField[] {
  const fields: TemplateField[] = []
  for (const tag of collectFrameTags(html)) {
    const field = parseTemplateField(tag.attrs)
    if (field) fields.push(field)
  }
  return fields
}

/** Canonical comparison form; colors sorted so order does not count as a change. */
export function templateFieldSignature(field: TemplateField): string {
  return [
    field.id,
    field.role ?? '',
    field.label ?? '',
    field.locked ? 'locked' : '',
    field.maxLength ?? '',
    [...field.allowedColors].sort().join(','),
  ].join('|')
}

/** Duplicate IDs in order of first repeat; empty IDs are invalid, not duplicates. */
export function findDuplicateTemplateIds(fields: TemplateField[]): string[] {
  const seen = new Set<string>()
  const duplicates: string[] = []
  for (const field of fields) {
    if (field.id === '') continue
    if (seen.has(field.id)) {
      if (!duplicates.includes(field.id)) duplicates.push(field.id)
    } else {
      seen.add(field.id)
    }
  }
  return duplicates
}

export function mintTemplateId(
  taken: ReadonlySet<string>,
  suffix: () => string = () => crypto.randomUUID().slice(0, 8),
): string {
  let id = `feld-${suffix()}`
  while (taken.has(id)) id = `feld-${suffix()}`
  return id
}

/** Semantic metadata diff: changed compares signatures per ID (content edits ignored); invalid holds flattened German validation messages from nextHtml. */
export function diffTemplateMeta(
  prevHtml: string,
  nextHtml: string,
): { changed: boolean; duplicates: string[]; invalid: string[] } {
  const signatures = (html: string) => {
    const map = new Map<string, string>()
    for (const field of extractTemplateFields(html)) map.set(field.id, templateFieldSignature(field))
    return map
  }
  const prev = signatures(prevHtml)
  const next = signatures(nextHtml)
  let changed = prev.size !== next.size
  if (!changed) {
    for (const [id, signature] of prev) {
      if (next.get(id) !== signature) {
        changed = true
        break
      }
    }
  }
  const nextFields = extractTemplateFields(nextHtml)
  const invalid: string[] = []
  for (const field of nextFields) invalid.push(...validateTemplateField(field))
  return { changed, duplicates: findDuplicateTemplateIds(nextFields), invalid }
}
