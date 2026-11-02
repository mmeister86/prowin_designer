import { useRef, useState } from 'react'
import { FORMAT_PRESETS, type FormatPresetId } from '../../shared/prowin/formats'
import { errorMessage } from '../lib/api'
import { DEFAULT_FRAME_SIZE } from '../lib/framePlacement'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Modal, ModalActions, ModalLede, ModalTitle } from './ui/modal'

export function FramePresetDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onCreate(preset?: FormatPresetId): Promise<void>
}) {
  const [selected, setSelected] = useState<FormatPresetId | 'free'>('free')
  const [busy, setBusy] = useState(false)
  const submitting = useRef(false)
  const [error, setError] = useState<string | null>(null)

  async function create() {
    if (submitting.current) return
    submitting.current = true
    setBusy(true)
    setError(null)
    try {
      await onCreate(selected === 'free' ? undefined : selected)
      onOpenChange(false)
    } catch (err) {
      setError(errorMessage(err, 'Die Zeichenfläche konnte nicht erstellt werden. Versuche es erneut.'))
    } finally {
      submitting.current = false
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      size="sm"
      showClose={!busy}
      onClose={() => !busy && onOpenChange(false)}
      onKeyDown={(e) => e.stopPropagation()}
      onPaste={(e) => e.stopPropagation()}
    >
      <ModalTitle>Neue Zeichenfläche</ModalTitle>
      <ModalLede>Wähle ein Format oder beginne mit einer freien Zeichenfläche.</ModalLede>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void create()
        }}
      >
        <fieldset disabled={busy} className="mt-5 grid gap-2">
          <legend className="sr-only">Format</legend>
          {[
            { id: 'free' as const, label: 'Freie Zeichenfläche', ...DEFAULT_FRAME_SIZE },
            ...Object.entries(FORMAT_PRESETS).map(([id, format]) => ({ id: id as FormatPresetId, ...format })),
          ].map(({ id, label, width, height }) => (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-3 rounded-pill border border-line px-3 py-2.5 has-[:checked]:border-brand has-[:checked]:bg-sub"
            >
              <Input
                type="radio"
                variant="bare"
                inputSize="auto"
                className="size-4 shrink-0 accent-brand focus-visible:outline-2 focus-visible:outline-brand"
                name="frame-format"
                value={id}
                checked={selected === id}
                onChange={() => setSelected(id)}
              />
              <span className="flex-1 text-copy">{label}</span>
              <span className="text-caption text-ink-soft">
                {width} × {height} px
              </span>
            </label>
          ))}
        </fieldset>
        {error && (
          <p role="alert" className="mt-3 text-copy text-accent-ink">
            {error}
          </p>
        )}
        <ModalActions>
          <Button variant="ghost" type="button" disabled={busy} onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" disabled={busy}>
            {busy ? 'Wird erstellt…' : 'Erstellen'}
          </Button>
        </ModalActions>
      </form>
    </Modal>
  )
}
