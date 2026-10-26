import { createAuthClient } from 'better-auth/react'
import { oneTimeTokenClient } from 'better-auth/client/plugins'

/** Same-origin better-auth client — cookies do the rest. The one-time token
 *  plugin carries a sign-in from the system browser into the desktop shell
 *  (src/lib/desktopAuth.ts). */
export const authClient = createAuthClient({
  plugins: [oneTimeTokenClient()],
})

export interface AuthFailure {
  code?: string
  message?: string
}

const AUTH_ERRORS: Readonly<Record<string, string>> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-Mail-Adresse oder Passwort ist falsch.',
  INVALID_PASSWORD: 'Das Passwort ist falsch.',
  INVALID_EMAIL: 'Bitte gib eine gültige E-Mail-Adresse ein.',
  USER_NOT_FOUND: 'Für diese E-Mail-Adresse gibt es noch kein Konto.',
  USER_ALREADY_EXISTS: 'Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde Dich an.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Für diese E-Mail-Adresse gibt es bereits ein Konto. Melde Dich an.',
  EMAIL_NOT_VERIFIED: 'Bitte bestätige zuerst Deine E-Mail-Adresse.',
  PASSWORD_TOO_SHORT: 'Das Passwort ist zu kurz. Verwende mindestens 8 Zeichen.',
  PASSWORD_TOO_LONG: 'Das Passwort ist zu lang. Verwende höchstens 128 Zeichen.',
  INVALID_TOKEN: 'Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.',
  TOKEN_EXPIRED: 'Dieser Link ist abgelaufen. Fordere einen neuen an.',
  SESSION_EXPIRED: 'Deine Sitzung ist abgelaufen. Melde Dich erneut an.',
  BANNED_USER: 'Dieses Konto wurde gesperrt. Wende Dich an die Administration.',
  TOO_MANY_REQUESTS: 'Zu viele Versuche. Bitte warte kurz und versuche es erneut.',
  account_not_linked:
    'Für diese E-Mail-Adresse gibt es bereits ein doop-Konto. Melde Dich mit E-Mail und Passwort an, um es zu verknüpfen.',
  "email_doesn't_match": 'Die E-Mail-Adresse stimmt nicht mit Deinem ursprünglichen Konto überein. Versuche es erneut.',
  email_is_missing: 'Dein Anmeldedienst hat keine E-Mail-Adresse übermittelt. doop benötigt sie für die Anmeldung.',
  email_not_found: 'Dein Anmeldedienst hat keine E-Mail-Adresse übermittelt. doop benötigt sie für die Anmeldung.',
  desktop_handoff:
    'Dieser Anmeldelink ist abgelaufen. Starte erneut und schließe die Anmeldung innerhalb weniger Minuten im Browser ab.',
}

/** Accepts better-auth response errors and OAuth URL error codes. Never reflects
 * provider descriptions. Both old and German signup redirects remain readable. */
export function authErrorMessage(
  error: AuthFailure | null | undefined,
  fallback = 'Die Anmeldung ist fehlgeschlagen. Versuche es erneut oder melde Dich mit E-Mail und Passwort an.',
): string {
  for (const value of [error?.code, error?.message]) {
    const text = value?.replaceAll('_', ' ')
    const match = text?.match(
      /^(?:Sign up is restricted to (.+) email addresses\.|Die Registrierung ist auf E-Mail-Adressen von (.+) beschränkt\.)$/,
    )
    const domains = match?.[1] ?? match?.[2]
    if (
      domains &&
      domains.split(', ').every((domain) => /^@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/i.test(domain))
    )
      return `Die Registrierung ist auf E-Mail-Adressen von ${domains} beschränkt.`
  }
  return (error?.code && Object.hasOwn(AUTH_ERRORS, error.code) ? AUTH_ERRORS[error.code] : undefined) ?? fallback
}
