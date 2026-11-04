import { useEffect, useRef, useState } from 'react'
import type { Frame } from '../../shared/types'
import { prepareFrameExport, saveBlob, type FrameExportFormat } from '../lib/frameExport'
import { canShareFrameFile, shareFrameFile } from './frameShare'
import { Button } from '../components/ui/button'

const FORMAT_LABEL: Record<FrameExportFormat, string> = { png: 'PNG', jpg: 'JPG' }

/* A two-step share control for the export dialog: an explicit prepare click
   renders the file once (slow renders would lose the click's activation
   otherwise), an explicit later share click hands those exact bytes to the
   sheet. The prepared download reuses the same bytes without fetching again.
   Stale runs — a changed frame, a newer format, an unmounted dialog — never
   publish their file. */

function probeSupport(): { png: boolean; jpg: boolean } {
  try {
    return {
      png: canShareFrameFile(new File(['x'], 'probe.png', { type: 'image/png' })),
      jpg: canShareFrameFile(new File(['x'], 'probe.jpg', { type: 'image/jpeg' })),
    }
  } catch {
    return { png: false, jpg: false }
  }
}

export function FrameShareActions({ frame }: { frame: Frame }) {
  const [support, setSupport] = useState<{ png: boolean; jpg: boolean } | null>(null)
  const [phase, setPhase] = useState<'idle' | 'preparing' | 'ready' | 'sharing'>('idle')
  const [activeFormat, setActiveFormat] = useState<FrameExportFormat | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  /* one counter invalidates every late run; the refs below block the second
     click of a double-click before React has re-rendered the disabled state */
  const seq = useRef(0)
  const preparing = useRef(false)
  const sharing = useRef(false)
  const aborter = useRef<AbortController | null>(null)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      aborter.current?.abort()
    }
  }, [])

  const identity = JSON.stringify([frame.id, frame.updatedAt, frame.name, frame.width, frame.height, frame.html])
  useEffect(() => {
    seq.current += 1
    aborter.current?.abort()
    aborter.current = null
    preparing.current = false
    sharing.current = false
    setPhase('idle')
    setActiveFormat(null)
    setFile(null)
    setMessage(null)
    setSupport(probeSupport())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity])

  async function prepare(format: FrameExportFormat) {
    if (preparing.current || sharing.current) return
    preparing.current = true
    aborter.current?.abort()
    const controller = new AbortController()
    aborter.current = controller
    const my = ++seq.current
    setActiveFormat(format)
    /* the previous file must not survive a new run: a failed replacement
       would otherwise keep showing a stale name with a dead Share button */
    setFile(null)
    setPhase('preparing')
    setMessage(null)
    let prepared: File | null = null
    let failure: unknown = null
    try {
      prepared = await prepareFrameExport(frame, format, controller.signal)
    } catch (err) {
      failure = err
    }
    /* a stale run must not release the newer run's guard */
    if (seq.current !== my) return
    preparing.current = false
    if (!mounted.current) return
    if (failure instanceof DOMException && failure.name === 'AbortError') {
      setPhase('idle')
      setActiveFormat(null)
      return
    }
    if (failure) {
      setMessage(
        failure instanceof Error ? failure.message : `Das ${FORMAT_LABEL[format]} konnte nicht vorbereitet werden`,
      )
      setPhase('idle')
      setActiveFormat(null)
      return
    }
    setFile(prepared)
    setPhase('ready')
  }

  async function share() {
    const current = file
    if (!current || phase !== 'ready' || sharing.current || preparing.current) return
    if (!canShareFrameFile(current)) {
      setMessage('Dieser Browser kann keine Dateien teilen')
      return
    }
    sharing.current = true
    const my = seq.current
    setPhase('sharing')
    setMessage(null)
    const failure = await shareFrameFile(current)
    if (seq.current !== my) return
    sharing.current = false
    if (!mounted.current) return
    setPhase('ready')
    setMessage(failure)
  }

  if (!support) return null
  if (!support.png && !support.jpg)
    return (
      <p className="mt-4 text-copy text-ink-soft">
        Dieser Browser kann keine Dateien teilen. Die Downloads oben funktionieren trotzdem.
      </p>
    )

  const busy = phase === 'preparing' || phase === 'sharing'
  const label = FORMAT_LABEL[activeFormat ?? 'png']
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p className="text-copy font-medium text-ink">Als Datei teilen</p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" disabled={busy || !support.png} onClick={() => void prepare('png')}>
          PNG vorbereiten
        </Button>
        <Button variant="ghost" disabled={busy || !support.jpg} onClick={() => void prepare('jpg')}>
          JPG vorbereiten
        </Button>
      </div>
      {phase === 'preparing' && <p className="mt-2 text-copy text-ink-soft">{label} wird vorbereitet…</p>}
      {file && phase !== 'preparing' && (
        <div className="mt-2">
          <p className="text-copy text-ink-soft">„{file.name}“ ist bereit zum Teilen.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button variant="ghost" disabled={busy} onClick={() => void share()}>
              Teilen
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => {
                if (file) saveBlob(file, file.name)
              }}
            >
              Herunterladen
            </Button>
          </div>
        </div>
      )}
      {phase === 'sharing' && <p className="mt-2 text-copy text-ink-soft">{label} wird geteilt…</p>}
      {message && (
        <p role="status" className="mt-2 text-copy text-ink-soft">
          {message}
        </p>
      )}
    </div>
  )
}
