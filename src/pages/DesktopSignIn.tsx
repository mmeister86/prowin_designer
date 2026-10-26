import { useEffect, useMemo, useState } from 'react'
import { authClient, authErrorMessage } from '../lib/auth'
import { desktopHandoffURL, parseDesktopSignInQuery } from '../lib/desktopAuth'
import { AuthCard, AuthCardText, AuthScreen } from '../components/ui/screen'
import { Callout } from '../components/ui/callout'

/* Step 1 of the desktop sign-in (src/lib/desktopAuth.ts), in the system
   browser: begin the provider round trip here so better-auth's state cookie
   and the provider's callback share a cookie jar. If this browser already
   holds a doop session there is nothing to prove — go straight to the
   handoff. Renders only a holding card: the browser leaves within moments. */
export function DesktopSignIn({ signedIn }: { signedIn: boolean }) {
  /* read once: the query is fixed for the life of this page */
  const request = useMemo(() => parseDesktopSignInQuery(location.search), [])
  const [startError, setStartError] = useState<string | null>(null)
  const error = request
    ? startError
    : 'Dieser Anmeldelink ist unvollständig — kehre zur doop-App zurück und versuche es erneut.'

  useEffect(() => {
    if (!request) return
    const callbackURL = desktopHandoffURL(request.challenge, request.callbackURL)
    if (signedIn) {
      location.replace(callbackURL)
      return
    }
    /* the handoff carries the in-app landing through to the deep link, so
       a new account's first-canvas landing survives the hop too */
    const redirects = {
      callbackURL,
      newUserCallbackURL: desktopHandoffURL(request.challenge, request.newUserCallbackURL),
      errorCallbackURL: '/auth',
    }
    const failed = 'Die Anmeldung konnte nicht gestartet werden — kehre zur doop-App zurück und versuche es erneut.'
    const start = authClient.signIn.social({ provider: request.provider, ...redirects })
    start
      .then((res) => {
        if (res.error) setStartError(authErrorMessage(res.error, failed))
      })
      .catch(() => setStartError(failed))
  }, [request, signedIn])

  return (
    <AuthScreen>
      <AuthCard title={error ? 'Etwas ist schiefgelaufen.' : 'Du wirst angemeldet…'}>
        {error ? (
          <Callout tone="error">{error}</Callout>
        ) : (
          <AuthCardText>Du wirst zum Anmeldedienst für die doop-App weitergeleitet.</AuthCardText>
        )}
      </AuthCard>
    </AuthScreen>
  )
}
