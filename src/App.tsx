import { startLocalAgent } from './lib/localAgent'
import { OPTIONAL_FEATURES } from '../shared/prowin/features'
import { navigate } from './lib/navigate'
import { useEffect, useState } from 'react'
import { Home } from './pages/Home'
import { Community } from './pages/Community'
import { Settings } from './pages/Settings'
import { CanvasPage } from './pages/CanvasPage'
import { AuthPage } from './pages/AuthPage'
import { DesktopHandoff } from './pages/DesktopHandoff'
import { DesktopSignIn } from './pages/DesktopSignIn'
import { DesktopCodexSetup } from './pages/DesktopCodexSetup'
import { CODEX_SETUP_PATH } from './lib/codexConnection'
import { OAuthConsent } from './pages/OAuthConsent'
import { DESKTOP_HANDOFF_PATH, DESKTOP_SIGNIN_PATH } from './lib/desktopAuth'
import { Admin } from './pages/Admin'
import { Automations } from './pages/Automations'
import { AutomationEditor } from './pages/AutomationEditor'
import { Integrations } from './pages/Integrations'
import { Workspace } from './pages/Workspace'
import { authClient } from './lib/auth'
import { setName } from './lib/identity'
import { useMe } from './lib/me'
import { adminApi } from './lib/api'
import { Button } from './components/ui/button'
import { AuthScreen } from './components/ui/screen'
import { DesktopTabs, ShellDragBar } from './components/DesktopTabs'
import { setTabsUser } from './lib/desktop'
import { isDesktopShell } from './lib/shell'

export { navigate }

export function App() {
  const [route, setRoute] = useState(location.pathname + location.search)
  const path = route.split('?')[0]!
  const { data: session, isPending } = authClient.useSession()
  const me = useMe(session?.user.id)

  useEffect(() => {
    const onPop = () => setRoute(location.pathname + location.search)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  /* Reaching /admin mid "view as" — usually the Back button, since /admin
     stays in history when impersonation starts — can only mean "return to
     being the admin": the borrowed session has no admin access, so rendering
     the page would show its not-found screen. End the impersonation and
     arrive as the admin instead. */
  const canvasId = path.match(/^\/c\/([^/]+)/)?.[1]

  const returningToAdmin = !!me?.impersonating && path.startsWith('/admin')
  useEffect(() => {
    if (!returningToAdmin) return
    adminApi
      .stopImpersonating()
      .then(() => location.assign('/admin'))
      .catch(() => location.assign('/'))
  }, [returningToAdmin])

  /* the account name is the identity shown on cursors and in the feed */
  useEffect(() => {
    if (session?.user?.name) setName(session.user.name)
  }, [session?.user?.name])

  /* the desktop tab strip is per-account state: restore this user's tabs,
     and clear the strip the moment the session goes away */
  useEffect(() => {
    if (!isPending) setTabsUser(session?.user?.id ?? null)
  }, [isPending, session?.user?.id])

  const localAgentUser = !isPending && me?.creator && !me.impersonating ? session?.user.id : undefined
  useEffect(() => {
    if (localAgentUser) return startLocalAgent(localAgentUser)
  }, [localAgentUser])

  if (isPending)
    return (
      <>
        <ShellDragBar />
        <AuthScreen />
      </>
    )
  /* the desktop app sent this browser here to begin a provider sign-in on
     its behalf (src/lib/desktopAuth.ts) — signed in or not, the page itself
     decides where to go next */
  if (path === DESKTOP_SIGNIN_PATH)
    return (
      <>
        <ShellDragBar />
        <DesktopSignIn signedIn={!!session} />
      </>
    )

  /* signed out: every path lands on the sign-in form. The marketing site is
     a separate service (see server/marketing.ts) that owns `/` for
     visitors; share links (/c/…) and interrupted MCP OAuth redirects keep
     their URL so the deep link / resume logic survives the sign-in. */
  if (!session)
    return (
      <>
        <ShellDragBar />
        <AuthPage />
      </>
    )

  /* /admin waits for /api/me: before it answers we can't tell an admin from
     a borrowed "view as" session, and rendering Admin in the latter flashes
     its not-found screen. Also blank while the effect above swaps the
     session back and reloads. */
  if (path.startsWith('/admin') && (!me || returningToAdmin)) return <div className="auth-page" />

  const page = canvasId ? (
    <CanvasPage canvasId={canvasId} key={canvasId} />
  ) : path === CODEX_SETUP_PATH ? (
    <DesktopCodexSetup key={route} />
  ) : path === DESKTOP_HANDOFF_PATH ? (
    <DesktopHandoff />
  ) : path === '/oauth/consent' ? (
    <OAuthConsent email={session.user.email} />
  ) : path.startsWith('/admin') ? (
    <Admin />
  ) : path.startsWith('/settings') ? (
    <Settings />
  ) : path.startsWith('/community') ? (
    <Community />
  ) : OPTIONAL_FEATURES.metaAds && path.startsWith('/integrations') ? (
    <Integrations />
  ) : path.match(/^\/w\/([^/]+)/) ? (
    <Workspace workspaceId={path.match(/^\/w\/([^/]+)/)![1]!} key={path} />
  ) : OPTIONAL_FEATURES.automations && path.match(/^\/automations\/([^/]+)/) ? (
    <AutomationEditor automationId={path.match(/^\/automations\/([^/]+)/)![1]!} key={path} />
  ) : OPTIONAL_FEATURES.automations && path.startsWith('/automations') ? (
    <Automations />
  ) : (
    <Home />
  )

  /* The banner is not decoration: an impersonated session looks exactly like
     being signed in as that person, and forgetting you are in one is how
     support tools cause incidents. */
  return me?.impersonating ? (
    <>
      <ImpersonationBanner name={session.user.name} />
      {/* --app-inset is the contract with fixed-position screens: the canvas
          workspace is `fixed inset-0` and ignores this padding, so it offsets
          itself by the same variable instead of hardcoding the banner height */}
      <div className="h-dvh overflow-auto pt-14 [--app-inset:56px] sm:pt-10 sm:[--app-inset:40px]">{page}</div>
    </>
  ) : isDesktopShell() ? (
    /* the desktop shell's tab strip uses the same --app-inset contract as
       the banner: fixed screens (the canvas workspace) offset themselves */
    <>
      <DesktopTabs path={path} />
      <div className="h-dvh overflow-auto pt-10 [--app-inset:40px]">{page}</div>
    </>
  ) : (
    page
  )
}

function ImpersonationBanner({ name }: { name: string }) {
  const [leaving, setLeaving] = useState(false)
  return (
    <div className="fixed inset-x-0 top-0 z-[900] flex min-h-14 items-center justify-between gap-2 border-b border-accent-ink px-2.5 py-[7px] text-[11.5px] leading-tight text-accent-ink backdrop-blur-[6px] [background:repeating-linear-gradient(-45deg,rgba(208,52,31,0.16)_0_10px,rgba(208,52,31,0.08)_10px_20px)] sm:h-10 sm:min-h-0 sm:justify-center sm:gap-4 sm:text-[13px]">
      <span>
        Ansicht als <strong>{name}</strong> — schreibgeschützt, endet nach 15 Minuten.
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={leaving}
        onClick={() => {
          setLeaving(true)
          /* the cookie swaps back to the admin's own session; reload rather
             than reconcile every piece of per-user state in memory */
          adminApi
            .stopImpersonating()
            .then(() => location.assign('/admin'))
            .catch(() => location.assign('/'))
        }}
      >
        {leaving ? 'Ansicht wird beendet…' : 'Ansicht beenden'}
      </Button>
    </div>
  )
}
