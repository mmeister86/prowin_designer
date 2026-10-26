import { useCallback, useEffect, useState } from 'react'
import type { WorkspaceDetail, WorkspaceRole, WorkspaceSummary } from '../../shared/types'
import { formatUsd, STATUS_LABELS, TEAM_SEAT_PRICE } from '../../shared/billing'
import { navigate } from '../App'
import { api, errorMessage, paywalledWorkspace } from '../lib/api'
import { authClient } from '../lib/auth'
import { AppRail, railLayout } from '../components/AppRail'
import { UpgradeModal } from '../components/WorkspaceModals'
import { Avatar } from '../components/ui/avatar'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Callout } from '../components/ui/callout'
import { CardBody, CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from '../components/ui/card'
import { ConfirmDialog } from '../components/ui/alert-dialog'
import { Input } from '../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { PersonRow } from '../components/ui/list'
import { Skeleton } from '../components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Toast } from '../components/ui/toast'
import { ChevronRightIcon, CreditCardIcon, GearIcon, UsersIcon } from '../components/ui/icons'
import {
  DashContent,
  DashHeader,
  DashLayout,
  DashMain,
  DashNavItem,
  DashSectionLabel,
  DashSubtitle,
  DashTitle,
} from '../components/ui/dash'
import { timeAgo } from '../lib/time'

type Pane = 'members' | 'billing' | 'general'
const WORKSPACE_ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: 'Eigentümer',
  creator: 'Creator',
  member: 'Mitglied',
}

/**
 * One workspace's settings, in the dashboard shell: who is in it, what it
 * costs, and the name. Stripe's hosted pages do the money — this page only
 * opens them and mirrors what they did. It is also where Checkout lands
 * back (?checkout=success), so the plan takes effect on the screen they see.
 */
export function Workspace({ workspaceId }: { workspaceId: string }) {
  const { data: session } = authClient.useSession()
  const meId = session?.user.id
  const [ws, setWs] = useState<WorkspaceDetail | null>(null)
  const [missing, setMissing] = useState(false)
  const [upgrade, setUpgrade] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  /* the checkout round-trip lands here with its outcome in the query; read
     once, then clean the URL in the effect below */
  const [landing] = useState(() => {
    const q = new URLSearchParams(location.search)
    return { checkout: q.get('checkout'), sessionId: q.get('session_id') ?? undefined }
  })
  const [pane, setPane] = useState<Pane>(landing.checkout ? 'billing' : 'members')

  /* the rail's workspace list, reloaded with the workspace so a rename or a
     new plan shows in its row too */
  const [spaces, setSpaces] = useState<WorkspaceSummary[] | undefined>(undefined)

  const reload = useCallback(() => {
    api
      .getWorkspace(workspaceId)
      .then(setWs)
      .catch(() => setMissing(true))
    api
      .listWorkspaces()
      .then((w) => setSpaces(w.workspaces))
      .catch(console.error)
  }, [workspaceId])

  useEffect(() => {
    if (landing.checkout) history.replaceState(null, '', location.pathname)
    if (landing.checkout === 'success') {
      /* pull the subscription now rather than wait for the webhook */
      api
        .syncWorkspaceBilling(workspaceId, landing.sessionId)
        .then((summary) => {
          if (summary.active && summary.plan) {
            showToast('Der Team-Tarif ist aktiv — willkommen an Bord')
          }
        })
        .catch(console.error)
        .finally(reload)
    } else {
      if (landing.checkout === 'canceled') showToast('Zahlung abgebrochen — es wurde nichts berechnet')
      reload()
    }
  }, [landing, workspaceId, reload])

  function showToast(message: string) {
    setToast(message)
    window.setTimeout(() => setToast(null), 3200)
  }

  /** every 402 on this page means the same thing */
  function handle(caught: unknown, fallback: string) {
    const walled = paywalledWorkspace(caught)
    if (walled) setUpgrade(`„${ws?.name ?? 'Dieser Arbeitsbereich'}“ benötigt zuerst einen Tarif.`)
    else showToast(errorMessage(caught, fallback))
  }

  const admin = ws?.role === 'owner'
  const isOwner = ws?.role === 'owner'

  if (missing) {
    return (
      <DashLayout className={railLayout}>
        <AppRail active={null} />
        <DashMain className="[background:var(--paper)]">
          <DashHeader variant="bare" />
          <DashContent>
            <DashTitle>Arbeitsbereich nicht gefunden</DashTitle>
            <DashSubtitle>Er wurde möglicherweise gelöscht oder Du bist kein Mitglied mehr.</DashSubtitle>
            <Button className="mt-5" onClick={() => navigate('/')}>
              Zurück zu den Arbeitsflächen
            </Button>
          </DashContent>
        </DashMain>
      </DashLayout>
    )
  }

  return (
    <DashLayout className={railLayout}>
      {/* the app rail, lit on this workspace, with its panes as the page's group */}
      <AppRail active={`ws:${workspaceId}`} workspaces={spaces}>
        <DashSectionLabel density="rail">{ws?.name ?? 'Arbeitsbereich'}</DashSectionLabel>
        <nav className="flex flex-col gap-0.5">
          <DashNavItem
            density="rail"
            icon={<UsersIcon size="rail" />}
            active={pane === 'members'}
            onClick={() => setPane('members')}
          >
            Personen
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<CreditCardIcon size="rail" />}
            active={pane === 'billing'}
            onClick={() => setPane('billing')}
          >
            Tarif &amp; Abrechnung
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<GearIcon size="rail" />}
            active={pane === 'general'}
            onClick={() => setPane('general')}
          >
            Allgemein
          </DashNavItem>
        </nav>
      </AppRail>

      <DashMain className="[background:var(--paper)]">
        <DashHeader variant="bare">
          <nav className="flex items-center gap-2 text-body text-ink-faint" aria-label="Navigationspfad">
            <Button
              variant="link"
              size="sm"
              className="px-0 py-0 text-body font-normal text-ink-faint hover:text-ink"
              onClick={() => navigate('/')}
            >
              Startseite
            </Button>
            <ChevronRightIcon size={12} />
            <b className="truncate font-semibold text-ink">{ws?.name ?? '…'}</b>
          </nav>
        </DashHeader>

        <DashContent>
          <div className="flex items-start gap-4 md:items-end">
            <div className="min-w-0">
              <DashTitle className="truncate">{ws?.name ?? '…'}</DashTitle>
              <DashSubtitle>
                {ws
                  ? `${ws.memberCount.toLocaleString('de-DE')} ${ws.memberCount === 1 ? 'Person' : 'Personen'} · ${ws.canvasCount.toLocaleString('de-DE')} ${
                      ws.canvasCount === 1 ? 'Arbeitsfläche' : 'Arbeitsflächen'
                    } · ${ws.billing.enabled ? STATUS_LABELS[ws.status] : 'Selbst gehostet, inklusive'}`
                  : '…'}
              </DashSubtitle>
            </div>
          </div>

          <Tabs value={pane} onValueChange={(next) => setPane(next as Pane)} className="mt-4 flex md:hidden">
            <TabsList variant="card">
              <TabsTrigger value="members">Personen</TabsTrigger>
              <TabsTrigger value="billing">Abrechnung</TabsTrigger>
              <TabsTrigger value="general">Allgemein</TabsTrigger>
            </TabsList>
          </Tabs>

          {ws && ws.billing.enabled && !ws.active && (
            <Callout className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="flex-1">
                <b>Noch kein Tarif.</b> Du kannst Personen einladen und Arbeitsflächen hinzufügen, sobald dieser
                Arbeitsbereich den Team-Tarif nutzt.
                {ws.status === 'canceled' ? ' Deine bestehenden Arbeitsflächen bleiben für alle darin zugänglich.' : ''}
              </span>
              {isOwner && (
                <Button variant="primary" size="sm" onClick={() => setUpgrade('')}>
                  {ws.status === 'canceled' ? 'Reaktivieren' : 'Tarif auswählen'}
                </Button>
              )}
            </Callout>
          )}
          {ws && ws.status === 'past_due' && (
            <Callout tone="error" className="mt-4">
              <b>Die letzte Zahlung ist fehlgeschlagen.</b> Stripe versucht es erneut. Aktualisiere die Karte im
              Abrechnungsportal, um den Tarif beizubehalten.
            </Callout>
          )}

          {!ws ? (
            <Skeleton shape="card" className="mt-5 max-w-[1000px]" />
          ) : pane === 'members' ? (
            <MembersPane ws={ws} meId={meId} admin={admin} onChange={reload} onError={handle} onToast={showToast} />
          ) : pane === 'billing' ? (
            <BillingPane
              ws={ws}
              isOwner={isOwner}
              onUpgrade={() => setUpgrade('')}
              onSynced={reload}
              onToast={showToast}
            />
          ) : (
            <GeneralPane ws={ws} admin={admin} isOwner={isOwner} onChange={reload} onToast={showToast} />
          )}
        </DashContent>
      </DashMain>

      {upgrade !== null && (
        <UpgradeModal
          workspaceId={workspaceId}
          reason={upgrade || undefined}
          onClose={() => {
            setUpgrade(null)
            reload()
          }}
        />
      )}
      {toast && <Toast>{toast}</Toast>}
    </DashLayout>
  )
}

/* ---- people ---- */

function MembersPane({
  ws,
  meId,
  admin,
  onChange,
  onError,
  onToast,
}: {
  ws: WorkspaceDetail
  meId?: string
  admin: boolean
  onChange: () => void
  onError: (caught: unknown, fallback: string) => void
  onToast: (message: string) => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState<{ userId: string; name: string } | null>(null)

  async function invite() {
    const clean = email.trim()
    if (!clean || busy) return
    setBusy(true)
    try {
      const result = await api.inviteToWorkspace(ws.id, clean, role)
      if ('member' in result) onToast(`${result.member.name} ist dabei`)
      else
        onToast(
          result.emailed
            ? `Einladung per E-Mail gesendet an ${clean}`
            : `${clean} tritt bei der Registrierung mit dieser E-Mail-Adresse bei`,
        )
      setEmail('')
      onChange()
    } catch (caught) {
      onError(caught, 'Einladung fehlgeschlagen')
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(userId: string, next: WorkspaceRole) {
    try {
      await api.setWorkspaceRole(ws.id, userId, next)
      onChange()
    } catch (caught) {
      onError(caught, 'Die Rolle konnte nicht geändert werden')
    }
  }

  async function remove(userId: string) {
    try {
      await api.removeWorkspaceMember(ws.id, userId)
      if (userId === meId) navigate('/')
      else onChange()
    } catch (caught) {
      onError(caught, 'Entfernen fehlgeschlagen')
    }
  }

  async function revoke(inviteId: string) {
    try {
      await api.revokeWorkspaceInvite(ws.id, inviteId)
      onChange()
    } catch (caught) {
      onError(caught, 'Die Einladung konnte nicht widerrufen werden')
    }
  }

  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>Personen</CardTitle>
        <CardDescription>
          Alle hier können jede Arbeitsfläche im Arbeitsbereich öffnen. Nur der Eigentümer verwaltet Personen und
          Abrechnung. Der Creator-Zugang erfordert eine vorherige Creator-Registrierung. Mitglieder können ohne
          Creator-Registrierung mitarbeiten.
          {ws.billing.enabled ? ' Jede Person belegt einen Platz.' : ''}
        </CardDescription>
        {admin && (
          <div className="mt-4 flex flex-col items-stretch gap-2 sm:flex-row">
            <Input
              variant="well"
              className="flex-1"
              placeholder="Per E-Mail einladen"
              type="email"
              value={email}
              disabled={busy}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && invite()}
              aria-label="E-Mail-Adresse für die Einladung"
            />
            <Select value={role} disabled={busy} onValueChange={(value) => setRole(value as WorkspaceRole)}>
              <SelectTrigger aria-label="Rolle">
                <SelectValue />
              </SelectTrigger>
              <RoleOptions />
            </Select>
            <Button variant="primary" className="justify-center" disabled={busy || !email.trim()} onClick={invite}>
              {busy ? 'Einladung wird gesendet…' : 'Einladen'}
            </Button>
          </div>
        )}
      </CardHeader>
      <div>
        {ws.members.map((m) => {
          const self = m.userId === meId
          const isOwnerRow = m.role === 'owner'
          return (
            <CardRow
              key={m.userId}
              className="py-3"
              action={
                isOwnerRow ? (
                  <Badge tone="accent">Eigentümer</Badge>
                ) : admin ? (
                  <>
                    <Select value={m.role} onValueChange={(value) => changeRole(m.userId, value as WorkspaceRole)}>
                      <SelectTrigger size="sm" aria-label={`Rolle von ${m.name}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <RoleOptions />
                    </Select>
                    <Button
                      variant="bare-danger"
                      size="sm"
                      onClick={() => setRemoving({ userId: m.userId, name: self ? 'Dich selbst' : m.name })}
                    >
                      {self ? 'Verlassen' : 'Entfernen'}
                    </Button>
                  </>
                ) : (
                  <>
                    <Badge>{WORKSPACE_ROLE_LABELS[m.role]}</Badge>
                    {self && (
                      <Button
                        variant="bare-danger"
                        size="sm"
                        onClick={() => setRemoving({ userId: m.userId, name: 'Dich selbst' })}
                      >
                        Verlassen
                      </Button>
                    )}
                  </>
                )
              }
            >
              <PersonRow
                className="flex-1"
                avatar={<Avatar name={m.name} size={32} />}
                name={`${m.name}${self ? ' (Du)' : ''}`}
                detail={`${m.email} · beigetreten am ${timeAgo(m.addedAt)}`}
              />
            </CardRow>
          )
        })}
        {ws.invites.length > 0 && (
          <CardBody className="border-t border-line-soft bg-paper/60">
            <span className="text-caption text-ink-faint">Wartet auf die Registrierung</span>
            {ws.invites.map((inv) => (
              <div key={inv.id} className="mt-2 flex items-center gap-3 text-body">
                <span className="min-w-0 flex-1 truncate">
                  {inv.email}{' '}
                  <span className="text-ink-faint">
                    · {WORKSPACE_ROLE_LABELS[inv.role]} · eingeladen von {inv.invitedByName}
                  </span>
                </span>
                <Button variant="bare" size="sm" onClick={() => revoke(inv.id)}>
                  Widerrufen
                </Button>
              </div>
            ))}
          </CardBody>
        )}
      </div>
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={removing?.userId === meId ? `„${ws.name}“ verlassen?` : `Entfernen: ${removing?.name ?? ''}?`}
        description={
          removing?.userId === meId
            ? 'Du verlierst den Zugriff auf alle Arbeitsflächen in diesem Arbeitsbereich, außer auf Deine eigenen.'
            : 'Die Person verliert den Zugriff auf alle Arbeitsflächen in diesem Arbeitsbereich, außer auf ihre eigenen. Ihr Platz wird freigegeben.'
        }
        confirmLabel={removing?.userId === meId ? 'Arbeitsbereich verlassen' : 'Entfernen'}
        destructive
        onConfirm={() => {
          if (removing) void remove(removing.userId)
          setRemoving(null)
        }}
      />
    </SettingsCard>
  )
}

/* ---- plan & billing ---- */

function BillingPane({
  ws,
  isOwner,
  onUpgrade,
  onSynced,
  onToast,
}: {
  ws: WorkspaceDetail
  isOwner: boolean
  onUpgrade: () => void
  onSynced: () => void
  onToast: (message: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const perSeat = ws.interval ? TEAM_SEAT_PRICE[ws.interval] : TEAM_SEAT_PRICE.month
  const paid = ws.plan === 'team' && ws.status !== 'inactive'

  async function portal() {
    if (busy) return
    setBusy(true)
    try {
      const { url } = await api.workspacePortal(ws.id)
      location.assign(url)
    } catch (caught) {
      onToast(errorMessage(caught, 'Das Abrechnungsportal konnte nicht geöffnet werden'))
      setBusy(false)
    }
  }

  async function sync() {
    if (busy) return
    setBusy(true)
    try {
      await api.syncWorkspaceBilling(ws.id)
      onSynced()
      onToast('Mit Stripe synchronisiert')
    } catch (caught) {
      onToast(errorMessage(caught, 'Aktualisieren fehlgeschlagen'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <SettingsCard>
      <CardHeader>
        <CardTitle>Tarif &amp; Abrechnung</CardTitle>
        <CardDescription>
          {ws.billing.enabled
            ? 'Der Team-Tarif wird pro Platz abgerechnet: für jede Person im Arbeitsbereich, monatlich oder jährlich. Die Plätze richten sich nach der Personenliste — mit neuen Personen steigt die nächste Rechnung, beim Entfernen sinkt sie.'
            : 'Auf diesem Server ist keine Abrechnung eingerichtet. Bei selbst gehostetem doop sind Arbeitsbereiche inklusive; hier fallen keine Kosten an.'}
        </CardDescription>
      </CardHeader>
      <CardRow label="Tarif">
        <b className="text-copy">{paid ? 'Team' : ws.billing.enabled ? 'Persönlich' : 'Selbst gehostet'}</b>
        {ws.billing.enabled && (
          <Badge
            tone={
              ws.status === 'active' || ws.status === 'trialing'
                ? 'accent'
                : ws.status === 'past_due'
                  ? 'banned'
                  : 'default'
            }
          >
            {STATUS_LABELS[ws.status]}
          </Badge>
        )}
        {ws.cancelAtPeriodEnd && ws.currentPeriodEnd && (
          <span className="text-label text-ink-faint">
            endet {new Date(ws.currentPeriodEnd).toLocaleDateString('de-DE')}
          </span>
        )}
      </CardRow>
      {paid && (
        <>
          <CardRow label="Plätze">
            <span className="text-copy">
              {ws.seats.toLocaleString('de-DE')} × {formatUsd(perSeat)} = <b>{formatUsd(ws.seats * perSeat)}</b> pro{' '}
              {ws.interval === 'year' ? 'Jahr' : 'Monat'}
            </span>
            {ws.seats !== ws.memberCount && (
              <span className="text-label text-ink-faint">
                ({ws.memberCount.toLocaleString('de-DE')} {ws.memberCount === 1 ? 'Person' : 'Personen'} jetzt — Stripe
                gleicht dies mit der nächsten Rechnung ab)
              </span>
            )}
          </CardRow>
          {ws.currentPeriodEnd && (
            <CardRow label={ws.cancelAtPeriodEnd ? 'Endet' : 'Verlängert sich am'}>
              <span className="text-copy">{new Date(ws.currentPeriodEnd).toLocaleDateString('de-DE')}</span>
            </CardRow>
          )}
        </>
      )}
      {ws.billing.enabled && (
        <CardRow label="Verwalten">
          {isOwner ? (
            <>
              {!ws.active || !paid ? (
                <Button variant="primary" onClick={onUpgrade}>
                  {ws.status === 'canceled' ? 'Team-Tarif reaktivieren' : 'Tarif auswählen'}
                </Button>
              ) : null}
              {ws.billing.portal && (
                <Button onClick={portal} disabled={busy}>
                  {busy ? 'Wird geöffnet…' : 'Abrechnung bei Stripe verwalten'}
                </Button>
              )}
              {ws.billing.portal && (
                <Button variant="ghost" onClick={sync} disabled={busy}>
                  Aktualisieren
                </Button>
              )}
              <span className="text-label text-ink-faint">Karten, Rechnungen, Kündigung — alles im Stripe-Portal.</span>
            </>
          ) : (
            <span className="text-body text-ink-soft">
              Der Eigentümer ist für die Abrechnung verantwortlich; nur er kann den Tarif ändern.
            </span>
          )}
        </CardRow>
      )}
    </SettingsCard>
  )
}

/* ---- general ---- */

function GeneralPane({
  ws,
  admin,
  isOwner,
  onChange,
  onToast,
}: {
  ws: WorkspaceDetail
  admin: boolean
  isOwner: boolean
  onChange: () => void
  onToast: (message: string) => void
}) {
  const [name, setName] = useState(ws.name)
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function rename() {
    const clean = name.trim()
    if (!clean || clean === ws.name || busy) return
    setBusy(true)
    try {
      await api.renameWorkspace(ws.id, clean)
      onChange()
      onToast('Umbenannt')
    } catch (caught) {
      onToast(errorMessage(caught, 'Umbenennen fehlgeschlagen'))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await api.deleteWorkspace(ws.id)
      navigate('/')
    } catch (caught) {
      onToast(errorMessage(caught, 'Der Arbeitsbereich konnte nicht gelöscht werden'))
      setBusy(false)
    }
  }

  return (
    <>
      <SettingsCard>
        <CardHeader>
          <CardTitle>Allgemein</CardTitle>
          <CardDescription>
            Der Name, den alle in ihrer Seitenleiste und auf den hier abgelegten Arbeitsflächen sehen.
          </CardDescription>
        </CardHeader>
        <CardRow
          label="Name"
          action={
            admin ? (
              <Button size="sm" disabled={busy || !name.trim() || name.trim() === ws.name} onClick={rename}>
                Speichern
              </Button>
            ) : undefined
          }
        >
          <Input
            variant="well"
            className="max-w-[360px]"
            value={name}
            maxLength={80}
            disabled={!admin || busy}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && rename()}
            aria-label="Name des Arbeitsbereichs"
          />
        </CardRow>
        <CardRow label="Erstellt">
          <span className="text-body text-ink-soft">{timeAgo(ws.createdAt)}</span>
        </CardRow>
      </SettingsCard>
      {isOwner && (
        <SettingsCard tone="flat" className="border-accent-ink/30">
          <CardHeader>
            <CardTitle className="text-accent-ink">Arbeitsbereich löschen</CardTitle>
            <CardDescription>
              Jede Arbeitsfläche kehrt in den persönlichen Bereich ihres Eigentümers zurück — es wird nichts gelöscht.
              Personen verlieren den Zugriff auf fremde Arbeitsflächen.
              {ws.billing.enabled && ws.plan ? ' Das Team-Abonnement wird sofort gekündigt.' : ''}
            </CardDescription>
          </CardHeader>
          <CardBody>
            <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              „{ws.name}“ löschen
            </Button>
          </CardBody>
        </SettingsCard>
      )}
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`„${ws.name}“ löschen?`}
        description="Arbeitsflächen kehren zu ihren Eigentümern zurück und das Abonnement endet jetzt. Das lässt sich nicht rückgängig machen."
        confirmLabel="Arbeitsbereich löschen"
        destructive
        onConfirm={() => {
          setConfirmDelete(false)
          void remove()
        }}
      />
    </>
  )
}

/** The roles the owner can hand out; the owner is not one of them. */
function RoleOptions() {
  return (
    <SelectContent>
      <SelectItem value="member">Mitglied</SelectItem>
      <SelectItem value="creator">Creator</SelectItem>
    </SelectContent>
  )
}
