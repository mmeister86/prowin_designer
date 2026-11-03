import { useEffect, useRef, useState } from 'react'
import type { Frame } from '../../shared/types'
import { effectiveSafeZone, isSafeZoneOverride, safeZoneFits, safeZoneIntrudes } from '../../shared/prowin/safeZones.ts'
import { useCanvasCapabilities } from './canvasPermissions'
import { useStore } from '../lib/store'
import { api, errorMessage } from '../lib/api'
import { onFrameChange, requestSafeZones } from '../lib/frameBridge'
import { validateSafeZoneReply, type SafeZoneBox, type SafeZoneStatus } from '../lib/safeZoneMeasure.ts'
import { enqueueGeometrySave } from '../lib/geometrySaves'
import { recordUpdate } from '../lib/history'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'

const fillBtn = 'h-7 rounded-[7px] bg-sub px-2 text-[12px] font-normal text-ink hover:bg-paper-deep max-md:min-h-10'

function statusText(status: SafeZoneStatus, warnings: number): string {
  if (status === 'unavailable') return 'Messung nicht verfügbar'
  if (status === 'incomplete')
    return warnings > 0 ? `Messung unvollständig – ${warnings} Elemente im Randbereich` : 'Messung unvollständig'
  if (warnings === 0) return 'Keine Warnungen'
  return warnings === 1 ? '1 Element im Randbereich' : `${warnings} Elemente im Randbereich`
}

/** Inspector controls for the advisory safe zone. Toggle is local
 *  (default on); Creator edits save through the shared geometry queue and
 *  record history only after the server accepted the write. */
export function SafeZoneSection({ frame }: { frame: Frame }) {
  const canManageLocks = useCanvasCapabilities(frame.canvasId).manageLocks
  const showSafeZones = useStore((s) => s.showSafeZones)
  const setShowSafeZones = useStore((s) => s.setShowSafeZones)
  const insets = effectiveSafeZone(frame)
  const [boxes, setBoxes] = useState<SafeZoneBox[]>([])
  const [measureStatus, setMeasureStatus] = useState<SafeZoneStatus>('unavailable')
  const [draft, setDraft] = useState({ top: '', right: '', bottom: '', left: '' })
  const [seen, setSeen] = useState(frame.id + JSON.stringify(frame.safeZoneOverride ?? null))
  const [saving, setSaving] = useState(false)
  const seq = useRef(0)

  /* advisory measurement: same bridge as the canvas overlay, latest wins */
  useEffect(() => {
    let live = true
    seq.current += 1
    const my = seq.current
    if (typeof document !== 'undefined' && document.hidden) {
      // eslint-disable-next-line react/set-state-in-effect -- syncs advisory measurement from the sandboxed iframe
      setMeasureStatus('unavailable')
      setBoxes([])
      return () => {
        live = false
      }
    }
    void requestSafeZones(frame.id).then((reply) => {
      if (!live || my !== seq.current) return
      const validated = validateSafeZoneReply(reply)
      // eslint-disable-next-line react/set-state-in-effect -- syncs advisory measurement from the sandboxed iframe
      setMeasureStatus(validated.status)
      setBoxes(validated.boxes)
    })
    const off = onFrameChange(frame.id, () => {
      seq.current += 1
      const cur = seq.current
      void requestSafeZones(frame.id).then((reply) => {
        if (!live || cur !== seq.current) return
        const validated = validateSafeZoneReply(reply)
        // eslint-disable-next-line react/set-state-in-effect -- syncs advisory measurement from the sandboxed iframe
        setMeasureStatus(validated.status)
        setBoxes(validated.boxes)
      })
    })
    return () => {
      live = false
      off()
    }
  }, [frame.id, frame.html, frame.width, frame.height])

  const key = frame.id + JSON.stringify(frame.safeZoneOverride ?? null)
  if (seen !== key) {
    setSeen(key)
    const current = frame.safeZoneOverride ?? insets
    setDraft({
      top: current ? String(current.top) : '',
      right: current ? String(current.right) : '',
      bottom: current ? String(current.bottom) : '',
      left: current ? String(current.left) : '',
    })
  }

  const warnings = insets ? boxes.filter((b) => safeZoneIntrudes(b, insets, frame.width, frame.height)).length : 0

  async function persist(patch: { safeZoneOverride?: NonNullable<Frame['safeZoneOverride']> | null }) {
    if (!canManageLocks || saving) return
    setSaving(true)
    try {
      await enqueueGeometrySave([frame.id], async () => {
        const live = useStore.getState().canvas?.frames.find((f) => f.id === frame.id) ?? frame
        try {
          await api.updateFrame(frame.id, patch)
        } catch (err) {
          console.error(err)
          useStore.getState().pushNotice(errorMessage(err, 'Die Safe-Zone konnte nicht gespeichert werden.'))
          return
        }
        useStore.getState().patchFrameLocal(frame.id, patch)
        recordUpdate(frame.id, live, patch)
      })
    } finally {
      setSaving(false)
    }
  }

  async function save() {
    const parsed = {
      top: Math.round(Number(draft.top)),
      right: Math.round(Number(draft.right)),
      bottom: Math.round(Number(draft.bottom)),
      left: Math.round(Number(draft.left)),
    }
    if (!isSafeZoneOverride(parsed)) {
      useStore.getState().pushNotice('Ungültige Safe-Zone: vier ganze Zahlen ≥ 0 erforderlich.')
      return
    }
    if (!safeZoneFits(parsed, frame.width, frame.height)) {
      useStore
        .getState()
        .pushNotice('Der Safe-Zone-Abstand ist größer als die Zeichenfläche. Verkleinere die Abstände.')
      return
    }
    await persist({ safeZoneOverride: parsed })
  }

  async function reset() {
    await persist({ safeZoneOverride: null })
  }

  return (
    <div className="space-y-1.5">
      <label className="flex min-h-10 items-center gap-2 text-[12px] text-ink">
        <input
          type="checkbox"
          aria-label="Safe-Zone-Warnungen anzeigen"
          checked={showSafeZones}
          onChange={(e) => setShowSafeZones(e.target.checked)}
        />
        Warnungen anzeigen
      </label>
      <p className="text-[12px] text-ink-soft">
        {insets
          ? `Abstände: oben ${insets.top}, rechts ${insets.right}, unten ${insets.bottom}, links ${insets.left} px`
          : 'Kein Format – keine Safe-Zone'}
      </p>
      <p role="status" className="text-[12px] text-ink-soft">
        {insets ? statusText(measureStatus, warnings) : 'Messung nicht verfügbar'}
      </p>
      {canManageLocks && insets ? (
        <div className="space-y-1.5">
          <div className="grid grid-cols-2 gap-1.5">
            {(['top', 'right', 'bottom', 'left'] as const).map((side) => (
              <label
                key={side}
                className="flex h-7 min-w-0 items-center gap-[7px] rounded-[7px] bg-sub px-2 focus-within:bg-surface focus-within:shadow-elevation-1-focus max-md:h-10"
              >
                <span className="flex-none text-[10.5px] text-ink-ghost">
                  {{ top: 'O', right: 'R', bottom: 'U', left: 'L' }[side]}
                </span>
                <Input
                  variant="bare"
                  inputSize="auto"
                  aria-label={
                    { top: 'Abstand oben', right: 'Abstand rechts', bottom: 'Abstand unten', left: 'Abstand links' }[
                      side
                    ]
                  }
                  className="w-full min-w-0 bg-transparent font-mono text-[11px] text-ink outline-none"
                  inputMode="numeric"
                  value={draft[side]}
                  onChange={(e) => setDraft((d) => ({ ...d, [side]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Button variant="bare" className={fillBtn} disabled={saving} onClick={save}>
              Speichern
            </Button>
            <Button variant="bare" className={fillBtn} disabled={saving} onClick={reset}>
              Zurücksetzen
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
