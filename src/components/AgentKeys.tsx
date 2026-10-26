import { useEffect, useState } from 'react'
import { api, errorMessage, type AgentKeyInfo } from '../lib/api'
import { timeAgo } from '../lib/time'
import { ConfirmDialog } from './ui/alert-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Note } from './ui/note'
import { CodeBlock } from './ui/code-block'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from './ui/card'
import { TrashIcon } from './ui/icons'

/* same fixed-column-on-desktop rhythm as the other settings cards */

/** The MCP config a headless client needs, with the key in place. Shown once,
 *  right after minting — the moment the person actually has the secret. */
function headlessConfig(secret: string): string {
  return JSON.stringify(
    {
      mcpServers: {
        doop: { type: 'http', url: `${location.origin}/mcp`, headers: { Authorization: `Bearer ${secret}` } },
      },
    },
    null,
    2,
  )
}

/** The "Agent keys" pane of /settings: mint, list and revoke the bearer
 *  credentials headless MCP clients (Mastra, n8n, CI) connect with. The
 *  secret appears exactly once, in the mint response — after that the list
 *  knows only each key's first characters. */
export function AgentKeys() {
  const [keys, setKeys] = useState<AgentKeyInfo[] | null>(null)
  const [name, setName] = useState('')
  const [minting, setMinting] = useState(false)
  const [error, setError] = useState('')
  /* the one moment the full secret exists client-side */
  const [minted, setMinted] = useState<{ id: string; secret: string } | null>(null)
  /* the key awaiting "are you sure" — an in-app dialog, since window.confirm
     is a silent "cancel" in the desktop shell's webview */
  const [confirmRevoke, setConfirmRevoke] = useState<AgentKeyInfo | null>(null)

  /* `keys === null` is "still loading", and minting stays disabled until it
     resolves: a list request in flight would otherwise land after the key it
     doesn't know about and drop it from the list. A failed load still opens
     the pane — an empty list you can mint into beats a dead card. */
  useEffect(() => {
    api.listAgentKeys().then(setKeys, (e: unknown) => {
      console.error(e)
      setKeys([])
      setError(errorMessage(e, 'Deine Schlüssel konnten nicht geladen werden'))
    })
  }, [])

  async function mint() {
    setMinting(true)
    setError('')
    try {
      const { secret, ...info } = await api.createAgentKey(name)
      setName('')
      setMinted({ id: info.id, secret })
      setKeys((current) => [info, ...(current ?? [])])
    } catch (e) {
      setError(errorMessage(e, 'Der Schlüssel konnte nicht erstellt werden'))
    } finally {
      setMinting(false)
    }
  }

  async function revoke(key: AgentKeyInfo) {
    try {
      await api.deleteAgentKey(key.id)
      setKeys((current) => current?.filter((k) => k.id !== key.id) ?? null)
      if (minted?.id === key.id) setMinted(null)
    } catch (e) {
      setError(errorMessage(e, 'Der Schlüssel konnte nicht widerrufen werden'))
    }
  }

  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>Agentenschlüssel</CardTitle>
        <CardDescription>
          Bearer-Zugangsdaten für den MCP-Endpunkt für Agenten, die zur Anmeldung keinen Browser öffnen können — etwa
          Mastra-Workflows, n8n oder CI. Ein Schlüssel handelt in Deinem Namen: Alle Designs werden Dir zugeordnet und
          er erreicht genau die Arbeitsflächen, auf die Du Zugriff hast. Ein Widerruf sperrt den Zugriff sofort.
        </CardDescription>
      </CardHeader>

      <CardRow
        label="Neuer Schlüssel"
        action={
          <Button size="sm" disabled={minting || keys === null} onClick={mint}>
            {minting ? 'Wird erstellt…' : 'Schlüssel erstellen'}
          </Button>
        }
        control={
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError('')
            }}
            placeholder="Wofür wird er verwendet, z. B. mastra-prod"
            maxLength={60}
            aria-label="Name des Agentenschlüssels"
          />
        }
      >
        {error && <Note tone="error">{error}</Note>}
      </CardRow>

      {minted && (
        <CardRow label="Dein neuer Schlüssel">
          <div className="min-w-0 flex-1">
            <Note tone="success">Kopiere ihn jetzt — er wird nur einmal angezeigt und als Hash gespeichert.</Note>
            <CodeBlock className="mt-2" text={minted.secret} />
            <p className="mb-1.5 mt-3 text-caption font-medium text-ink-faint">
              MCP-Konfiguration für einen Client ohne Browser
            </p>
            <CodeBlock text={headlessConfig(minted.secret)} />
          </div>
        </CardRow>
      )}

      {keys?.map((key) => (
        <CardRow
          key={key.id}
          label={key.name}
          action={
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Widerrufen: ${key.name}`}
              onClick={() => setConfirmRevoke(key)}
            >
              <TrashIcon /> Widerrufen
            </Button>
          }
        >
          <span className="font-mono text-body text-ink-soft">{key.start}…</span>
          <Note>
            erstellt {timeAgo(key.createdAt)}
            {key.lastUsedAt ? ` · zuletzt verwendet ${timeAgo(key.lastUsedAt)}` : ' · noch nie verwendet'}
          </Note>
        </CardRow>
      ))}
      {keys && keys.length === 0 && !minted && (
        <CardRow label="Noch keine Schlüssel">
          <Note>
            Interaktive Clients (Claude Code, Codex) brauchen keinen Schlüssel — sie melden sich über OAuth an.
          </Note>
        </CardRow>
      )}
      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={(open) => !open && setConfirmRevoke(null)}
        title={`„${confirmRevoke?.name ?? ''}“ widerrufen?`}
        description="Agenten, die ihn verwenden, verlieren sofort ihren Zugriff."
        confirmLabel="Schlüssel widerrufen"
        destructive
        onConfirm={() => {
          const target = confirmRevoke
          setConfirmRevoke(null)
          if (target) void revoke(target)
        }}
      />
    </SettingsCard>
  )
}
