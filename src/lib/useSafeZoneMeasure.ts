import { useEffect, useRef, useState } from 'react'
import { onFrameChange, requestSafeZones } from './frameBridge'
import { validateSafeZoneReply, type SafeZoneBox, type SafeZoneStatus } from './safeZoneMeasure'

const REFRESH_MS = 150

/* Shared advisory measurement for the canvas overlay (FrameView) and the
   Inspector status (SafeZoneSection). One place owns the invalidation rules
   so both surfaces stay consistent:
   - every render/change notification or measured-input change clears trusted
     boxes immediately; success/outlines return only for the latest rendered
     document generation, never for a superseded or malformed reply;
   - notifications coalesce into one delayed request (no polling, no loops —
     measuring never writes to either document);
   - while the tab is hidden no request fires and nothing trusted remains; a
     return refreshes. */
export function useSafeZoneMeasure(
  frame: { id: string; html: string; width: number; height: number },
  opts: { enabled: boolean },
): { boxes: SafeZoneBox[]; status: SafeZoneStatus } {
  const [boxes, setBoxes] = useState<SafeZoneBox[]>([])
  const [status, setStatus] = useState<SafeZoneStatus>('unavailable')
  const seq = useRef(0)
  const generation = useRef<number | null>(null)
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
    // A new measured document starts untrusted; only its own rendered
    // generation may restore success below.
    // eslint-disable-next-line react/set-state-in-effect -- advisory measurement syncs from the sandboxed iframe
    setBoxes([])
    setStatus('unavailable')

    const isHidden = () => typeof document !== 'undefined' && document.hidden
    const fetchNow = () => {
      if (!opts.enabled || isHidden()) return
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
        if (generation.current === null) generation.current = validated.generation
        else if (validated.generation !== generation.current) return
        if (!live || my !== seq.current || isHidden()) return
        // eslint-disable-next-line react/set-state-in-effect -- see above
        setBoxes(validated.boxes)
        setStatus(validated.status)
      })
    }
    const schedule = () => {
      if (!opts.enabled || isHidden() || timer.current !== null) return
      timer.current = window.setTimeout(() => {
        timer.current = null
        fetchNow()
      }, REFRESH_MS)
    }
    const off = onFrameChange(frame.id, (notified) => {
      if (!live) return
      // Every notification — same-generation DOM/resource/layout changes
      // included — retires in-flight replies before the delayed refresh.
      seq.current += 1
      if (typeof notified === 'number') generation.current = notified
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
       long after the canvas rendered) hears no notification: measure the live
       document once per frame so it never sticks on unavailable. A render
       notification that overtakes the reply corrects it via the generation
       match above. Re-enabling the same frame (preset selected, tab
       returned) fetches again — unless the measured document itself changed
       in the same commit, in which case the runtime has not rendered it yet
       and the render notification drives the request instead, so an old
       rendered document is never accepted under new props. */
    const inputsKey = `${frame.id}\n${frame.html}\n${frame.width}\n${frame.height}`
    const inputsChanged = prevInputs.current !== null && prevInputs.current !== inputsKey
    const becameEnabled = opts.enabled && !wasEnabled.current
    const idChanged = subscribedId.current !== frame.id
    prevInputs.current = inputsKey
    wasEnabled.current = opts.enabled
    if (idChanged) {
      subscribedId.current = frame.id
      generation.current = null
      if (opts.enabled) fetchNow()
    } else if (becameEnabled && !inputsChanged) {
      fetchNow()
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
