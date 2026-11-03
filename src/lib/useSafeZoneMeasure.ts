import { useEffect, useRef, useState } from 'react'
import { onFrameChange, requestSafeZones } from './frameBridge'
import { safeZoneDocumentToken } from './safeZoneDocument'
import { validateSafeZoneReply, type SafeZoneBox, type SafeZoneStatus } from './safeZoneMeasure'

const REFRESH_MS = 150

/* Shared advisory measurement for the canvas overlay (FrameView) and the
   Inspector status (SafeZoneSection). One place owns the invalidation rules
   so both surfaces stay consistent:
   - the store's HTML can run ahead of the iframe's throttled render
     (editing and save-settling withhold it on purpose), so readiness is the
     parent's expected-document token matched against the runtime's
     last-rendered one — never a single effect transition or a generic
     same-document notification. While a different HTML is pending, no
     request fires and no reply is trusted; the surfaces stay unavailable
     until the render of the desired document is confirmed;
   - every render/change notification or measured-input change clears trusted
     boxes immediately; success/outlines return only for the latest rendered
     document generation stamped with the desired token, never for a
     superseded or malformed reply;
   - notifications coalesce into one delayed request (no polling, no loops —
     measuring never writes to either document);
   - while the tab is hidden no request fires and nothing trusted remains; a
     return refreshes. A late subscriber that missed the last render measures
     once and trusts only a reply stamped with the desired token. */
export function useSafeZoneMeasure(
  frame: { id: string; html: string; width: number; height: number },
  opts: { enabled: boolean },
): { boxes: SafeZoneBox[]; status: SafeZoneStatus } {
  const [boxes, setBoxes] = useState<SafeZoneBox[]>([])
  const [status, setStatus] = useState<SafeZoneStatus>('unavailable')
  const seq = useRef(0)
  const generation = useRef<number | null>(null)
  /* Expected-document identity: desired tracks the current frame.html,
     rendered tracks the runtime's last render notification (undefined while
     no render was ever observed for this frame), and dirty marks a desired
     HTML with no confirmed render yet. A reply stamped with any other token
     proves nothing about the current props. Dirty persists across
     disable/enable flips, visibility transitions and same-document
     notifications — only the render of the desired document clears it. A
     fresh subscription starts clean (a late subscriber with an already
     current document still measures); any HTML change after that dirties it
     until the matching render lands — even when the render notification
     overtakes this effect, which the change reconciles below. */
  const desiredDoc = useRef<number>(0)
  const renderedDoc = useRef<number | null | undefined>(undefined)
  const dirtyDoc = useRef(false)
  const prevHtml = useRef<string | null>(null)
  const timer = useRef<number | null>(null)
  const subscribedId = useRef<string | null>(null)
  const prevInputs = useRef<string | null>(null)
  const wasEnabled = useRef(false)

  useEffect(() => {
    let live = true
    seq.current += 1
    if (timer.current !== null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    desiredDoc.current = safeZoneDocumentToken(frame.id, frame.html)
    const pendingDoc = () =>
      dirtyDoc.current || (renderedDoc.current !== undefined && renderedDoc.current !== desiredDoc.current)
    // A new measured document starts untrusted; only its own rendered
    // generation may restore success below.
    // eslint-disable-next-line react/set-state-in-effect -- advisory measurement syncs from the sandboxed iframe
    setBoxes([])
    setStatus('unavailable')

    const isHidden = () => typeof document !== 'undefined' && document.hidden
    const fetchNow = () => {
      if (!opts.enabled || isHidden() || pendingDoc()) return
      seq.current += 1
      const my = seq.current
      void requestSafeZones(frame.id).then((reply) => {
        if (!live || my !== seq.current) return
        // A hide/disable transition overtakes the reply: the state was
        // already cleared and no trusted boxes may return until visible.
        if (!opts.enabled || isHidden()) return
        const validated = validateSafeZoneReply(reply)
        if (validated.status === 'unavailable') {
          // eslint-disable-next-line react/set-state-in-effect -- see above
          setBoxes([])
          setStatus('unavailable')
          return
        }
        if (validated.generation === null) {
          // Malformed shape: clear any prior trusted success and report
          // incomplete — never leave the earlier ok visible.
          // eslint-disable-next-line react/set-state-in-effect -- see above
          setBoxes([])
          setStatus(validated.status)
          return
        }
        // The reply names the document it measured: anything but the
        // currently desired HTML is stale, including the previously current
        // one. A mismatch also teaches the last rendered identity, so the
        // next notification only fetches once its render is confirmed; a
        // match clears the pending HTML change it confirms.
        if (typeof validated.docToken === 'number') {
          renderedDoc.current = validated.docToken
          if (validated.docToken === desiredDoc.current) dirtyDoc.current = false
        }
        if (validated.docToken !== desiredDoc.current) return
        if (generation.current === null) generation.current = validated.generation
        else if (validated.generation !== generation.current) return
        if (!live || my !== seq.current || isHidden()) return
        // eslint-disable-next-line react/set-state-in-effect -- see above
        setBoxes(validated.boxes)
        setStatus(validated.status)
      })
    }
    const schedule = () => {
      if (!opts.enabled || isHidden() || timer.current !== null || pendingDoc()) return
      timer.current = window.setTimeout(() => {
        timer.current = null
        fetchNow()
      }, REFRESH_MS)
    }
    const off = onFrameChange(frame.id, (notified, notifiedDoc) => {
      if (!live) return
      // Every notification — same-generation DOM/resource/layout changes
      // included — retires in-flight replies before the delayed refresh. A
      // notification only confirms the desired document when it carries its
      // token: ordinary same-document updates keep the pending state until
      // the wanted render lands.
      seq.current += 1
      if (typeof notified === 'number') generation.current = notified
      if (notifiedDoc !== undefined) {
        renderedDoc.current = notifiedDoc
        if (notifiedDoc === desiredDoc.current) dirtyDoc.current = false
      }
      // Immediate invalidation: stale outlines must not survive the
      // notification, and the refresh follows after the debounce.
      // eslint-disable-next-line react/set-state-in-effect -- see above
      setBoxes([])
      setStatus('unavailable')
      schedule()
    })
    const onVisibility = () => {
      if (!live) return
      // Both transitions retire in-flight replies: nothing trusted may
      // land while hidden or be carried across the return.
      seq.current += 1
      if (isHidden()) {
        if (timer.current !== null) {
          window.clearTimeout(timer.current)
          timer.current = null
        }
        // eslint-disable-next-line react/set-state-in-effect -- see above
        setBoxes([])
        setStatus('unavailable')
        return
      }
      // eslint-disable-next-line react/set-state-in-effect -- see above
      setBoxes([])
      setStatus('unavailable')
      schedule()
    }
    document.addEventListener('visibilitychange', onVisibility)
    /* A subscriber that arrives after the last render (the Inspector opening
       long after the canvas rendered) hears no notification: its first
       request discovers the live document and trusts only a reply stamped
       with the desired token. Re-enabling the same frame fetches again while
       its document is confirmed or still unknown — but a changed document
       always waits for its render notification, even across a disable or a
       same-generation notification/visibility return in between, so an old
       rendered document is never accepted under new props. A render that
       lands before this effect re-runs leaves renderedDoc confirmed, and the
       inputs-changed branch below measures it instead of waiting for a
       notification that already passed. */
    const inputsKey = `${frame.id}\n${frame.html}\n${frame.width}\n${frame.height}`
    const inputsChanged = prevInputs.current !== null && prevInputs.current !== inputsKey
    const becameEnabled = opts.enabled && !wasEnabled.current
    const idChanged = subscribedId.current !== frame.id
    prevInputs.current = inputsKey
    wasEnabled.current = opts.enabled
    if (idChanged) {
      subscribedId.current = frame.id
      generation.current = null
      renderedDoc.current = undefined
      dirtyDoc.current = false
      prevHtml.current = frame.html
      if (opts.enabled) fetchNow()
    } else {
      // An HTML change after subscribing dirties the document until its own
      // render lands — unless that render already beat this effect here, in
      // which case the document is confirmed and measured below instead of
      // waiting for a notification that already passed.
      if (prevHtml.current !== frame.html) {
        dirtyDoc.current = renderedDoc.current !== desiredDoc.current
        prevHtml.current = frame.html
      }
      if (
        opts.enabled &&
        !dirtyDoc.current &&
        (renderedDoc.current === undefined || renderedDoc.current === desiredDoc.current) &&
        (becameEnabled || inputsChanged)
      ) {
        fetchNow()
      }
    }
    return () => {
      live = false
      off()
      document.removeEventListener('visibilitychange', onVisibility)
      if (timer.current !== null) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
  }, [frame.id, frame.html, frame.width, frame.height, opts.enabled])

  return { boxes, status }
}
