import { cursorMcpInstallUrl } from '../lib/cursorConnection'
import { Button } from './ui/button'
import { CodeBlock } from './ui/code-block'
import { InstallBlock } from './ui/install-block'

export function CursorInstall({ mcpUrl }: { mcpUrl: string }) {
  return (
    <InstallBlock
      action={
        <Button asChild variant="solid">
          <a href={cursorMcpInstallUrl(mcpUrl)}>Zu Cursor hinzufügen</a>
        </Button>
      }
      manualLabel="Verbindungshilfe"
      manual={
        <>
          <p>
            Falls Cursor sich nicht öffnet, öffne den Bereich <strong>Anpassen</strong> und füge einen
            benutzerdefinierten MCP-Server hinzu. Füge diesen Eintrag <code>doop</code> zu Deiner MCP-Konfiguration
            hinzu und behalte bestehende Server bei. Falls Doop bereits über ein Plugin verbunden ist, nutze diese
            Verbindung.
          </p>
          <CodeBlock text={JSON.stringify({ mcpServers: { doop: { url: mcpUrl } } }, null, 2)} className="mt-2.5" />
        </>
      }
    />
  )
}
