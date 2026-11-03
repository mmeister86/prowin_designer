/**
 * The parent's line to a frame's sandboxed document. FrameView registers
 * each iframe's window when its runtime reports ready; anything else on the
 * page (the element properties panel) reaches the live document through
 * these calls instead of holding an iframe ref of its own.
 */
import type { TemplateElementPolicy } from '../prowin/templatePolicy'

/** The runtime's summary of one element: computed styles resolved to what
 *  the Design panel shows, plus the inline styles the element already carries.
 *  Mirrors `inspect()` in frameRuntime.ts — keep the two in lockstep. */
export interface ElementInfo {
  tag: string
  id: string
  classes: string[]
  parent: {
    tag: string
    id: string
    className: string
    display: string
    flexDirection: string
    writingMode: string
  } | null
  /** Nearest ancestor with a layout box, skipping display: contents wrappers. */
  layoutParent?: { display: string; flexDirection: string; writingMode: string } | null
  /** 1-based place among the parent's children, and how many there are */
  index: number
  count: number
  inline: Record<string, string>
  hasText: boolean
  rect: { x: number; y: number; width: number; height: number }
  /** Rendered bounds relative to the parent's border box, in frame pixels. */
  geometry: {
    x: number
    y: number
    rotation: number | null
    scaleX: number
    scaleY: number
    enabled: boolean
    canAlign: boolean
  }
  /** rendered box over layout box: the element's own and inherited scale */
  scale: { x: number; y: number }
  position: string
  display: string
  flexDirection: string
  flexWrap: string
  justifyContent: string
  alignItems: string
  writingMode: string
  width: number | null
  height: number | null
  widthValue: string
  heightValue: string
  flexGrow: number
  boxSizing: string
  /** Unrounded computed padding and border sums, for content-box sizing. */
  boxExtras: { width: number; height: number }
  aspectRatio: string
  naturalAspectRatio: number | null
  minWidth: string
  rowGap: number | null
  columnGap: number | null
  padding: [number | null, number | null, number | null, number | null]
  opacity: number | null
  visibility: string
  clipsContent: boolean
  backgroundColor: string
  /** top, right, bottom, left */
  borderWidths: [number | null, number | null, number | null, number | null]
  /** style and colour of the first side that draws */
  borderStyle: string
  borderColor: string
  borderRadius: number | null
  color: string
  fontSize: number | null
  fontWeight: string
  fontFamily: string
  /** Font faces declared by this frame, including linked web fonts. */
  fontFamilies: string[]
  textAlign: string
  direction: string
  /** live template policy from the runtime's own document (TASK-31): what
   *  the stored-HTML policy cannot see — script-generated elements and
   *  script-added locks. Mirrors `templatePolicy()` in frameRuntime.ts. */
  policy: TemplateElementPolicy
}

/** Inline style changes: a null or empty value removes the property. */
export type StylePatch = Record<string, string | null>

export type GeometryEdit =
  | { kind: 'position'; axis: 'x' | 'y'; value: number }
  | { kind: 'align'; axis: 'x' | 'y'; edge: 'start' | 'center' | 'end' }
  | { kind: 'rotate'; value: number }
  | { kind: 'flip'; axis: 'x' | 'y' }

export async function editElementGeometry(
  frameId: string,
  selector: string,
  edit: GeometryEdit,
): Promise<ElementInfo | null> {
  return infoOf(await requestFrame(frameId, 'doop:geometry', { selector, edit }))
}

/* A request `doop:<name>` is answered by `doop:<name>-result` carrying the
   same reqId — the convention every runtime request already follows. */
interface PendingAsk {
  win: Window
  replyType: string
  resolve: (reply: Record<string, unknown>) => void
}

const REPLY_TIMEOUT_MS = 2000

const windows = new Map<string, Window>()
const changeListeners = new Map<string, Set<(generation?: number, docToken?: number) => void>>()
const pending = new Map<number, PendingAsk>()
let nextReq = 0
let listening = false

function listen() {
  if (listening) return
  listening = true
  window.addEventListener('message', (ev: MessageEvent) => {
    const data = ev.data as { type?: string; reqId?: number; generation?: number; docToken?: number } | null
    if (data?.type === 'doop:frame-updated') {
      const generation =
        typeof data.generation === 'number' && Number.isFinite(data.generation) ? data.generation : undefined
      const docToken = typeof data.docToken === 'number' && Number.isFinite(data.docToken) ? data.docToken : undefined
      for (const [frameId, win] of windows) {
        if (ev.source === win) changeListeners.get(frameId)?.forEach((cb) => cb(generation, docToken))
      }
      return
    }
    if (typeof data?.type !== 'string' || typeof data.reqId !== 'number') return
    const ask = pending.get(data.reqId)
    /* the reply must come from the window that was asked — request ids are
       predictable, so another frame's script could otherwise answer for it */
    if (!ask || ask.replyType !== data.type || ev.source !== ask.win) return
    pending.delete(data.reqId)
    ask.resolve(data)
  })
}

export function registerFrameWindow(frameId: string, win: Window) {
  windows.set(frameId, win)
  changeListeners.get(frameId)?.forEach((cb) => cb())
}

export function unregisterFrameWindow(frameId: string, win: Window) {
  if (windows.get(frameId) === win) windows.delete(frameId)
}

/** Re-read after the runtime registers, renders HTML, or loads font faces.
 *  Store updates can precede the frame's throttled render. The callback
 *  receives the runtime's rendered-document generation when known, plus the
 *  expected-document token of the rendered HTML — only a token matching the
 *  currently desired HTML proves the wanted document actually rendered. */
export function onFrameChange(frameId: string, cb: (generation?: number, docToken?: number) => void): () => void {
  listen()
  const set = changeListeners.get(frameId) ?? new Set()
  set.add(cb)
  changeListeners.set(frameId, set)
  return () => {
    set.delete(cb)
    if (set.size === 0) changeListeners.delete(frameId)
  }
}

/** Post `{ type, ...payload }` to the frame and resolve with its reply, or
 *  null when the frame is not registered or never answers. */
export function requestFrame(
  frameId: string,
  type: `doop:${string}`,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const win = windows.get(frameId)
  if (!win) return Promise.resolve(null)
  listen()
  nextReq += 1
  const reqId = nextReq
  return new Promise((resolve) => {
    pending.set(reqId, { win, replyType: `${type}-result`, resolve })
    win.postMessage({ ...payload, type, reqId }, '*')
    /* a frame that unloads mid-request would leave the promise hanging */
    window.setTimeout(() => {
      if (pending.delete(reqId)) resolve(null)
    }, REPLY_TIMEOUT_MS)
  })
}

/* the runtime's replies carry the element summary under `info` */
function infoOf(reply: Record<string, unknown> | null): ElementInfo | null {
  return reply && typeof reply.info === 'object' ? (reply.info as ElementInfo | null) : null
}

/** Computed properties of the element, or null when the selector no longer resolves. */
export async function inspectElement(frameId: string, selector: string): Promise<ElementInfo | null> {
  return infoOf(await requestFrame(frameId, 'doop:inspect', { selector }))
}

/** Write inline styles onto the element. The runtime saves the edited
 *  document through the frame's normal edit path and answers with the
 *  element's fresh properties. */
export async function styleElement(frameId: string, selector: string, styles: StylePatch): Promise<ElementInfo | null> {
  return infoOf(await requestFrame(frameId, 'doop:style', { selector, styles }))
}

/** Preview a whole scrub locally, then save once or restore its original CSS. */
export async function styleGesture(
  frameId: string,
  selector: string,
  phase: 'begin' | 'commit' | 'cancel',
): Promise<ElementInfo | null> {
  return infoOf(await requestFrame(frameId, 'doop:style-gesture', { selector, phase }))
}

/** Advisory safe-zone geometry: frame-local CSS px boxes for visible
 *  semantic elements, or null when the frame is not registered. Follows the
 *  same reqId + source-window convention as every other runtime request. */
export async function requestSafeZones(frameId: string): Promise<Record<string, unknown> | null> {
  return requestFrame(frameId, 'doop:safe-zones', {})
}
