import { useState } from 'react'
import { errorMessage } from '../lib/api'
import { addToCodex, canAddToCodex, codexDesktopLink } from '../lib/codexConnection'
import { isDesktopShell } from '../lib/shell'
import { Button } from './ui/button'
import { CodeBlock } from './ui/code-block'
import { InstallBlock } from './ui/install-block'

/** Exact app-authored native rejections, including older desktop versions.
 * Never reflect native diagnostics or configuration contents into the page. */
function setupError(error: unknown): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  const recovery = [
    [
      'Codex already has a different doop connection.',
      'Codex already has a different doop connection. Rename or remove it in Codex settings, then try again. Your settings were not changed.',
      'Codex hat bereits eine andere doop-Verbindung. Benenne sie in den Codex-Einstellungen um oder entferne sie und versuche es erneut. Deine Einstellungen wurden nicht geändert.',
    ],
    [
      'Your Codex config is not valid TOML. Fix it in Codex settings, then try again.',
      'Deine Codex-Konfiguration enthält kein gültiges TOML. Korrigiere sie in den Codex-Einstellungen und versuche es erneut.',
    ],
    [
      'The mcp_servers setting in your Codex config must be a table. Fix it in Codex settings, then try again.',
      'Die Einstellung mcp_servers in Deiner Codex-Konfiguration muss eine Tabelle sein. Korrigiere sie in den Codex-Einstellungen und versuche es erneut.',
    ],
    [
      'The doop entry in your Codex config is not a server. Rename or remove it in Codex settings, then try again.',
      'Der doop-Eintrag in Deiner Codex-Konfiguration ist kein Server. Benenne ihn in den Codex-Einstellungen um oder entferne ihn und versuche es erneut.',
    ],
    [
      'CODEX_HOME must point to an existing absolute directory.',
      'CODEX_HOME muss auf ein vorhandenes Verzeichnis mit absolutem Pfad verweisen.',
    ],
    [
      'Your Codex config changed during setup. Please try again.',
      'Deine Codex-Konfiguration wurde während der Einrichtung geändert. Versuche es erneut.',
    ],
    [
      'Could not resolve your Codex config file.',
      'Der Pfad Deiner Codex-Konfigurationsdatei konnte nicht aufgelöst werden.',
      'Der Pfad Deiner Codex-Konfigurationsdatei konnte nicht aufgelöst werden. Prüfe den Pfad und das Ziel einer möglichen Verknüpfung und versuche es erneut.',
    ],
    [
      'Could not read your Codex config. Check its file permissions and try again.',
      'Deine Codex-Konfiguration konnte nicht gelesen werden. Prüfe die Dateiberechtigungen und versuche es erneut.',
      'Could not access your Codex config file.',
      'Auf Deine Codex-Konfigurationsdatei konnte nicht zugegriffen werden.',
      'Could not prepare your Codex config. Check its file permissions.',
      'Deine Codex-Konfiguration konnte nicht vorbereitet werden. Prüfe die Dateiberechtigungen.',
      'Could not read your Codex config permissions.',
      'Die Berechtigungen Deiner Codex-Konfiguration konnten nicht gelesen werden.',
      'Could not preserve your Codex config permissions.',
      'Die Berechtigungen Deiner Codex-Konfiguration konnten nicht beibehalten werden.',
      'Could not write your Codex config.',
      'Deine Codex-Konfiguration konnte nicht geschrieben werden.',
      'Could not save your Codex config.',
      'Deine Codex-Konfiguration konnte nicht gespeichert werden.',
      'Could not replace your Codex config. Check its file permissions and try again.',
      'Deine Codex-Konfiguration konnte nicht ersetzt werden. Prüfe die Dateiberechtigungen und versuche es erneut.',
      'Die Codex-Konfiguration konnte nicht eingerichtet werden. Prüfe die Dateiberechtigungen von config.toml und ihrem Verzeichnis und versuche es erneut.',
    ],
    [
      'Could not locate your Codex config directory.',
      'Dein Codex-Konfigurationsverzeichnis konnte nicht gefunden werden.',
      'Could not create your Codex config directory.',
      'Dein Codex-Konfigurationsverzeichnis konnte nicht erstellt werden.',
      'Dein Codex-Konfigurationsverzeichnis konnte nicht eingerichtet werden. Prüfe CODEX_HOME und die Verzeichnisberechtigungen und versuche es erneut.',
    ],
  ].find((variants) => variants.includes(message))
  return (
    recovery?.at(-1) ??
    errorMessage(
      error,
      'Doop konnte nicht zu Codex hinzugefügt werden. Versuche es erneut oder nutze die manuelle Einrichtung.',
    )
  )
}

export function CodexInstall({ mcpUrl, canvasId }: { mcpUrl: string; canvasId?: string }) {
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle')
  const [error, setError] = useState('')

  async function connect() {
    setState('adding')
    setError('')
    try {
      await addToCodex()
      setState('added')
    } catch (err) {
      setState('idle')
      setError(setupError(err))
    }
  }

  const manual = (
    <>
      <p>Führe dies in einem Terminal aus, in dem Codex CLI installiert ist:</p>
      <CodeBlock text={`codex mcp add doop --url ${mcpUrl}`} className="mt-2" />
    </>
  )

  if (canAddToCodex()) {
    return (
      <InstallBlock
        action={
          <Button variant="solid" disabled={state !== 'idle'} onClick={() => void connect()}>
            {state === 'adding'
              ? 'Doop wird hinzugefügt…'
              : state === 'added'
                ? 'Zu Codex hinzugefügt'
                : 'Zu Codex hinzufügen'}
          </Button>
        }
        status={
          state === 'added' &&
          'Doop ist eingerichtet. Öffne einen neuen Codex-Chat und melde Dich bei Doop an, wenn Du dazu aufgefordert wirst.'
        }
        error={error}
        manual={manual}
      />
    )
  }
  if (isDesktopShell()) {
    return (
      <InstallBlock
        action={
          <p>Aktualisiere Doop Desktop, um Codex direkt hinzuzufügen, oder nutze die manuelle Einrichtung unten.</p>
        }
        manual={manual}
      />
    )
  }
  return (
    <InstallBlock
      action={
        <Button asChild variant="solid">
          <a href={codexDesktopLink(new URL(mcpUrl).origin, canvasId)}>Doop Desktop öffnen</a>
        </Button>
      }
      status="Erfordert die aktuelle Doop-Desktop-App. Klicke dort auf „Zu Codex hinzufügen“, um die Einrichtung abzuschließen. Falls sich die App nicht öffnet, nutze die manuelle Einrichtung unten."
      manual={manual}
    />
  )
}
