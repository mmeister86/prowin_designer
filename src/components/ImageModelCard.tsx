import { useCallback, useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import type { ImageModelStatus } from '../lib/api'
import { IMAGE_MODELS } from '../../shared/modelMenu'
import { useStore } from '../lib/store'
import { CardDescription, CardHeader, CardTitle, SettingsCard } from './ui/card'
import { ToggleChip, ToggleChipGroup, ToggleChipItem } from './ui/toggle-chip'
import { CheckIcon } from './ui/icons'

/** Why an entry is disabled, phrased as the fix. */
const UNAVAILABLE_HINTS = {
  openai: 'Auf diesem Server nicht eingerichtet. Wende Dich an die Administration.',
  gemini: 'Auf diesem Server nicht eingerichtet. Wende Dich an die Administration.',
  ark: 'Auf diesem Server nicht eingerichtet. Wende Dich an die Administration.',
} as const

/**
 * Which image model the agents' generate_image tool draws with. The registry
 * is shared with the server; the server says which entries this user's
 * credentials can actually run, and unavailable ones stay visible but inert
 * so the menu doubles as a capability list.
 */
export function ImageModelCard() {
  const [models, setModels] = useState<ImageModelStatus[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  /* availability follows server configuration — re-read when it changes */
  const version = useStore((s) => s.allowanceVersion)
  const refresh = useCallback(() => {
    api.imageModels().then(
      ({ models: next }) => setModels(next),
      () => {},
    )
  }, [])
  useEffect(refresh, [refresh, version])

  if (!models) return null

  const selected = models.find((m) => m.selected)
  const pick = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      const { models: next } = await api.setImageModel(id)
      setModels(next)
    } catch (e) {
      setError(errorMessage(e, 'Das hat nicht funktioniert — versuche es erneut'))
      refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>Bildmodell</CardTitle>
        <CardDescription>
          Wähle ein von Deiner Administration eingerichtetes Bildmodell. Bilder werden über den zentralen Dienst
          erzeugt.
        </CardDescription>
      </CardHeader>
      <div className="px-4 pb-5 pt-4 sm:px-[22px]">
        <ToggleChipGroup aria-label="Bildmodell" value={selected?.id ?? ''} onValueChange={pick} disabled={busy}>
          {IMAGE_MODELS.map((option) => {
            const status = models.find((m) => m.id === option.id)
            if (!status?.available) {
              return (
                <ToggleChip key={option.id} state="idle" title={UNAVAILABLE_HINTS[option.provider]}>
                  {option.name}
                </ToggleChip>
              )
            }
            return (
              <ToggleChipItem key={option.id} value={option.id} title={option.blurb}>
                {status.selected && (
                  <CheckIcon width={13} height={13} strokeWidth={2.5} color="var(--success-ink)" aria-hidden />
                )}
                {option.name}
              </ToggleChipItem>
            )
          })}
        </ToggleChipGroup>
        {selected && (
          <p className="mt-[10px] text-body text-ink-faint">
            {IMAGE_MODELS.find((option) => option.id === selected.id)?.blurb}
          </p>
        )}
        {error && <p className="mt-[10px] text-body text-accent-ink">{error}</p>}
      </div>
    </SettingsCard>
  )
}
