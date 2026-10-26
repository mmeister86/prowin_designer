import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../lib/api'
import type { Allowance } from '../lib/api'
import { useStore } from '../lib/store'
import { Button } from './ui/button'
import { Modal, ModalActions, ModalLede, ModalTitle } from './ui/modal'
import { cn } from '@/lib/utils'

/**
 * Free-tier metering UI for the resident team: the shared allowance hook,
 * the "n free team tasks left" line, and the wall that appears when they're
 * gone. Server-enforced; this is only the mirror of /api/agent-allowance.
 */

export type { Allowance }

export function useAllowance(): { allowance: Allowance | null; refresh: () => void } {
  const [allowance, setAllowance] = useState<Allowance | null>(null)
  /* re-read whenever the Local Agent selection changes anywhere in the
     app, so every meter on screen agrees without prop-drilling */
  const version = useStore((s) => s.allowanceVersion)
  const refresh = useCallback(() => {
    api.agentAllowance().then(setAllowance, () => {})
  }, [])
  useEffect(refresh, [refresh, version])
  return { allowance, refresh }
}

/** True when this failure is the free tier running out (shows the wall). */
export function isResidentLimit(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && err.body.error === 'resident_limit'
}

/** The meter as one plain sentence, for a tooltip. */
export function meterText(allowance: Allowance | null): string | null {
  if (!allowance) return null
  if (allowance.localAgent) return 'Doop-Agent über Deine lokale Claude CLI'
  if (allowance.limit <= 0) return 'Der Server-Agent ist nicht aktiviert — wende Dich an die Administration'
  const left = Math.max(0, allowance.limit - allowance.used)
  return left === 0
    ? 'Das Agentenaufgabenkontingent ist aufgebraucht — wende Dich an die Administration'
    : `${left.toLocaleString('de-DE')} von ${allowance.limit.toLocaleString('de-DE')} Agentenaufgaben übrig`
}

export function MeterLine({ allowance }: { allowance: Allowance | null }) {
  const text = meterText(allowance)
  return text ? (
    <span className={cn('text-[12px]', allowance?.localAgent ? 'text-success-ink' : 'text-ink-faint')}>{text}</span>
  ) : null
}

export function LimitWall({
  onClose,
  onOpenConnect,
}: {
  canvasId: string
  onClose: () => void
  onOpenConnect: () => void
}) {
  const { allowance } = useAllowance()
  /* "used up" only fits a server that granted free tasks in the first place;
     everywhere else (the default, limit 0) this wall IS the getting-started
     step — while the allowance loads, assume the no-free-tier common case */
  const hadFreeTier = allowance != null && allowance.limit > 0
  return (
    <Modal size="lg" onClose={onClose}>
      <>
        <ModalTitle>
          {hadFreeTier ? 'Agentenaufgabenkontingent aufgebraucht' : 'Server-Agent nicht aktiviert'}
        </ModalTitle>
        <ModalLede>
          Wende Dich an Deine Administration, um das Agentenaufgabenkontingent zu aktivieren oder zu erweitern. Deine
          Designs bleiben verfügbar.
        </ModalLede>
        {/* the MCP path is a different mode — an agent you prompt yourself, not
            one that picks up queued tasks — so it hands off instead of inlining
            the setup steps here where they read like a fix for the queued card */}
        <div className="mt-5 border-t border-line pt-4">
          <p className="text-[12.5px] text-ink-faint">
            Möchtest Du die Arbeitsfläche selbst über Claude Code, Codex oder einen anderen MCP-Client steuern? Dieser
            Agent gestaltet nach Deinen Eingaben — eingereihte Aufgaben bleiben beim Doop-Agenten.{' '}
            <button
              type="button"
              className="font-semibold text-ink underline underline-offset-2"
              onClick={onOpenConnect}
            >
              So stellst Du die Verbindung her
            </button>
          </p>
        </div>

        <ModalActions>
          <Button onClick={onClose}>Schließen</Button>
        </ModalActions>
      </>
    </Modal>
  )
}
