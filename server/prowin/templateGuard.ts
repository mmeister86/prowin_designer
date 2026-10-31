import { parse as parseDocument } from 'parse5'
import type { Canvas } from '../../shared/types.ts'
import {
  findDuplicateTemplateIds,
  parseTemplateField,
  templateFieldSignature,
  validateTemplateField,
  type TemplateField,
} from '../../shared/prowin/templateAttributes.ts'
import { canvasCapabilities, CreatorPermissionError } from './permissions.ts'

/** 400 for invalid or duplicate template metadata, for every role (TASK-29). */
export class TemplateMetaError extends Error {
  readonly status = 400
}

// Minimal structural view of the parse5 tree; the real parser owns tokenizing.
interface TreeAttr {
  name: string
  value: string
  namespace?: string
  prefix?: string
}
interface TreeParent {
  childNodes: TreeNode[]
}
interface TreeElement extends TreeParent {
  nodeName: string
  tagName: string
  namespaceURI: string
  attrs: TreeAttr[]
  content?: TreeParent
}
interface TreeNode extends TreeParent {
  nodeName: string
  value?: string
  data?: string
  name?: string
  publicId?: string
  systemId?: string
}

// Full-document parse: html/head/body wrappers and the doctype survive, so their
// changes compare unequal. Fragments are wrapped symmetrically (empty
// html/head/body), keeping fragment saves equivalent.
function parse(html: string): TreeParent {
  return parseDocument(html) as unknown as TreeParent
}

function isElement(node: TreeNode): node is TreeNode & TreeElement {
  return node.nodeName !== '#text' && node.nodeName !== '#comment' && 'tagName' in node
}

/** Template contents live in a separate fragment; traverse them like children. */
function childrenOf(parent: TreeParent | TreeNode): TreeNode[] {
  if (isElement(parent as TreeNode) && (parent as TreeElement).tagName === 'template') {
    const content = (parent as TreeElement).content
    if (content) return content.childNodes
  }
  return (parent as TreeParent).childNodes ?? []
}

function attrMap(element: TreeElement): Map<string, string> {
  return new Map(element.attrs.filter((attr) => !attr.namespace).map((attr) => [attr.name, attr.value]))
}

function attrKey(attr: TreeAttr): string {
  return `${attr.namespace ?? ''}\0${attr.prefix ?? ''}\0${attr.name}`
}

function fieldOf(node: TreeNode): { field: TemplateField; element: TreeElement } | null {
  if (!isElement(node)) return null
  const field = parseTemplateField(attrMap(node))
  return field ? { field, element: node } : null
}

interface FieldNode {
  field: TemplateField
  signature: string
  element: TreeElement
  ancestors: TemplateField[]
  text: string
}

function fullText(element: TreeElement): string {
  let text = ''
  const walk = (parent: TreeParent | TreeNode): void => {
    for (const child of childrenOf(parent)) {
      if (child.nodeName === '#text') text += child.value ?? ''
      else if (isElement(child)) walk(child)
    }
  }
  walk(element)
  return text
}

function collectFields(root: TreeParent): FieldNode[] {
  const fields: FieldNode[] = []
  const walk = (parent: TreeParent | TreeNode, ancestors: TemplateField[]): void => {
    for (const child of childrenOf(parent)) {
      if (!isElement(child)) continue
      const found = fieldOf(child)
      if (found) {
        const ancestorsAndSelf = [...ancestors, found.field]
        fields.push({
          field: found.field,
          signature: templateFieldSignature(found.field),
          element: found.element,
          ancestors,
          text: fullText(found.element),
        })
        walk(child, ancestorsAndSelf)
      } else {
        walk(child, ancestors)
      }
    }
  }
  walk(root, [])
  return fields
}

/** True when any element carries one of the six template attributes. */
export function hasTemplateFields(html: string): boolean {
  return collectFields(parse(html)).length > 0
}

/** Duplicate or invalid candidate metadata fails for everyone, preserving TASK-29 German messages. */
function assertValidTemplateMeta(nextFields: FieldNode[]): void {
  const duplicates = findDuplicateTemplateIds(nextFields.map((entry) => entry.field))
  if (duplicates.length > 0) throw new TemplateMetaError(`Doppelte Template-ID "${duplicates[0]}".`)
  for (const entry of nextFields) {
    const errors = validateTemplateField(entry.field)
    if (errors.length > 0) throw new TemplateMetaError(errors[0]!)
  }
}

function canonAttrValue(name: string, value: string): string {
  // `data-od-locked`, `data-od-locked=""` and `data-od-locked="true"` are equivalent.
  return name === 'data-od-locked' ? '' : value
}

function attrsEqual(a: TreeElement, b: TreeElement): boolean {
  if (a.attrs.length !== b.attrs.length) return false
  const right = new Map(b.attrs.map((attr) => [attrKey(attr), attr.value]))
  return a.attrs.every((attr) => {
    const value = right.get(attrKey(attr))
    return value !== undefined && canonAttrValue(attr.name, value) === canonAttrValue(attr.name, attr.value)
  })
}

/** Exact comparison: tag, namespace, canonical attrs, text and comments verbatim. */
function equalNodes(a: TreeNode, b: TreeNode): boolean {
  if (a.nodeName !== b.nodeName) return false
  if (a.nodeName === '#text') return (a.value ?? '') === (b.value ?? '')
  if (a.nodeName === '#comment') return (a.data ?? '') === (b.data ?? '')
  if (a.nodeName === '#documentType') {
    return a.name === b.name && (a.publicId ?? '') === (b.publicId ?? '') && (a.systemId ?? '') === (b.systemId ?? '')
  }
  if (!isElement(a) || !isElement(b)) return a.nodeName === b.nodeName
  if (a.tagName !== b.tagName || a.namespaceURI !== b.namespaceURI || !attrsEqual(a, b)) return false
  const aChildren = childrenOf(a)
  const bChildren = childrenOf(b)
  return aChildren.length === bChildren.length && aChildren.every((child, i) => equalNodes(child, bChildren[i]!))
}

const SAFE_INLINE = new Set(['br', 'b', 'strong', 'i', 'em', 'u', 'span'])
const SAFE_TYPOGRAPHY = new Set([
  'font-family',
  'font-size',
  'font-weight',
  'font-style',
  'text-align',
  'line-height',
  'letter-spacing',
])
const COLOR_PROPS = new Set(['color', 'background-color', 'fill', 'stroke', 'border-color'])

function isTypographyOnly(prop: string, value: string): boolean {
  if (SAFE_TYPOGRAPHY.has(prop)) return true
  // text-decoration is a color-bearing shorthand; allow its non-color keywords only.
  return (
    prop === 'text-decoration' &&
    value
      .split(/\s+/)
      .every((part) => /^(none|underline|overline|line-through|solid|double|dotted|dashed|wavy)$/.test(part))
  )
}

interface EditCtx {
  chain: TemplateField[]
  image: boolean
}

function isEditableInline(element: TreeElement, ctx: EditCtx): boolean {
  return (
    element.namespaceURI === 'http://www.w3.org/1999/xhtml' &&
    (SAFE_INLINE.has(element.tagName) || (ctx.image && element.tagName === 'img'))
  )
}

function isConstrained(ctx: EditCtx): boolean {
  return ctx.chain.some((field) => field.allowedColors.length > 0)
}

/** Unknown presentation, including legacy CSS shorthands, may carry color;
 *  only typography-only styles are provably removable without a cascade. */
function subtreeHasProtectedColor(node: TreeNode): boolean {
  if (!isElement(node)) return false
  const element = node as TreeElement
  for (const attr of element.attrs) {
    if (attr.name === 'style') {
      const declarations = parseStyle(attr.value)
      if (!declarations) return true
      for (const [prop, value] of declarations) {
        if (!isTypographyOnly(prop, value)) return true
      }
    } else if (attr.name === 'class' || attr.name === 'id') {
      return true
    }
  }
  return childrenOf(node).some(subtreeHasProtectedColor)
}

function parseStyle(style: string): Map<string, string> | null {
  // Comments, backslash escapes and malformed declarations never validate as changed styles.
  if (style.includes('/*') || style.includes('*/') || style.includes('\\')) return null
  const declarations = new Map<string, string>()
  for (const part of style.split(';')) {
    const text = part.trim()
    if (text === '') continue
    const colon = text.indexOf(':')
    if (colon < 0) return null
    const prop = text.slice(0, colon).trim().toLowerCase()
    // Keep priority/fallback declarations from disappearing in the Map.
    if (declarations.has(prop)) return null
    declarations.set(prop, text.slice(colon + 1).trim())
  }
  return declarations
}

function assertColorAllowed(value: string, ctx: EditCtx): void {
  const constrained = ctx.chain.filter((field) => field.allowedColors.length > 0)
  if (constrained.length === 0) return
  // Exact token reference without fallback; must satisfy every applicable ancestor list.
  const token = /^var\(--([A-Za-z0-9_-]+)\)$/.exec(value)?.[1]
  if (!token || !constrained.every((field) => field.allowedColors.includes(token))) {
    throw new CreatorPermissionError()
  }
}

function assertStyleDeclaration(prop: string, value: string, ctx: EditCtx): void {
  if (prop.startsWith('--')) throw new CreatorPermissionError()
  if (/!important/i.test(value) || /url\s*\(/i.test(value)) throw new CreatorPermissionError()
  if (isTypographyOnly(prop, value) || (prop === 'text-decoration' && !isConstrained(ctx))) return
  if (COLOR_PROPS.has(prop)) {
    assertColorAllowed(value, ctx)
    return
  }
  throw new CreatorPermissionError()
}

function assertStyleChange(oldStyle: string | undefined, newStyle: string, ctx: EditCtx): void {
  const next = parseStyle(newStyle)
  if (!next) throw new CreatorPermissionError()
  const prev = oldStyle === undefined ? new Map<string, string>() : parseStyle(oldStyle)
  if (!prev) {
    // A legacy malformed style stays resavable unchanged, but any change under
    // a color constraint is fail-closed: the cascade cannot be evaluated.
    if (isConstrained(ctx)) throw new CreatorPermissionError()
  } else {
    for (const [prop, value] of prev) {
      // Unknown legacy properties may include color-bearing shorthands.
      if (!next.has(prop) && !isTypographyOnly(prop, value) && isConstrained(ctx)) {
        throw new CreatorPermissionError()
      }
    }
  }
  for (const [prop, value] of next) {
    // Unchanged declarations are preserved rather than newly forbidden.
    if (prev?.get(prop) !== value) assertStyleDeclaration(prop, value, ctx)
  }
}

function assertSafeNew(node: TreeNode, ctx: EditCtx): void {
  if (!isElement(node)) return
  if (!isEditableInline(node, ctx)) {
    throw new CreatorPermissionError()
  }
  for (const attr of node.attrs) {
    if (attr.name === 'style') assertStyleChange(undefined, attr.value, ctx)
    else if (!(ctx.image && node.tagName === 'img' && (attr.name === 'src' || attr.name === 'alt'))) {
      throw new CreatorPermissionError()
    }
  }
  for (const child of childrenOf(node)) assertSafeNew(child, ctx)
}

/** Same-tag element pair in an editable region: attrs diffed, children recursed. */
function assertSameTagChange(run: TemplateRun, prev: TreeElement, next: TreeElement, ctx: EditCtx): void {
  const prevAttrs = new Map(prev.attrs.map((attr) => [attrKey(attr), attr.value]))
  for (const attr of next.attrs) {
    const old = prevAttrs.get(attrKey(attr))
    if (old === attr.value) continue
    if (attr.name === 'style') {
      assertStyleChange(old, attr.value, ctx)
    } else if (attr.name === 'src' || attr.name === 'alt') {
      if (!(ctx.image && next.tagName === 'img')) throw new CreatorPermissionError()
    } else if (attr.name.startsWith('on') || attr.name.startsWith('data-od-')) {
      // Event attributes and nested metadata are frozen: additions and value
      // changes are rejected (lock-presence spellings compare canonically),
      // removals shrink attack surface and stay allowed.
      if (old === undefined || canonAttrValue(attr.name, old) !== canonAttrValue(attr.name, attr.value)) {
        throw new CreatorPermissionError()
      }
    } else {
      // Added or changed classes/ids/etc. could smuggle overlay styling; removals are safe.
      throw new CreatorPermissionError()
    }
  }
  if (isConstrained(ctx)) {
    // Without a cascade engine, dropping presentation that could resolve into
    // color exposes an unvalidated inherited value: fail-closed under an
    // allowed-colors constraint. Handler/metadata and src/alt removals stay
    // allowed (field-root metadata removal is already rejected upstream).
    const nextAttrs = new Map(next.attrs.map((attr) => [attrKey(attr), attr.value]))
    for (const attr of prev.attrs) {
      if (nextAttrs.has(attrKey(attr))) continue
      if (attr.name === 'style') {
        const declarations = parseStyle(attr.value)
        if (!declarations || [...declarations].some(([prop, value]) => !isTypographyOnly(prop, value))) {
          throw new CreatorPermissionError()
        }
      } else if (
        attr.name === 'src' ||
        attr.name === 'alt' ||
        attr.name.startsWith('on') ||
        attr.name.startsWith('data-od-')
      ) {
        continue
      } else {
        throw new CreatorPermissionError()
      }
    }
  }
  compareEditableChildren(run, prev, next, ctx)
}

function compareEditableChildren(
  run: TemplateRun,
  prev: TreeParent | TreeNode,
  next: TreeParent | TreeNode,
  ctx: EditCtx,
): void {
  const prevChildren = childrenOf(prev)
  const nextChildren = childrenOf(next)
  for (let i = 0; i < Math.max(prevChildren.length, nextChildren.length); i++) {
    const a = prevChildren[i]
    const b = nextChildren[i]
    if (!a) {
      assertSafeNew(b!, ctx)
      continue
    }
    if (!b) {
      // Deleting non-field content is safe; field roots must be retained.
      if (fieldOf(a)) throw new CreatorPermissionError()
      if (isElement(a) && !isEditableInline(a, ctx)) throw new CreatorPermissionError()
      // Deleting a color-bearing wrapper under a color constraint is
      // fail-closed even with its text: the cascade is not evaluated.
      if (isConstrained(ctx) && subtreeHasProtectedColor(a)) throw new CreatorPermissionError()
      continue
    }
    compareEditableNode(run, a, b, ctx)
  }
}

function compareEditableNode(run: TemplateRun, a: TreeNode, b: TreeNode, ctx: EditCtx): void {
  const aField = fieldOf(a)
  const bField = fieldOf(b)
  if (aField || bField) {
    if (!aField || !bField || aField.field.id !== bField.field.id) throw new CreatorPermissionError()
    compareField(run, aField.field, aField.element, bField.element, ctx.chain)
    return
  }
  if (equalNodes(a, b)) return
  // Existing legacy scripts/styles (and other non-editable elements) are frozen,
  // not made writable merely because their tag existed in the baseline.
  if (isElement(a) && !isEditableInline(a, ctx)) throw new CreatorPermissionError()
  if (isElement(a) && isElement(b) && a.tagName === b.tagName && a.namespaceURI === b.namespaceURI) {
    assertSameTagChange(run, a, b, ctx)
    return
  }
  // Replacing or unwrapping a color-bearing wrapper under a color constraint
  // leaves surviving content on unvalidated inheritance: fail-closed.
  if (isConstrained(ctx) && subtreeHasProtectedColor(a)) throw new CreatorPermissionError()
  if (isElement(b)) assertSafeNew(b, ctx)
}

/** A locked subtree is frozen wholesale; an unlocked field keeps its root contract with editable interior. */
function compareField(
  run: TemplateRun,
  field: TemplateField,
  prev: TreeElement,
  next: TreeElement,
  ancestors: TemplateField[],
): void {
  if (field.locked || prev.tagName === 'script' || prev.tagName === 'style') {
    if (!equalNodes(prev, next)) throw new CreatorPermissionError()
    return
  }
  assertSameTagChange(run, prev, next, { chain: [...ancestors, field], image: field.role === 'image' })
}

function compareStrictChildren(run: TemplateRun, prev: TreeParent | TreeNode, next: TreeParent | TreeNode): void {
  const prevChildren = childrenOf(prev)
  const nextChildren = childrenOf(next)
  if (prevChildren.length !== nextChildren.length) throw new CreatorPermissionError()
  for (let i = 0; i < prevChildren.length; i++) compareStrictNode(run, prevChildren[i]!, nextChildren[i]!)
}

/** Outside editable fields structure is frozen, but field subtrees compare via their own rules. */
function compareStrictNode(run: TemplateRun, a: TreeNode, b: TreeNode): void {
  const aField = fieldOf(a)
  const bField = fieldOf(b)
  if (aField || bField) {
    if (!aField || !bField || aField.field.id !== bField.field.id) throw new CreatorPermissionError()
    compareField(run, aField.field, aField.element, bField.element, run.ancestors.get(aField.field.id) ?? [])
    return
  }
  if (!isElement(a) || !isElement(b)) {
    if (!equalNodes(a, b)) throw new CreatorPermissionError()
    return
  }
  if (a.tagName !== b.tagName || a.namespaceURI !== b.namespaceURI || !attrsEqual(a, b)) {
    throw new CreatorPermissionError()
  }
  compareStrictChildren(run, a, b)
}

interface TemplateRun {
  ancestors: Map<string, TemplateField[]>
}

/**
 * Parser-backed write guard: the stored HTML is the trusted baseline, trusted
 * server permission context supplies `manageLocks`. Invalid or duplicate
 * metadata is 400 for everyone; unauthorized modifications are 403.
 */
export function assertTemplateWrite(canvas: Canvas, prevHtml: string, nextHtml: string): void {
  const prevDocument = parse(prevHtml)
  const nextDocument = parse(nextHtml)
  const prevFields = collectFields(prevDocument)
  const nextFields = collectFields(nextDocument)
  assertValidTemplateMeta(nextFields)
  // No template fields on either side: free edit for everyone, no capability lookup.
  if (prevFields.length === 0 && nextFields.length === 0) return
  if (!canvasCapabilities(canvas).manageLocks) {
    if (prevFields.length === 0) {
      if (nextFields.length > 0) throw new CreatorPermissionError()
      return
    }
    const nextById = new Map(nextFields.map((entry) => [entry.field.id, entry]))
    if (prevFields.length !== nextFields.length) throw new CreatorPermissionError()
    for (const entry of prevFields) {
      const next = nextById.get(entry.field.id)
      if (!next || next.signature !== entry.signature) throw new CreatorPermissionError()
      if (
        next.ancestors.map((ancestor) => ancestor.id).join('/') !==
        entry.ancestors.map((ancestor) => ancestor.id).join('/')
      ) {
        throw new CreatorPermissionError()
      }
      if (next.element.tagName !== entry.element.tagName) throw new CreatorPermissionError()
    }
    // Changed text is checked against every applicable stored length constraint in
    // decoded Unicode codepoints; unchanged legacy over-limit content stays resavable.
    const nextText = new Map(nextFields.map((entry) => [entry.field.id, entry.text]))
    for (const entry of prevFields) {
      if (entry.field.maxLength == null) continue
      const text = nextText.get(entry.field.id)!
      if (text !== entry.text && [...text].length > entry.field.maxLength) throw new CreatorPermissionError()
    }
    const run: TemplateRun = { ancestors: new Map(prevFields.map((entry) => [entry.field.id, entry.ancestors])) }
    if (!prevDocument.childNodes.some((node) => node.nodeName === '#documentType')) {
      const doctype = nextDocument.childNodes.find((node) => node.nodeName === '#documentType')
      // The production editor adds this to stored fragments; only that additive
      // standard doctype is equivalent, not removal/replacement of an existing one.
      if (doctype?.name === 'html' && !doctype.publicId && !doctype.systemId) {
        nextDocument.childNodes = nextDocument.childNodes.filter((node) => node !== doctype)
      }
    }
    compareStrictChildren(run, prevDocument, nextDocument)
  }
}

/** Non-creator deletion of a template-bearing frame is forbidden. */
export function assertTemplateDelete(canvas: Canvas, html: string): void {
  if (hasTemplateFields(html) && !canvasCapabilities(canvas).manageLocks) throw new CreatorPermissionError()
}
