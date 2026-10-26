import { useState } from 'react'
import { authClient } from '../lib/auth'
import { useMe } from '../lib/me'
import { selectLocalAgent, useLocalAgent } from '../lib/localAgent'
import { LocalClaudeRow } from './LocalClaude'
import { Button } from './ui/button'

/** Central server execution is always available as a selection. Only eligible
 * Creator/Admin accounts can opt into the separate local desktop harness. */
export function AgentExecutionPanel({ onChange }: { onChange?: () => void }) {
  const { data: session } = authClient.useSession()
  const userId = session?.user.id
  const me = useMe(userId)
  const eligible = Boolean(me?.creator || me?.admin)
  const preference = useLocalAgent((state) => state.preference)
  const local = eligible && preference?.enabled
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function selectServer() {
    if (!eligible || !userId) return
    setBusy(true)
    setError('')
    try {
      await selectLocalAgent(userId, { enabled: false, model: preference?.model ?? 'default' })
      onChange?.()
    } catch {
      setError('Der Server-Agent konnte nicht ausgewählt werden. Versuche es erneut.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4 px-4 pb-5 pt-4 sm:px-[22px]">
      <section className="rounded-card border border-line p-4" aria-label="Server-Agent">
        <h3 className="font-semibold">proWIN Agent</h3>
        <p className="mt-1 text-body text-ink-soft">Zentral verwaltete Designunterstützung für Deine Arbeitsflächen.</p>
        <p className="mt-2 text-caption text-ink-faint">
          {local ? 'Lokaler Agent ausgewählt.' : 'Server-Agent ausgewählt.'}
        </p>
        {local && (
          <Button className="mt-3" onClick={() => void selectServer()} disabled={busy}>
            Server-Agent verwenden
          </Button>
        )}
        {error && (
          <p role="alert" className="mt-2 text-body text-accent-ink">
            {error}
          </p>
        )}
      </section>
      {eligible && <LocalClaudeRow />}
    </div>
  )
}
