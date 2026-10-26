import { useState } from 'react'
import { errorMessage } from '../lib/api'
import { addToClaudeDesktop, canAddToClaudeDesktop } from '../lib/claudeConnection'
import { Button } from './ui/button'
import { InstallBlock } from './ui/install-block'

export function ClaudeDesktopInstall({ mcpUrl }: { mcpUrl: string }) {
  const [state, setState] = useState<'idle' | 'opening' | 'opened'>('idle')
  const [error, setError] = useState('')

  async function connect() {
    setState('opening')
    setError('')
    try {
      await addToClaudeDesktop(mcpUrl)
      setState('opened')
    } catch (err) {
      setState('idle')
      setError(
        errorMessage(
          err,
          'Claude konnte nicht geöffnet werden. Prüfe, ob Claude Desktop installiert ist, und versuche es erneut.',
        ),
      )
    }
  }

  return (
    <InstallBlock
      action={
        canAddToClaudeDesktop() ? (
          <Button variant="solid" disabled={state === 'opening'} onClick={() => void connect()}>
            {state === 'opening'
              ? 'Claude wird geöffnet…'
              : state === 'opened'
                ? 'Claude erneut öffnen'
                : 'Zu Claude hinzufügen'}
          </Button>
        ) : (
          <p>
            Öffne diesen Server in einer aktuellen Doop-Desktop-App, um Claude direkt hinzuzufügen. Im Browser kannst Du
            die manuelle Installation unten nutzen.
          </p>
        )
      }
      status={state === 'opened' && 'Bestätige die Installation in Claude und genehmige dann die Doop-Anmeldung.'}
      error={error}
      manualLabel="Manuell installieren"
      manual={
        <p>
          <a className="underline underline-offset-2" href="/claude-extension/doop.mcpb" download="doop.mcpb">
            Erweiterung herunterladen
          </a>
          und dann mit Claude Desktop öffnen. Setze <strong>Doop-Server-URL</strong> auf{' '}
          <code className="break-all">{mcpUrl}</code>. Falls sich die Datei nicht öffnet, nutze in Claude{' '}
          <strong>Einstellungen → Erweiterungen → Erweiterte Einstellungen → Erweiterung installieren</strong>.
        </p>
      }
    />
  )
}
