/* Template policy for the proWIN editor (TASK-31, step 1: locks/selection).
   Decides, per element, what a non-creator may do with template content.
   Server guard (TASK-30) stays the authority; this only shapes the UI. */

export interface TemplateElementPolicy {
  /** the frame carries template fields at all */
  template: boolean
  /** non-creator: inside data-od-locked — neither selectable nor editable */
  locked: boolean
  /** non-creator: not editable (locked, or frozen area outside any field) */
  readOnly: boolean
  /** intersected color bounds of all enclosing fields; null = unrestricted,
   *  [] = no permitted token */
  allowedColors: string[] | null
}

export const TEMPLATE_LOCKED_NOTICE = 'Dieses Element ist in der Vorlage gesperrt und kann nicht ausgewählt werden.'
export const TEMPLATE_READONLY_NOTICE = 'Dieses Element gehört zur Vorlage und ist schreibgeschützt.'
export const TEMPLATE_STALE_NOTICE =
  'Dieses Element existiert nicht mehr. Stattdessen wird seine Zeichenfläche angezeigt.'

/* One attribute level of the element-to-root chain. Plain data (no DOM) so
   the core below can be serialized into the frame runtime: same semantics,
   no second logic block. Keep this function self-contained (no imports). */
export interface TemplateAttrLevel {
  hasLocked: boolean
  hasId: boolean
  /** raw data-od-allowed-colors value, or null when the attribute is absent */
  colors: string | null
  /** raw data-od-max-length value, or null when the attribute is absent */
  maxLength: string | null
  /** lowercase tag name of this level ('' when unknown) */
  tag: string
  /** namespace URI of this level ('' when unknown) */
  ns: string
  /** raw data-od-role value of a field root, or '' when absent/not a field */
  role: string
}

/* Mirror of the server guard's editable interior (server/prowin/templateGuard.ts):
   inside a field only the field root itself and SAFE_INLINE descendants may
   change (img only in image-role fields); anything below an unsafe element —
   including a nested field — is frozen. Script/style field roots stay frozen.
   Self-contained (no imports, no module refs): serialized into the runtime. */
export function templatePolicyForChain(
  chain: TemplateAttrLevel[],
  manageLocks: boolean,
  frameHasTemplate: boolean,
): TemplateElementPolicy {
  const SAFE_INLINE = ['br', 'b', 'strong', 'i', 'em', 'u', 'span']
  const XHTML = 'http://www.w3.org/1999/xhtml'
  const inField = chain.some((level) => level.hasId)
  const locked = !manageLocks && chain.some((level) => level.hasLocked)
  /* nested field bounds apply together: only tokens every non-empty level permits
     (a present-but-empty list constrains nothing, like the server guard) */
  const bounds: string[][] = []
  for (const level of chain) {
    if (level.colors === null) continue
    const tokens = level.colors
      .split(',')
      .map((token) => token.trim())
      .filter((token) => token !== '')
    if (tokens.length === 0) continue
    bounds.push(tokens)
  }
  let allowedColors: string[] | null = null
  if (bounds.length > 0) {
    let joint = bounds[0]!
    for (const next of bounds.slice(1)) joint = joint.filter((token) => next.includes(token))
    allowedColors = [...new Set(joint)]
  }
  if (manageLocks) return { template: frameHasTemplate, locked: false, readOnly: false, allowedColors }
  if (locked || (frameHasTemplate && !inField)) {
    return { template: frameHasTemplate, locked, readOnly: true, allowedColors }
  }
  /* structural editability against every enclosing field: a field root itself
     is editable (except script/style); below a root every non-field level up
     to it must be safe inline in the XHTML namespace — nested field roots on
     the way are exempt and open a segment judged with their own role */
  let readOnly = false
  if (inField) {
    for (let f = 0; f < chain.length && !readOnly; f++) {
      if (!chain[f]!.hasId) continue
      if (f === 0) {
        const tag = chain[0]!.tag
        if (tag === 'script' || tag === 'style') readOnly = true
        continue
      }
      let image = chain[f]!.role === 'image'
      for (let i = f - 1; i >= 0; i--) {
        const level = chain[i]!
        if (level.hasId) {
          image = level.role === 'image'
          continue
        }
        const inline = level.tag === 'img' ? image : SAFE_INLINE.includes(level.tag)
        if (level.ns !== XHTML || !inline) {
          readOnly = true
          break
        }
      }
    }
  }
  return { template: frameHasTemplate, locked, readOnly, allowedColors }
}

/* Fail-closed merge of the stored-HTML policy and the live runtime inspect
   policy: a newly stricter verdict on either side wins at once instead of
   waiting for the debounced re-read. Either side may be null (stale selector
   or script-generated content): the other side decides alone. */
export function stricterTemplatePolicy(a: TemplateElementPolicy, b: TemplateElementPolicy): TemplateElementPolicy {
  let allowedColors: string[] | null
  if (a.allowedColors === null) allowedColors = b.allowedColors
  else if (b.allowedColors === null) allowedColors = a.allowedColors
  else allowedColors = [...new Set(a.allowedColors.filter((token) => b.allowedColors!.includes(token)))]
  return {
    template: a.template || b.template,
    locked: a.locked || b.locked,
    readOnly: a.readOnly || b.readOnly,
    allowedColors,
  }
}

/* Null means the selector no longer resolves (stale pick). Presence of
   data-od-locked counts, even with an empty value. Legacy data-doop-locked
   and frame locks are separate and untouched by this policy. */
export function templatePolicyOf(html: string, selector: string, manageLocks: boolean): TemplateElementPolicy | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let el: Element | null
  try {
    el = doc.querySelector(selector)
  } catch {
    return null
  }
  if (!el) return null
  const frameHasTemplate = doc.querySelector('[data-od-id]') !== null
  const chain: TemplateAttrLevel[] = []
  for (let cur: Element | null = el; cur && cur !== doc.documentElement; cur = cur.parentElement) {
    chain.push({
      hasLocked: cur.hasAttribute('data-od-locked'),
      hasId: cur.hasAttribute('data-od-id'),
      colors: cur.hasAttribute('data-od-allowed-colors') ? (cur.getAttribute('data-od-allowed-colors') ?? '') : null,
      maxLength: cur.hasAttribute('data-od-max-length') ? (cur.getAttribute('data-od-max-length') ?? '') : null,
      tag: (cur.tagName ?? '').toLowerCase(),
      ns: cur.namespaceURI ?? '',
      role: cur.hasAttribute('data-od-id') ? (cur.getAttribute('data-od-role') ?? '') : '',
    })
  }
  return templatePolicyForChain(chain, manageLocks, frameHasTemplate)
}

export type SelectionBlockReason = 'locked' | 'stale'

/** Why the element cannot be picked, or null when it can. Legacy-locked
 *  elements stay selectable (so they can be unlocked) — only template
 *  locks and stale selectors block. */
export function selectionBlockReason(
  html: string,
  selector: string,
  manageLocks: boolean,
): SelectionBlockReason | null {
  const policy = templatePolicyOf(html, selector, manageLocks)
  if (!policy) return 'stale'
  return policy.locked ? 'locked' : null
}

export function canSelectTemplateElement(html: string, selector: string, manageLocks: boolean): boolean {
  return selectionBlockReason(html, selector, manageLocks) === null
}

/** Decoded Unicode codepoints — the way the server counts field text
 *  (`[...text].length`). Keep self-contained (no imports): serialized
 *  into the frame runtime beside the policy core. */
export function templateCodepoints(text: string): number {
  return [...text].length
}

/* Applicable text limits of the element-to-root chain, self before
   ancestors: every data-od-max-length on the way applies to the whole
   field text including descendants and siblings. Invalid values (no
   integer ≥ 1) never validate server-side, so they constrain nothing
   here. Keep self-contained (no imports): serialized into the runtime. */
export function templateMaxLengthsForChain(chain: TemplateAttrLevel[]): number[] {
  const out: number[] = []
  for (const level of chain) {
    const raw = level.maxLength
    if (raw === null || raw === undefined) continue
    const n = Number(raw.trim())
    if (Number.isInteger(n) && n >= 1) out.push(n)
  }
  return out
}

/** Every applicable text limit for the element (self before ancestors),
 *  or null when the selector no longer resolves. */
export function templateMaxLengthsOf(html: string, selector: string): number[] | null {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let el: Element | null
  try {
    el = doc.querySelector(selector)
  } catch {
    return null
  }
  if (!el) return null
  const chain: TemplateAttrLevel[] = []
  for (let cur: Element | null = el; cur && cur !== doc.documentElement; cur = cur.parentElement) {
    chain.push({
      hasLocked: cur.hasAttribute('data-od-locked'),
      hasId: cur.hasAttribute('data-od-id'),
      colors: cur.hasAttribute('data-od-allowed-colors') ? (cur.getAttribute('data-od-allowed-colors') ?? '') : null,
      maxLength: cur.hasAttribute('data-od-max-length') ? (cur.getAttribute('data-od-max-length') ?? '') : null,
      tag: (cur.tagName ?? '').toLowerCase(),
      ns: cur.namespaceURI ?? '',
      role: cur.hasAttribute('data-od-id') ? (cur.getAttribute('data-od-role') ?? '') : '',
    })
  }
  return templateMaxLengthsForChain(chain)
}
