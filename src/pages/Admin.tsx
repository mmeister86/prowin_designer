import { useEffect, useState } from 'react'
import { adminApi, type AdminCanvas, type AdminUser } from '../lib/api'
import { navigate } from '../App'
import { timeAgo } from '../lib/time'
import { AppRail, railLayout } from '../components/AppRail'
import { ChevronRightIcon, GridIcon, UsersIcon } from '../components/ui/icons'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Button } from '../components/ui/button'
import { ConfirmDialog } from '../components/ui/alert-dialog'
import { Badge } from '../components/ui/badge'
import { SearchField } from '../components/ui/search-field'
import { MetaLine, Tile, TileBody, TileCover } from '../components/ui/tile'
import { Skeleton } from '../components/ui/skeleton'
import { FramePreview } from '../components/FramePreview'
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

/**
 * The instance index: every canvas, every account. Read-only — the way to
 * look inside someone's canvas is "view as", which hands you a real (but
 * read-only, 15-minute) session as its owner rather than granting admins a
 * privileged read path through the canvas gate.
 *
 * Same shell as home and settings; the rail's middle carries the two indexes.
 */
export function Admin() {
  const [data, setData] = useState<{ total: number; canvases: AdminCanvas[] } | null>(null)
  const [users, setUsers] = useState<AdminUser[] | null>(null)
  const [stats, setStats] = useState<{ users: number; canvases: number; frames: number } | null>(null)
  const [tab, setTab] = useState<'canvases' | 'users'>('canvases')
  /* the ban/unban awaiting "are you sure" — an in-app dialog, since
     window.confirm is a silent "cancel" in the desktop shell's webview */
  const [confirmBan, setConfirmBan] = useState<{ user: AdminUser; banned: boolean } | null>(null)
  const [q, setQ] = useState('')
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    adminApi
      .canvases()
      .then(setData)
      .catch(() => setDenied(true))
    adminApi
      .stats()
      .then(setStats)
      .catch(() => {})
    adminApi
      .users()
      .then(setUsers)
      .catch(() => {})
  }, [])

  async function viewAs(userId: string) {
    await adminApi.impersonate(userId)
    /* the session cookie has been replaced — every piece of client state now
       belongs to the wrong person. Reload rather than reconcile. */
    location.assign('/')
  }

  async function setBanned(u: AdminUser, banned: boolean) {
    try {
      if (banned) await adminApi.ban(u.id)
      else await adminApi.unban(u.id)
      setUsers((list) => (list ? list.map((x) => (x.id === u.id ? { ...x, banned } : x)) : list))
    } catch (e) {
      console.error(e)
    }
  }

  if (denied) {
    return (
      <div className="h-full overflow-y-auto [background:radial-gradient(circle,var(--dot)_1px,transparent_1px)_0_0/26px_26px,var(--paper)]">
        <div className="mx-auto max-w-[1060px] px-10 pt-[72px] pb-[120px]">
          <DashTitle className="mt-16">Nicht gefunden</DashTitle>
          <p className="mt-3.5 max-w-[44em] text-lead leading-[1.6] text-ink-soft">
            Diese Seite ist für dieses Konto nicht verfügbar.
          </p>
          <Button variant="ghost" className="mt-5" onClick={() => navigate('/')}>
            Zurück
          </Button>
        </div>
      </div>
    )
  }

  const needle = q.trim().toLowerCase()
  const canvases = (data?.canvases ?? []).filter(
    (c) =>
      !needle ||
      c.name.toLowerCase().includes(needle) ||
      c.owner?.name.toLowerCase().includes(needle) ||
      c.owner?.email.toLowerCase().includes(needle),
  )
  const shownUsers = (users ?? []).filter(
    (u) => !needle || u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
  )

  return (
    <DashLayout className={railLayout}>
      {/* the app rail, with the two indexes as the page's group */}
      <AppRail active={null}>
        <DashSectionLabel density="rail">Instanz</DashSectionLabel>
        <nav className="flex flex-col gap-0.5">
          <DashNavItem
            density="rail"
            icon={<GridIcon size="rail" />}
            count={stats?.canvases.toLocaleString('de-DE') ?? ''}
            active={tab === 'canvases'}
            onClick={() => setTab('canvases')}
          >
            Arbeitsflächen
          </DashNavItem>
          <DashNavItem
            density="rail"
            icon={<UsersIcon size="rail" />}
            count={stats?.users.toLocaleString('de-DE') ?? ''}
            active={tab === 'users'}
            onClick={() => setTab('users')}
          >
            Konten
          </DashNavItem>
        </nav>
      </AppRail>

      <DashMain className="[background:var(--paper)]">
        <DashHeader variant="bare" className="max-md:min-h-[104px]">
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
            <b className="font-semibold text-ink">Administration</b>
          </nav>
          <SearchField
            size="header"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={tab === 'canvases' ? 'Arbeitsflächen oder Eigentümer suchen…' : 'Konten suchen…'}
            aria-label={tab === 'canvases' ? 'Arbeitsflächen oder Eigentümer suchen' : 'Konten suchen'}
          />
        </DashHeader>

        <DashContent>
          <div className="flex items-start gap-4 md:items-end">
            <div>
              <DashTitle>
                Alles auf dieser Instanz<em className="not-italic text-brand">.</em>
              </DashTitle>
              <DashSubtitle>
                {stats
                  ? `${stats.users.toLocaleString('de-DE')} ${stats.users === 1 ? 'Konto' : 'Konten'} · ${stats.canvases.toLocaleString('de-DE')} ${
                      stats.canvases === 1 ? 'Arbeitsfläche' : 'Arbeitsflächen'
                    } · ${stats.frames.toLocaleString('de-DE')} ${stats.frames === 1 ? 'Zeichenfläche' : 'Zeichenflächen'}`
                  : '…'}
              </DashSubtitle>
            </div>
          </div>

          <Tabs
            value={tab}
            onValueChange={(next) => setTab(next as 'canvases' | 'users')}
            className="mt-4 flex md:hidden"
          >
            <TabsList variant="card">
              <TabsTrigger value="canvases">
                <GridIcon size="rail" /> Arbeitsflächen · {stats?.canvases.toLocaleString('de-DE') ?? '…'}
              </TabsTrigger>
              <TabsTrigger value="users">
                <UsersIcon size="rail" /> Konten · {stats?.users.toLocaleString('de-DE') ?? '…'}
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {tab === 'canvases' ? (
            <>
              {data && data.total > data.canvases.length && (
                <div className="mt-[18px] flex flex-wrap items-center gap-2.5 text-xs text-ink-faint">
                  <span>
                    Angezeigt werden die {data.canvases.length.toLocaleString('de-DE')} zuletzt aktualisierten von{' '}
                    {data.total.toLocaleString('de-DE')}
                  </span>
                </div>
              )}
              <div className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3.5 xs:grid-cols-[repeat(auto-fill,minmax(214px,1fr))] md:gap-4">
                {data === null && [0, 1, 2, 3].map((i) => <Skeleton key={i} index={i} shape="tile" aspect="4/3" />)}
                {canvases.map((c) => (
                  <Tile key={c.id} tone="solid">
                    <TileCover aspect="4/3">
                      <FramePreview frameId={c.previewFrameId} />
                    </TileCover>
                    <TileBody className="flex flex-1 flex-col">
                      <div className="truncate font-display text-copy font-semibold">{c.name}</div>
                      <MetaLine
                        className="mt-[5px] min-h-0 flex-wrap content-start xs:min-h-[30px]"
                        trailing={
                          c.linkAccess === 'edit' && (
                            <Badge
                              className="px-[5px] py-px text-micro"
                              title="Alle mit dem Link können diese Arbeitsfläche bearbeiten"
                            >
                              Link aktiv
                            </Badge>
                          )
                        }
                      >
                        <span>{c.owner ? c.owner.name : 'ohne Eigentümer'}</span>
                        <span>
                          {c.frameCount.toLocaleString('de-DE')} Zeichenfläche{c.frameCount === 1 ? '' : 'n'}
                        </span>
                        <span>{timeAgo(c.updatedAt)}</span>
                        {c.memberCount > 0 && <span>{c.memberCount.toLocaleString('de-DE')} eingeladen</span>}
                      </MetaLine>
                      {c.owner && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-auto self-start"
                          onClick={() => viewAs(c.owner!.id)}
                        >
                          Ansicht als {c.owner.name.split(' ')[0]}
                        </Button>
                      )}
                    </TileBody>
                  </Tile>
                ))}
              </div>
            </>
          ) : (
            <div className="mt-4 overflow-hidden rounded-panel border border-line bg-surface shadow-card">
              {users === null && <p className="mt-7 text-copy text-ink-soft">…</p>}
              {shownUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex flex-col items-stretch justify-between gap-2.5 border-b border-line-soft p-3.5 last:border-b-0 md:flex-row md:items-center md:gap-4 md:px-[18px] md:py-[13px]"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-display text-copy font-semibold">
                      {u.name}
                      {u.role === 'admin' && <Badge tone="admin">Administration</Badge>}
                      {u.banned && <Badge tone="banned">gesperrt</Badge>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-body text-ink-faint">
                      <span>{u.email}</span>
                      <span>·</span>
                      <span>
                        {u.canvasCount.toLocaleString('de-DE')}{' '}
                        {u.canvasCount === 1 ? 'Arbeitsfläche' : 'Arbeitsflächen'}
                      </span>
                      <span>·</span>
                      <span>beigetreten {timeAgo(u.createdAt)}</span>
                    </div>
                  </div>
                  {u.role !== 'admin' && (
                    <div className="flex flex-wrap items-center gap-2">
                      {!u.banned && (
                        <Button variant="ghost" size="sm" onClick={() => viewAs(u.id)}>
                          Ansicht als
                        </Button>
                      )}
                      <Button
                        variant={u.banned ? 'ghost' : 'danger'}
                        size="sm"
                        onClick={() => setConfirmBan({ user: u, banned: !u.banned })}
                      >
                        {u.banned ? 'Entsperren' : 'Sperren'}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashContent>
      </DashMain>
      <ConfirmDialog
        open={!!confirmBan}
        onOpenChange={(open) => !open && setConfirmBan(null)}
        title={`${confirmBan?.banned ? 'Sperren' : 'Entsperren'} ${confirmBan?.user.name ?? ''} (${confirmBan?.user.email ?? ''})?`}
        description={
          confirmBan?.banned
            ? 'Die Person wird überall abgemeldet und kann sich bis zur Entsperrung weder anmelden noch MCP nutzen.'
            : undefined
        }
        confirmLabel={confirmBan?.banned ? 'Sperren' : 'Entsperren'}
        destructive={confirmBan?.banned}
        onConfirm={() => {
          const target = confirmBan
          setConfirmBan(null)
          if (target) void setBanned(target.user, target.banned)
        }}
      />
    </DashLayout>
  )
}
