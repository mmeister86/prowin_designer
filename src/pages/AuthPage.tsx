import { useEffect, useState } from 'react'
import { authClient, authErrorMessage, type AuthFailure } from '../lib/auth'
import { BrandMark } from '../components/ui/brand-mark'
import { setName } from '../lib/identity'
import { beginBrowserSignIn, supportsBrowserSignIn } from '../lib/desktop'
import type { DesktopSignInProvider, ProviderRedirects } from '../lib/desktopAuth'
import { safeRelativeTarget } from '../lib/safeTarget'
import { CODEX_SETUP_PATH } from '../lib/codexConnection'
import { FIRST_CANVAS_PATH } from '../../shared/firstCanvas'
import { isDesktopShell } from '../lib/shell'
import { AuthCard, AuthCardText, AuthScreen } from '../components/ui/screen'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Field } from '../components/ui/field'
import { Callout } from '../components/ui/callout'

/* If login interrupted an MCP OAuth authorize redirect, send the browser
   back into the flow so the agent connection completes. */
/* better-auth deliberately returns the same "invalid email or password" for
   unknown emails and wrong passwords; this tells the two apart so the login
   page can route would-be signups to the right form. */
async function accountExists(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/account-exists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) return true // unknown — fall back to the generic error
    return (await res.json()).exists
  } catch {
    return true
  }
}

function interruptedTarget(): string | null {
  if (location.pathname === '/oauth/consent' || location.pathname === CODEX_SETUP_PATH)
    return location.pathname + location.search
  const params = new URLSearchParams(location.search)
  const target = safeRelativeTarget(params.get('redirect_to') || params.get('redirect_uri'))
  if (target) return target
  if (params.has('client_id') && params.has('response_type')) return `/api/auth/mcp/authorize${location.search}`
  return null
}

/* Where the verification link lands a signup that had to confirm its email
   first (SMTP on): the interrupted flow if there was one, else the first
   canvas — the same landing an instantly signed-in signup gets below. */
function verifiedLanding(): string {
  return interruptedTarget() ?? FIRST_CANVAS_PATH
}

function resumeOAuthFlow(): boolean {
  const target = interruptedTarget()
  if (target) location.href = target
  return target !== null
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset'

/** the card's title for each mode */
const TITLES: Record<AuthMode, string> = {
  signin: 'Willkommen zurück.',
  signup: 'Erstelle Dein Konto.',
  forgot: 'Setze Dein Passwort zurück.',
  reset: 'Wähle ein neues Passwort.',
}

/** The redirect knobs for better-auth's social sign-ins. */
interface ProviderStart extends ProviderRedirects {
  errorCallbackURL: string
}

/* The providers' marks at the 18px their sign-in guidelines draw them, from the registry. */
function AppleMark() {
  return <BrandMark brand="apple" size={18} className="shrink-0" />
}

function GoogleMark() {
  return <BrandMark brand="google" size={18} className="shrink-0" />
}

/* A failure inside the IdP round trip (the browser has already left and
   come back) redirects here with ?error=<code> rather than throwing where
   providerSignIn's own res.error check could see it — that check only ever
   catches failures of the initiating request. The shared helper handles
   known codes and validates legacy/German signup-domain restrictions;
   untrusted provider descriptions must never be shown here. */
function providerErrorFromUrl(): string | null {
  const params = new URLSearchParams(location.search)
  const code = params.get('error')
  if (!code) return null
  return authErrorMessage({ code })
}

/* Where a provider sign-in should land, mirroring what the email form does
   after submit — but handed to the server as redirect URLs rather than
   navigated to directly. The browser leaves for the IdP and returns already
   carrying a session, so this component's own resumeOAuthFlow() never gets
   to run for this path; the equivalent logic has to travel with the
   request instead. An interrupted flow wins for everyone; otherwise a
   returning user comes back to this page and a new account lands on its
   first canvas, the same place the email signup goes. */
function providerRedirects(): ProviderRedirects {
  const target = interruptedTarget()
  if (target) return { callbackURL: target, newUserCallbackURL: target }
  return { callbackURL: location.pathname + location.search, newUserCallbackURL: FIRST_CANVAS_PATH }
}

/** Matches server/auth.ts loginProvidersConfig's response shape. */
interface LoginProvidersConfig {
  google: boolean
  /** the browser "Sign in with Apple" (the iOS app's native one is appleNative, not shown here) */
  apple: boolean
}

/* The client bundle is static and shared across self-hosted deploys — it
   can't know at build time which social providers are configured, so it asks
   the server. See server/auth.ts loginProvidersConfig. */
function useLoginProviders(): LoginProvidersConfig {
  const [config, setConfig] = useState<LoginProvidersConfig>({
    google: false,
    apple: false,
  })
  useEffect(() => {
    fetch('/api/login-providers')
      .then((res) => (res.ok ? res.json() : { google: false, apple: false }))
      .then(setConfig)
      .catch(() => {}) // Provider buttons stay hidden — email/password still works
  }, [])
  return config
}

/* Set once the desktop shell has sent a provider sign-in to the system
   browser. Lives outside the component because the sign-in request makes
   the auth client re-check the session, App swaps in its pending screen for
   a moment, and this form remounts with fresh state — the notice would be
   gone before anyone read it. A page load (the sign-in landing) resets it. */
let browserSignInNotice: string | null = null

export function AuthPage() {
  const providers = useLoginProviders()
  /* better-auth lands password-reset links on /auth/reset?token=… */
  const resetToken = location.pathname === '/auth/reset' ? new URLSearchParams(location.search).get('token') : null
  const [mode, setMode] = useState<AuthMode>(resetToken ? 'reset' : 'signin')
  const [name, setNameField] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(providerErrorFromUrl)
  /* informational state (not an error): "check your email" and friends */
  const [notice, setNotice] = useState<string | null>(browserSignInNotice)
  /* signin failed on an unverified email — offer a resend */
  const [unverified, setUnverified] = useState(false)
  /* set when the error's real fix is the other mode: signin with an unknown
     email, or signup with an existing one */
  const [suggestMode, setSuggestMode] = useState<'signin' | 'signup' | null>(null)
  const [busy, setBusy] = useState(false)

  function switchMode(next: AuthMode) {
    setMode(next)
    setError(null)
    setNotice(null)
    setSuggestMode(null)
    setUnverified(false)
  }

  /* the provider error code has been shown; keep it out of the address bar */
  useEffect(() => {
    if (providerErrorFromUrl()) history.replaceState(null, '', location.pathname)
  }, [])

  /* Both providers leave for the IdP and come back with a session (or an
     ?error= — see providerErrorFromUrl); success redirects the browser away
     immediately, so only the failure to *start* leaves us here to show
     something. */
  async function providerSignIn(
    provider: DesktopSignInProvider,
    start: (opts: ProviderStart) => Promise<{ error?: AuthFailure | null }>,
  ) {
    setError(null)
    setNotice(null)
    setBusy(true)
    const startFailed =
      'Die Anmeldung konnte nicht gestartet werden — versuche es erneut oder nutze E-Mail und Passwort.'
    try {
      if (isDesktopShell() && supportsBrowserSignIn()) {
        /* Identity providers refuse embedded webviews, so the desktop shell
           signs in through the system browser and gets the session handed
           back over a doop:// link (src/lib/desktopAuth.ts). The browser
           starts the provider round trip itself, from a doop page. */
        if (!(await beginBrowserSignIn(provider, providerRedirects()))) {
          setError(startFailed)
          return
        }
        browserSignInNotice = 'Schließe die Anmeldung im Browser ab — doop meldet Dich hier an, sobald Du zurückkommst.'
        setNotice(browserSignInNotice)
        return
      }
      const res = await start({ ...providerRedirects(), errorCallbackURL: '/auth' })
      if (res.error) setError(authErrorMessage(res.error, startFailed))
    } catch {
      setError(startFailed)
    } finally {
      setBusy(false)
    }
  }

  function socialSignIn(provider: DesktopSignInProvider) {
    return providerSignIn(provider, (opts) => authClient.signIn.social({ provider, ...opts }))
  }

  async function resendVerification() {
    setBusy(true)
    try {
      await authClient.sendVerificationEmail({ email, callbackURL: verifiedLanding() })
      setError(null)
      setUnverified(false)
      setNotice('Bestätigungs-E-Mail gesendet — schau in Dein Postfach.')
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setSuggestMode(null)
    setUnverified(false)
    setBusy(true)
    try {
      if (mode === 'forgot') {
        await authClient.requestPasswordReset({ email, redirectTo: '/auth/reset' })
        /* same response either way — this must not confirm account existence */
        setNotice('Falls ein Konto mit dieser E-Mail-Adresse existiert, ist ein Link zum Zurücksetzen unterwegs.')
        return
      }
      if (mode === 'reset') {
        const res = await authClient.resetPassword({ newPassword: password, token: resetToken ?? '' })
        if (res.error) {
          setError(
            authErrorMessage(
              res.error,
              'Dieser Link zum Zurücksetzen ist ungültig oder abgelaufen — fordere einen neuen an.',
            ),
          )
        } else {
          history.replaceState(null, '', '/auth')
          switchMode('signin')
          setNotice('Passwort aktualisiert — melde Dich mit Deinem neuen Passwort an.')
        }
        return
      }
      const res =
        mode === 'signup'
          ? await authClient.signUp.email({
              name: name.trim() || email.split('@')[0] || email,
              email,
              password,
              callbackURL: verifiedLanding(),
            })
          : await authClient.signIn.email({ email, password })
      if (res.error) {
        if (mode === 'signin' && res.error.code === 'EMAIL_NOT_VERIFIED') {
          setError('Diese E-Mail-Adresse wurde noch nicht bestätigt.')
          setUnverified(true)
        } else if (mode === 'signin' && !(await accountExists(email))) {
          setError('Für diese E-Mail-Adresse wurde kein Konto gefunden.')
          setSuggestMode('signup')
        } else if (mode === 'signup' && res.error.code?.startsWith('USER_ALREADY_EXISTS')) {
          setError('Ein Konto mit dieser E-Mail-Adresse existiert bereits.')
          setSuggestMode('signin')
        } else {
          setError(authErrorMessage(res.error))
        }
      } else if (res.data?.user) {
        /* signup with verification required: the account exists but there is
           no session yet — better-auth returns a null token in that case */
        if (mode === 'signup' && !res.data.token) {
          setNotice(
            `Fast geschafft — wir haben einen Bestätigungslink an ${email} gesendet. Öffne ihn, um Dein Konto zu aktivieren.`,
          )
          return
        }
        setName(res.data.user.name) // keep cursor/feed identity in sync with the account
        /* land new users on their auto-created first canvas, where the
           demo agent is waiting to perform */
        if (!resumeOAuthFlow() && mode === 'signup') location.href = FIRST_CANVAS_PATH
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthScreen>
      <AuthCard as="form" title={TITLES[mode]} onSubmit={submit}>
        <AuthCardText className="mb-2">
          {mode === 'forgot' ? (
            <>Gib die E-Mail-Adresse Deines Kontos ein. Wir senden Dir einen Link zum Zurücksetzen.</>
          ) : mode === 'reset' ? (
            <>Wähle ein neues Passwort für Dein Konto.</>
          ) : (
            <>
              Eine gemeinsame Arbeitsfläche für Menschen <em className="not-italic text-brand">&amp; Agenten</em>.{' '}
              {mode === 'signin'
                ? 'Melde Dich an, um Deine Arbeitsflächen zu öffnen.'
                : 'Registriere Dich, um mit dem Gestalten zu beginnen.'}
            </>
          )}
        </AuthCardText>
        {(providers.google || providers.apple) && (mode === 'signin' || mode === 'signup') && (
          <>
            {providers.google && (
              <Button
                variant="default"
                size="lg"
                block
                className="border-line"
                type="button"
                onClick={() => socialSignIn('google')}
                disabled={busy}
              >
                <GoogleMark />
                {mode === 'signup' ? 'Registrieren' : 'Anmelden'} mit Google
              </Button>
            )}
            {providers.apple && (
              <Button
                variant="default"
                size="lg"
                block
                className="border-line"
                type="button"
                onClick={() => socialSignIn('apple')}
                disabled={busy}
              >
                <AppleMark />
                {mode === 'signup' ? 'Registrieren' : 'Anmelden'} mit Apple
              </Button>
            )}
            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-ink-faint">
              <span className="h-px flex-1 bg-line" />
              oder
              <span className="h-px flex-1 bg-line" />
            </div>
          </>
        )}
        {mode === 'signup' && (
          <Field label="Name" labelVariant="form">
            <Input
              variant="well"
              value={name}
              onChange={(e) => setNameField(e.target.value)}
              placeholder="Kevin"
              autoComplete="name"
            />
          </Field>
        )}
        {mode !== 'reset' && (
          <Field label="E-Mail" labelVariant="form">
            <Input
              variant="well"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </Field>
        )}
        {mode !== 'forgot' && (
          <Field label={mode === 'reset' ? 'Neues Passwort' : 'Passwort'} labelVariant="form">
            <Input
              variant="well"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'signin' ? '••••••••' : 'Mindestens 8 Zeichen'}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />
          </Field>
        )}
        {mode === 'signin' && (
          <Button
            variant="link"
            size="inline"
            className="-mt-1.5 self-end font-normal text-ink-faint hover:text-ink"
            onClick={() => switchMode('forgot')}
          >
            Passwort vergessen?
          </Button>
        )}
        {notice && <Callout>{notice}</Callout>}
        {error && (
          <Callout tone="error">
            {error}
            {suggestMode && (
              <Button
                variant="link"
                size="inline"
                className="mt-1.5 block text-accent-ink underline"
                onClick={() => switchMode(suggestMode)}
              >
                {suggestMode === 'signup' ? 'Stattdessen ein Konto erstellen →' : 'Stattdessen anmelden →'}
              </Button>
            )}
            {unverified && (
              <Button
                variant="link"
                size="inline"
                className="mt-1.5 block text-accent-ink underline"
                onClick={resendVerification}
                disabled={busy}
              >
                Bestätigungs-E-Mail erneut senden →
              </Button>
            )}
          </Callout>
        )}
        <Button variant="primary" size="lg" block className="mt-2" type="submit" disabled={busy}>
          {busy
            ? '…'
            : mode === 'signin'
              ? 'Anmelden'
              : mode === 'signup'
                ? 'Registrieren'
                : mode === 'forgot'
                  ? 'Link zum Zurücksetzen senden'
                  : 'Neues Passwort festlegen'}
        </Button>
        <Button
          variant="link"
          size="sm"
          className="p-1.5 text-[13px] font-normal text-ink-faint hover:text-ink"
          onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Noch kein Konto? Registrieren' : 'Schon ein Konto? Anmelden'}
        </Button>
      </AuthCard>
    </AuthScreen>
  )
}
