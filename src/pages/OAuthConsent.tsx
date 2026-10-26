import { useEffect, useState } from 'react'
import { AuthCard, AuthCardText, AuthScreen } from '../components/ui/screen'
import { Button } from '../components/ui/button'
import { Callout } from '../components/ui/callout'

export function OAuthConsent({ email }: { email: string }) {
  const code = new URLSearchParams(location.search).get('consent_code') ?? ''
  const [client, setClient] = useState<{ name: string } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const endpoint = `/api/mcp-consent/${encodeURIComponent(code)}`

  useEffect(() => {
    const controller = new AbortController()
    fetch(endpoint, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error('Diese Verbindungsanfrage ist abgelaufen. Starte erneut von Deinem Agenten aus.')
        return res.json() as Promise<{ name: string }>
      })
      .then(setClient)
      .catch((err: unknown) => {
        if (!controller.signal.aborted)
          setError(
            err instanceof Error &&
              err.message === 'Diese Verbindungsanfrage ist abgelaufen. Starte erneut von Deinem Agenten aus.'
              ? err.message
              : 'Die Verbindung konnte nicht geladen werden.',
          )
      })
    return () => controller.abort()
  }, [endpoint])

  async function respond(accept: boolean) {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accept }),
      })
      if (!res.ok)
        throw new Error('Die Verbindung konnte nicht abgeschlossen werden. Starte erneut von Deinem Agenten aus.')
      const result = (await res.json()) as { redirectURI: string }
      location.assign(result.redirectURI)
    } catch (err) {
      setError(
        err instanceof Error &&
          err.message === 'Die Verbindung konnte nicht abgeschlossen werden. Starte erneut von Deinem Agenten aus.'
          ? err.message
          : 'Die Verbindung konnte nicht abgeschlossen werden.',
      )
      setBusy(false)
    }
  }

  return (
    <AuthScreen>
      <AuthCard title={client ? `Verbinden: ${client.name}?` : 'Verbinde Deinen Agenten'}>
        <AuthCardText className="break-all">Angemeldet als {email}</AuthCardText>
        <AuthCardText>
          Dieser Agent kann Dein Profil lesen und auf den für Dich zugänglichen Arbeitsflächen Designs lesen, erstellen,
          bearbeiten und löschen. Seine Änderungen werden Deinem Konto zugeordnet.
        </AuthCardText>
        {error && <Callout tone="error">{error}</Callout>}
        <div className="flex justify-end gap-2">
          <Button disabled={!client || busy} onClick={() => void respond(false)}>
            Abbrechen
          </Button>
          <Button variant="solid" disabled={!client || busy} onClick={() => void respond(true)}>
            {busy ? 'Verbindung wird hergestellt…' : 'Verbinden'}
          </Button>
        </div>
      </AuthCard>
    </AuthScreen>
  )
}
