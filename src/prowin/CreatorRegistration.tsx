import { useState } from 'react'
import { authClient } from '../lib/auth'
import { useMe } from '../lib/me'
import { api, errorMessage } from '../lib/api'
import { Button } from '../components/ui/button'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from '../components/ui/card'

export function CreatorRegistration({ onRegistered = () => location.reload() }: { onRegistered?: () => void }) {
  const { data: session } = authClient.useSession()
  const me = useMe(session?.user.id)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function register() {
    setBusy(true)
    setError('')
    try {
      await api.registerCreator()
      onRegistered()
    } catch (caught) {
      setError(errorMessage(caught, 'Registrierung fehlgeschlagen'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>{me?.creator ? 'Creator aktiv' : 'Creator werden'}</CardTitle>
        <CardDescription>
          Als Creator kannst du eigene Workspaces gründen und Vorlagen erstellen. In anderen Workspaces bestimmt deren
          Owner deine Rechte. Auch Beraterinnen können dort mitarbeiten.
        </CardDescription>
      </CardHeader>
      {!me?.creator && (
        <CardRow>
          <Button variant="primary" disabled={!me || busy || !!me.impersonating} onClick={register}>
            {busy ? 'Registrierung läuft…' : 'Als Creator registrieren'}
          </Button>
        </CardRow>
      )}
      {error && (
        <CardRow>
          <p role="alert" className="text-body text-accent-ink">
            {error}
          </p>
        </CardRow>
      )}
    </SettingsCard>
  )
}
