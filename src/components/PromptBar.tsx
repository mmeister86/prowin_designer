import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useStore, type ComposerSend, type ComposerAttachment } from '../lib/store'
import { MAX_PROMPT_REFERENCES, validateImageFile } from '../lib/imageFiles'
import { api, errorMessage, type Allowance } from '../lib/api'
import { uploadImageFrames } from '../lib/frameClipboard'
import { isResidentLimit, meterText, useAllowance } from './TeamAllowance'
import { Button } from './ui/button'
import { Textarea } from './ui/textarea'
import { Note } from './ui/note'
import { Tooltip } from './ui/tooltip'
import { DoopMark } from './Logo'
import { ArrowUpIcon, AttachmentIcon, FrameIcon, XIcon } from './ui/icons'
import { LayerKindIcon } from './LayerKindIcon'
import { buildLayerTree, findLayer, layerName } from '../lib/layers'
import type { CardScope } from '../../shared/types'
import type { LayerKind } from '../lib/layers'

/**
 * The canvas's front door to the resident team: the prompt composer
 * docked to the bottom of the Agents tab. It queues a board card without
 * anyone having to discover the board first; the tasks it starts show up in
 * the list above it.
 *
 * Screenshots and images attach via the paperclip (or a paste into the
 * field); on send they land on the canvas as reference frames and the card
 * carries their ids so the agent looks at them before designing.
 */

const MAX_ATTACHMENTS = MAX_PROMPT_REFERENCES
const EMPTY_ATTACHMENTS: ComposerAttachment[] = []
/** the scope chip's label is cut here so a long text node never eats the row */
const MAX_SCOPE_LABEL = 24
/** the field grows with the draft up to this many lines, then scrolls */
const MAX_COMPOSER_LINES = 6
/** a ⌘K older than this is ignored by a composer that mounts later */
const FOCUS_REQUEST_TTL_MS = 2000

interface ScopeChip {
  scope: CardScope
  /** what the chip reads: an element's "aside.rail", a frame's name */
  label: string
  kind: LayerKind | 'frame'
}

function clip(text: string): string {
  return text.length > MAX_SCOPE_LABEL ? `${text.slice(0, MAX_SCOPE_LABEL - 1).trimEnd()}…` : text
}

/** "frame:element" for an element scope, the frame id alone for a frame one */
function scopeKey(scope: CardScope): string {
  return scope.selector ? `${scope.frameId}:${scope.selector}` : scope.frameId
}

/** How long after a submit a newly created frame still gets the camera. */
const FLY_WINDOW_MS = 3 * 60_000

let cancelPendingFlight: (() => void) | null = null

/**
 * After a submit, the first frame that wasn't on the canvas before gets a
 * camera flight — the deliverable must stream in on-screen, never somewhere
 * off-canvas the user has to go find. A store subscription rather than an
 * effect: the composer lives in a panel tab, and switching tabs (or closing
 * the panel) while the agent works must not cancel the flight. Leaving the
 * canvas does: another canvas's frames are all "new" to this watch, and a
 * flight there would land on something unrelated. A newer submit replaces
 * an older watch.
 */
function flyToNextFrame(canvasId: string, extraKnown: string[]) {
  cancelPendingFlight?.()
  const known = new Set([...(useStore.getState().canvas?.frames ?? []).map((f) => f.id), ...extraKnown])
  const unsubscribe = useStore.subscribe((s) => {
    /* null while a canvas loads — only a different canvas ends the watch */
    if (!s.canvas) return
    if (s.canvas.id !== canvasId) return stop()
    const arrived = s.canvas.frames.find((f) => !known.has(f.id))
    if (!arrived) return
    stop()
    s.requestFlyTo(arrived.id)
  })
  const timer = window.setTimeout(stop, FLY_WINDOW_MS)
  function stop() {
    unsubscribe()
    window.clearTimeout(timer)
    if (cancelPendingFlight === stop) cancelPendingFlight = null
  }
  cancelPendingFlight = stop
}

/** How long the "on it" confirmation stays up after a send. */
const SENT_NOTE_MS = 5000

function setSend(send: ComposerSend | null) {
  useStore.getState().setComposerSend(send)
}

/**
 * The send itself, detached from the component: the composer unmounts with
 * its tab, and a send that fails after the user switched away must still
 * report back when the tab returns. Progress and outcome go to the store;
 * the draft is cleared only once the card is queued, so a failure leaves
 * the text in place for a retry.
 */
async function sendPrompt(args: {
  canvasId: string
  text: string
  attachments: ComposerAttachment[]
  scope: CardScope | undefined
  allowance: Allowance | null
}): Promise<void> {
  const { canvasId, text, attachments, scope, allowance } = args
  const store = useStore.getState()
  if (store.composerSend?.status === 'busy') return
  const placement = {
    pageId: store.activePageId ?? `${canvasId}:page1`,
    center: {
      x: (window.innerWidth / 2 - store.viewport.x) / store.viewport.zoom,
      y: (window.innerHeight / 2 - store.viewport.y) / store.viewport.zoom,
    },
  }
  setSend({ canvasId, status: 'busy' })
  /* known-doomed send: no free tasks and no model account. Open the wall
     up front instead of uploading attachments only to 403 — but confirm
     against the server first, since the cached allowance can be stale
     (an account connected in another tab). The server enforces either
     way, so an unreachable check just falls through. Text stays in place. */
  if (allowance && !allowance.localAgent && allowance.used >= allowance.limit) {
    const fresh = await api.agentAllowance().catch(() => null)
    if (fresh && !fresh.localAgent && fresh.used >= fresh.limit) {
      store.setLimitWall(true)
      setSend(null)
      return
    }
  }
  try {
    /* attachments first: each becomes a reference frame on the canvas, and
       the card carries the frame ids so the agent views them before
       designing. Known-ids include them so the camera saves its flight for
       the agent's deliverable, not the user's own screenshots. */
    const files = attachments.flatMap((a) => (a.kind === 'file' ? [a.file] : []))
    const uploads = files.length ? await uploadImageFrames(canvasId, files, 'Angehängtes Bild', placement) : []
    const converted = attachments.map((a) => {
      if (a.kind !== 'file') return a
      const result = uploads.find((r) => r.file === a.file && 'frame' in r)
      return result && 'frame' in result ? { kind: 'frame' as const, frameId: result.frame.id } : a
    })
    store.setComposerAttachments(canvasId, converted)
    const failed = uploads.find((r) => 'error' in r)
    if (failed && 'error' in failed) {
      setSend({ canvasId, status: 'error', message: failed.error, at: Date.now() })
      return
    }
    const referenceIds = [...new Set(converted.flatMap((a) => (a.kind === 'frame' ? [a.frameId] : [])))]
    await api.addCard(canvasId, text, ['doop'], referenceIds, scope)
    if (useStore.getState().canvas?.id === canvasId) flyToNextFrame(canvasId, referenceIds)
    store.setComposerDraft(canvasId, '')
    store.setComposerAttachments(canvasId, [])
    const sent: ComposerSend = { canvasId, status: 'sent', at: Date.now() }
    setSend(sent)
    window.setTimeout(() => {
      if (useStore.getState().composerSend === sent) setSend(null)
    }, SENT_NOTE_MS)
  } catch (err) {
    if (isResidentLimit(err)) {
      store.setLimitWall(true)
      setSend(null)
    } else {
      console.error(err)
      setSend({
        canvasId,
        status: 'error',
        message: errorMessage(err, 'Deine Anfrage konnte nicht gesendet werden. Versuche es erneut.'),
        at: Date.now(),
      })
    }
  } finally {
    /* every meter on screen re-reads the allowance, mounted or not */
    useStore.getState().allowanceChanged()
  }
}

/** Size the field to its draft, up to MAX_COMPOSER_LINES. */
function autosize(ta: HTMLTextAreaElement) {
  ta.style.height = 'auto'
  if (!ta.scrollHeight) return // not laid out (hidden, or a DOM without layout)
  const line = parseFloat(getComputedStyle(ta).lineHeight) || 20
  ta.style.height = `${Math.min(ta.scrollHeight, Math.round(line * MAX_COMPOSER_LINES))}px`
}

export function PromptBar({ canvasId }: { canvasId: string }) {
  const frames = useStore((s) => s.canvas?.frames)
  const selectedId = useStore((s) => s.selectedId)
  const selectedIds = useStore((s) => s.selectedIds)
  const attachments = useStore((s) => s.composerAttachments[canvasId] ?? EMPTY_ATTACHMENTS)
  const setAttachments = (next: ComposerAttachment[]) => useStore.getState().setComposerAttachments(canvasId, next)
  const missing = attachments.some(
    (a) => a.kind === 'frame' && !frames?.some((f) => f.id === a.frameId && f.canvasId === canvasId),
  )
  const selectedElement = useStore((s) => s.selectedElement)
  const focusAt = useStore((s) => s.composerFocusAt)
  const text = useStore((s) => s.composerDrafts[canvasId] ?? '')
  const setDraft = useStore((s) => s.setComposerDraft)
  /* this canvas's send only: another canvas's outcome is not ours to show */
  const send = useStore((s) => (s.composerSend?.canvasId === canvasId ? s.composerSend : null))
  const busy = send?.status === 'busy'
  const sent = send?.status === 'sent'
  const sendError = send?.status === 'error' ? send.message : null
  const { allowance } = useAllowance()
  /* the selection is the prompt's scope until the chip is dismissed — × or
     Esc drops it entirely, no stepping up to the frame. Keyed on the scope
     so a new selection brings the chip back. */
  const [dismissed, setDismissed] = useState<string | null>(null)
  const chip = useMemo<ScopeChip | null>(() => {
    const frame = frames?.find((f) => f.canvasId === canvasId && f.id === (selectedElement?.frameId ?? selectedId))
    if (!frame) return null
    if (attachments.some((a) => a.kind === 'frame' && a.frameId === frame.id)) return null
    const scope: CardScope = selectedElement
      ? { frameId: frame.id, selector: selectedElement.selector }
      : { frameId: frame.id }
    if (dismissed === scopeKey(scope)) return null
    if (!selectedElement) return { scope, label: frame.name, kind: 'frame' }
    const node = findLayer(buildLayerTree(frame.html), selectedElement.selector)
    return {
      scope,
      label: node ? layerName(node) : (selectedElement.selector.split(' > ').at(-1) ?? 'Element'),
      kind: node?.kind ?? 'box',
    }
  }, [frames, selectedId, selectedElement, dismissed, attachments, canvasId])
  /* attachment slips (too big, too many) — local and brief, unlike a failed
     send, which the store keeps until the draft changes */
  const [attachError, setAttachError] = useState<string | null>(null)
  const error = attachError ?? sendError
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (inputRef.current) autosize(inputRef.current)
  }, [text])

  /* ⌘K: the page has opened the panel on this tab — take the keyboard. The
     request is a timestamp so a composer mounted later (a tab switch some
     minutes on) does not re-run an old one. */
  useEffect(() => {
    if (focusAt && Date.now() - focusAt < FOCUS_REQUEST_TTL_MS) inputRef.current?.focus()
  }, [focusAt])

  function showError(msg: string) {
    setAttachError(msg)
    window.setTimeout(() => setAttachError(null), 5000)
  }

  function addFiles(list: Iterable<File>) {
    const state = useStore.getState()
    if (state.composerSend?.canvasId === canvasId && state.composerSend.status === 'busy') return
    const images = [...list]
    if (!images.length) return
    const invalid = images.map(validateImageFile).find(Boolean)
    const fitting = images.filter((f) => !validateImageFile(f))
    const current = state.composerAttachments[canvasId] ?? []
    const room = MAX_ATTACHMENTS - current.length
    if (invalid) showError(invalid)
    else if (fitting.length > room) showError(`Bis zu ${MAX_ATTACHMENTS} Bilder pro Anfrage`)
    const ok = fitting.slice(0, Math.max(0, room))
    if (ok.length)
      setAttachments([
        ...current,
        ...ok.map((file) => ({ kind: 'file' as const, file, preview: URL.createObjectURL(file) })),
      ])
  }

  function removeAttachment(attachment: ComposerAttachment) {
    const state = useStore.getState()
    if (state.composerSend?.canvasId === canvasId && state.composerSend.status === 'busy') return
    setAttachments((state.composerAttachments[canvasId] ?? []).filter((a) => a !== attachment))
  }

  async function submit(prompt: string) {
    const clean = prompt.trim()
    if (!clean || busy || missing) return
    await sendPrompt({ canvasId, text: clean, attachments: [...attachments], scope: chip?.scope, allowance })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape' && chip) {
      e.preventDefault()
      setDismissed(scopeKey(chip.scope))
      return
    }
    /* Enter sends, ⇧Enter breaks the line; an Enter that commits an IME
       composition is neither */
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      void submit(text)
    }
  }

  return (
    <div className="flex shrink-0 flex-col gap-1.5 border-t border-line-soft bg-surface px-3 pt-2.5 pb-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {attachments.map((a) => {
            const frame = a.kind === 'frame' ? frames?.find((f) => f.id === a.frameId && f.canvasId === canvasId) : null
            const name = a.kind === 'file' ? a.file.name : (frame?.name ?? 'Quelle fehlt')
            return (
              <div
                key={a.kind === 'file' ? a.preview : a.frameId}
                className="relative w-16 overflow-hidden rounded-[7px] bg-paper shadow-ring"
                title={`Referenz: ${name}`}
              >
                {a.kind === 'frame' && !frame ? (
                  <span>Quelle fehlt</span>
                ) : (
                  <img
                    src={a.kind === 'file' ? a.preview : `/i/${a.frameId}.png`}
                    alt={`Referenz: ${name}`}
                    className="block h-11 w-full object-cover"
                  />
                )}
                <span className="block truncate px-1 text-[10px]">{name}</span>
                <Button
                  variant="bare"
                  className="absolute right-0.5 top-0.5 size-4 justify-center rounded-full bg-black/55 p-0 text-xs leading-none text-white hover:bg-black/70 hover:text-white"
                  aria-label={`Referenz ${name} entfernen`}
                  disabled={busy}
                  onClick={() => removeAttachment(a)}
                >
                  ×
                </Button>
              </div>
            )
          })}
        </div>
      )}
      {attachments.length > 0 && (
        <p className="text-[11px] text-ink-soft">
          Referenzbilder werden vom KI-Agenten visuell ausgewertet; beim Server-Agenten über Requesty (EU). Kontaktdaten
          im Bild werden nicht automatisch entfernt. Lade nur Bilder hoch, die Du dafür verwenden darfst.
        </p>
      )}
      <form
        className="rounded-[10px]"
        onSubmit={(e) => {
          e.preventDefault()
          void submit(text)
        }}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files ?? [])
            e.target.value = '' // same file can be re-picked after removal
          }}
        />
        {chip && (
          <div className="mb-2 flex">
            <span
              className="flex h-6 min-w-0 max-w-full items-center gap-1.5 rounded-[6px] pr-1 pl-2 text-[12px] text-ink-soft shadow-ring"
              title={
                chip.kind === 'frame'
                  ? `Kontext: Zeichenfläche „${chip.label}“`
                  : `Kontext: ${chip.label} in dieser Zeichenfläche`
              }
            >
              <span className="flex-none text-ink-faint">
                {chip.kind === 'frame' ? <FrameIcon className="size-3.5" /> : <LayerKindIcon kind={chip.kind} />}
              </span>
              <span className="min-w-0 truncate">Bearbeitungsziel: {clip(chip.label)}</span>
              <Button
                variant="bare"
                className="size-4 flex-none justify-center rounded-full p-0 text-ink-faint hover:bg-paper-deep hover:text-ink"
                aria-label={
                  chip.kind === 'frame' ? 'Zeichenfläche als Kontext entfernen' : 'Element als Kontext entfernen'
                }
                disabled={busy}
                onClick={() => setDismissed(scopeKey(chip.scope))}
              >
                <XIcon className="size-3" aria-hidden />
              </Button>
            </span>
          </div>
        )}
        <Textarea
          ref={inputRef}
          variant="bare"
          rows={1}
          aria-label="Frag den Doop-Agenten"
          className="block overflow-y-auto px-0.5 text-[12.5px] leading-[1.45] placeholder:text-ink-ghost md:text-[12.5px]"
          value={text}
          disabled={busy}
          placeholder={
            chip
              ? chip.kind === 'frame'
                ? 'Was soll sich an dieser Zeichenfläche ändern…'
                : 'Was soll sich an diesem Element ändern…'
              : 'Bitte Doop, etwas zu gestalten…'
          }
          onKeyDown={onKeyDown}
          onChange={(e) => setDraft(canvasId, e.target.value)}
          onPaste={(e) => {
            const images = [...(e.clipboardData?.files ?? [])].filter((f) => f.type.startsWith('image/'))
            if (images.length) {
              e.preventDefault()
              addFiles(images)
            }
          }}
        />
        <div className="mt-2 flex items-center gap-1">
          <Button
            variant="bare"
            size="icon-sm"
            className="size-7 rounded-[7px] text-ink-faint hover:bg-paper-deep hover:text-ink"
            aria-label="Bilder anhängen"
            title="Screenshots oder Bilder anhängen"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            <AttachmentIcon className="size-3.5" />
          </Button>
          <Button
            variant="bare"
            disabled={busy || !(selectedIds.length || selectedId)}
            onClick={() =>
              useStore
                .getState()
                .addComposerReferences(canvasId, selectedIds.length ? selectedIds : selectedId ? [selectedId] : [])
            }
          >
            Auswahl als Referenz
          </Button>
          <span className="flex-1" />
          {/* the meter rides on the send button; a disabled button takes no
              pointer events, so the span under it is what the tooltip hangs on */}
          <Tooltip label={meterText(allowance) ?? 'Senden (Enter)'} side="top" align="end">
            <span
              className="inline-flex rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-faint"
              /* while the button is disabled the wrapper takes its tab stop,
                 so the meter can be reached and read without a pointer */
              tabIndex={busy || !text.trim() ? 0 : -1}
              aria-label={meterText(allowance) ?? undefined}
            >
              <Button
                variant="primary"
                size="icon-sm"
                className="size-7 rounded-full"
                type="submit"
                aria-label="Senden"
                disabled={busy || missing || !text.trim()}
              >
                {busy ? <span aria-hidden>…</span> : <ArrowUpIcon className="size-3.5" strokeWidth={1.6} />}
              </Button>
            </span>
          </Tooltip>
        </div>
      </form>
      {(error || sent) && (
        <div className="text-[11px] leading-[1.4]">
          {error ? (
            <Note tone="error" size="sm" className="text-[11px]">
              {error}
            </Note>
          ) : (
            <Note size="sm" className="text-[11px] text-ink-soft">
              <DoopMark size={11} /> Der Doop-Agent arbeitet daran – schau auf die Arbeitsfläche
            </Note>
          )}
        </div>
      )}
    </div>
  )
}
