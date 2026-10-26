import { useEffect, useState } from 'react'
import { api, errorMessage } from '../lib/api'
import { timeAgo } from '../lib/time'
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_LABELS, type WebhookEventType, type WebhookInfo } from '../../shared/webhooks'
import { ConfirmDialog } from './ui/alert-dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Note } from './ui/note'
import { Checkbox } from './ui/checkbox'
import { CodeBlock } from './ui/code-block'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from './ui/card'
import { TrashIcon } from './ui/icons'

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

/** The one-line health of a hook, phrased for a person. */
function health(hook: WebhookInfo): { text: string; tone?: 'error' | 'success' } {
  if (!hook.enabled && (hook.lastError?.startsWith('paused') || hook.lastError?.startsWith('Pausiert nach ')))
    return { text: hook.lastError, tone: 'error' }
  if (!hook.enabled) return { text: 'aus — es wird nichts gesendet' }
  if (!hook.lastAt) return { text: 'noch keine Zustellungen — sende einen Test' }
  if (hook.failures) {
    return {
      text: `${hook.failures} Fehler in Folge · zuletzt ${timeAgo(hook.lastAt)}: ${hook.lastError ?? 'fehlgeschlagen'}`,
      tone: 'error',
    }
  }
  return { text: `zugestellt ${timeAgo(hook.lastAt)} (HTTP ${hook.lastStatus})`, tone: 'success' }
}

/** Picks events with the shared labels; used for the new-hook form. */
function EventPicker({ value, onChange }: { value: WebhookEventType[]; onChange: (next: WebhookEventType[]) => void }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {WEBHOOK_EVENTS.map((event) => {
        const on = value.includes(event)
        return (
          <label key={event} className="relative flex cursor-pointer items-center gap-2 text-body text-ink">
            <Checkbox
              checked={on}
              onChange={() => onChange(on ? value.filter((e) => e !== event) : [...value, event])}
              aria-label={WEBHOOK_EVENT_LABELS[event]}
            />
            <span>
              <code className="font-mono text-caption text-ink-soft">{event}</code>
              <span className="text-ink-faint"> · {WEBHOOK_EVENT_LABELS[event]}</span>
            </span>
          </label>
        )
      })}
    </div>
  )
}

/** The "Webhooks" pane of /settings: register URLs doop POSTs canvas events
 *  to, see whether they answer, rotate their secrets. The secret appears once,
 *  on creation or rotation — the list never carries it. */
export function Webhooks() {
  const [hooks, setHooks] = useState<WebhookInfo[] | null>(null)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<WebhookEventType[]>([...WEBHOOK_EVENTS])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  /* the one moment a secret exists client-side */
  const [secret, setSecret] = useState<{ id: string; secret: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  /* the action awaiting "are you sure" — an in-app dialog, since
     window.confirm is a silent "cancel" in the desktop shell's webview */
  const [confirming, setConfirming] = useState<{ kind: 'rotate' | 'remove'; hook: WebhookInfo } | null>(null)
  const [rowNote, setRowNote] = useState<Record<string, { text: string; tone?: 'error' | 'success' }>>({})

  useEffect(() => {
    api.listWebhooks().then(setHooks, (e: unknown) => {
      console.error(e)
      setHooks([])
      setError(errorMessage(e, 'Deine Webhooks konnten nicht geladen werden'))
    })
  }, [])

  function replace(next: WebhookInfo) {
    setHooks((current) => current?.map((h) => (h.id === next.id ? next : h)) ?? null)
  }

  async function create() {
    setSaving(true)
    setError('')
    try {
      const { secret: fresh, ...info } = await api.createWebhook({ url: url.trim(), events })
      setUrl('')
      setSecret({ id: info.id, secret: fresh })
      setHooks((current) => [info, ...(current ?? [])])
    } catch (e) {
      setError(errorMessage(e, 'Der Webhook konnte nicht erstellt werden'))
    } finally {
      setSaving(false)
    }
  }

  async function act(hook: WebhookInfo, work: () => Promise<void>, failure: string) {
    setBusy(hook.id)
    try {
      await work()
    } catch (e) {
      setRowNote((n) => ({ ...n, [hook.id]: { text: errorMessage(e, failure), tone: 'error' } }))
    } finally {
      setBusy(null)
    }
  }

  const test = (hook: WebhookInfo) =>
    act(
      hook,
      async () => {
        const result = await api.testWebhook(hook.id)
        setRowNote((n) => ({
          ...n,
          [hook.id]: result.ok
            ? { text: `Test mit HTTP-Status ${result.status}`, tone: 'success' }
            : { text: `Test fehlgeschlagen: ${result.error ?? 'keine Antwort'}`, tone: 'error' },
        }))
        const fresh = await api.listWebhooks()
        setHooks(fresh)
      },
      'Der Test konnte nicht gesendet werden',
    )

  const toggle = (hook: WebhookInfo) =>
    act(
      hook,
      async () => replace(await api.updateWebhook(hook.id, { enabled: !hook.enabled })),
      'Speichern fehlgeschlagen',
    )

  const rotate = (hook: WebhookInfo) =>
    act(
      hook,
      async () => {
        const { secret: fresh } = await api.rotateWebhookSecret(hook.id)
        setSecret({ id: hook.id, secret: fresh })
      },
      'Das Geheimnis konnte nicht erneuert werden',
    )

  const remove = (hook: WebhookInfo) =>
    act(
      hook,
      async () => {
        await api.deleteWebhook(hook.id)
        setHooks((current) => current?.filter((h) => h.id !== hook.id) ?? null)
        if (secret?.id === hook.id) setSecret(null)
      },
      'Der Webhook konnte nicht entfernt werden',
    )

  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>Webhooks</CardTitle>
        <CardDescription>
          doop sendet per POST ein signiertes JSON-Ereignis an jede URL unten, wenn auf einer eigenen oder geteilten
          Arbeitsfläche oder in einem Deiner Arbeitsbereiche etwas passiert — leite es an Slack, n8n, eine
          Aufgabenverwaltung oder einen beliebigen HTTP-Endpunkt weiter. Jede Zustellung enthält einen{' '}
          <code className="font-mono text-label">X-Doop-Signature</code> Header (HMAC-SHA256 mit dem Geheimnis des
          Webhooks), damit der Empfänger sie prüfen kann. Fehlgeschlagene Zustellungen werden dreimal wiederholt; ein
          dauerhaft fehlschlagender Webhook pausiert automatisch.
        </CardDescription>
      </CardHeader>

      <CardRow
        label="Neuer Webhook"
        action={
          <Button size="sm" disabled={saving || hooks === null || !url.trim() || !events.length} onClick={create}>
            {saving ? 'Wird hinzugefügt…' : 'Webhook hinzufügen'}
          </Button>
        }
        controlWidth="lg"
        control={
          <Input
            value={url}
            onChange={(e) => {
              setUrl(e.target.value)
              setError('')
            }}
            placeholder="https://hooks.example.com/doop"
            inputMode="url"
            aria-label="Webhook-URL"
          />
        }
      >
        {/* basis-full drops the picker onto its own line under the URL field */}
        <div className="min-w-0 basis-full">
          <EventPicker value={events} onChange={setEvents} />
          {error && <Note tone="error">{error}</Note>}
        </div>
      </CardRow>

      {secret && (
        <CardRow label="Signaturgeheimnis">
          <div className="min-w-0 flex-1">
            <Note tone="success">
              Kopiere es jetzt — es wird nur einmal angezeigt. Prüfe damit die Zustellungen auf Deiner Seite.
            </Note>
            <CodeBlock className="mt-2" text={secret.secret} />
            <Note>
              Signatur = „sha256=“ + HMAC-SHA256(secret, X-Doop-Timestamp + „.“ + unveränderter Anfrageinhalt). Die
              Dokumentation enthält eine fertige Prüfung.
            </Note>
          </div>
        </CardRow>
      )}

      {hooks?.map((hook) => {
        const status = rowNote[hook.id] ?? health(hook)
        return (
          <CardRow
            key={hook.id}
            label={hostOf(hook.url)}
            action={
              <div className="flex flex-wrap items-center gap-1">
                <Button size="sm" variant="ghost" disabled={busy === hook.id} onClick={() => void test(hook)}>
                  Test senden
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === hook.id}
                  onClick={() => setConfirming({ kind: 'rotate', hook })}
                >
                  Geheimnis erneuern
                </Button>
                <Button size="sm" variant="ghost" disabled={busy === hook.id} onClick={() => void toggle(hook)}>
                  {hook.enabled ? 'Ausschalten' : 'Einschalten'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === hook.id}
                  aria-label={`Webhook entfernen für ${hostOf(hook.url)}`}
                  onClick={() => setConfirming({ kind: 'remove', hook })}
                >
                  <TrashIcon /> Entfernen
                </Button>
              </div>
            }
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-body text-ink-soft" title={hook.url}>
                {hook.url}
              </div>
              <div className="mt-1 text-caption text-ink-faint">{hook.events.join(' · ')}</div>
              <Note tone={status.tone}>{status.text}</Note>
            </div>
          </CardRow>
        )
      })}
      {hooks && hooks.length === 0 && !secret && (
        <CardRow label="Noch keine Webhooks">
          <Note>
            Füge oben einen hinzu — zum schnellen Testen eignet sich ein n8n-Webhook-Knoten oder ein Testendpunkt.
          </Note>
        </CardRow>
      )}
      <ConfirmDialog
        open={!!confirming}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={
          confirming?.kind === 'rotate'
            ? `Geheimnis erneuern für ${confirming ? hostOf(confirming.hook.url) : ''}?`
            : `Webhook entfernen für ${confirming ? hostOf(confirming.hook.url) : ''}?`
        }
        description={
          confirming?.kind === 'rotate'
            ? 'Mit dem alten Geheimnis signierte Zustellungen können danach nicht mehr verifiziert werden.'
            : undefined
        }
        confirmLabel={confirming?.kind === 'rotate' ? 'Geheimnis erneuern' : 'Webhook entfernen'}
        destructive
        onConfirm={() => {
          const target = confirming
          setConfirming(null)
          if (target) void (target.kind === 'rotate' ? rotate(target.hook) : remove(target.hook))
        }}
      />
    </SettingsCard>
  )
}
