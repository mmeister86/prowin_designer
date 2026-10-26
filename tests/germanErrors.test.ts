import { describe, expect, it } from 'vitest'
import * as auth from '../src/lib/auth'
import { ApiError, errorMessage } from '../src/lib/api'

describe('German safe error displays', () => {
  it.each(['upstream secret', 'Öffne provider-secret erneut, um fortzufahren.'])(
    'hides ordinary external errors regardless of their language: %s',
    (message) => {
      expect(errorMessage(new Error(message), 'Bitte versuche es erneut.')).toBe('Bitte versuche es erneut.')
    },
  )
  it('uses stable auth codes and ignores foreign provider messages', () => {
    expect(auth.authErrorMessage?.({ code: 'INVALID_EMAIL_OR_PASSWORD', message: 'internal provider details' })).toBe(
      'E-Mail-Adresse oder Passwort ist falsch.',
    )
    expect(auth.authErrorMessage?.({ code: 'UNKNOWN', message: 'secret upstream detail' })).toBe(
      'Die Anmeldung ist fehlgeschlagen. Versuche es erneut oder melde Dich mit E-Mail und Passwort an.',
    )
  })
  it('retains the recovery instruction for the actual banned-user code', () => {
    expect(auth.authErrorMessage({ code: 'BANNED_USER', message: 'You have been banned' })).toBe(
      'Dieses Konto wurde gesperrt. Wende Dich an die Administration.',
    )
  })
  it.each([
    'Sign_up_is_restricted_to_@jointhetroops.com,_@partner.test_email_addresses.',
    'Die_Registrierung_ist_auf_E-Mail-Adressen_von_@jointhetroops.com,_@partner.test_beschränkt.',
  ])('preserves the signup domain hint from redirect %s', (code) => {
    expect(auth.authErrorMessage?.({ code })).toBe(
      'Die Registrierung ist auf E-Mail-Adressen von @jointhetroops.com, @partner.test beschränkt.',
    )
  })
  it('does not reflect arbitrary redirect descriptions or malformed signup messages', () => {
    expect(auth.authErrorMessage?.({ code: 'Sign_up_is_restricted_<script>', message: 'arbitrary' })).not.toContain(
      '<script>',
    )
  })
  it('does not display third-party message fields or coerce structured errors', () => {
    expect(errorMessage(new ApiError(500, '{"message":"upstream secret"}'), 'Bitte versuche es erneut.')).toBe(
      'Bitte versuche es erneut.',
    )
    expect(errorMessage(new ApiError(400, '{"error":{"secret":true}}'), 'Ungültige Eingabe.')).toBe(
      'Ungültige Eingabe.',
    )
  })
  it('handles non-object JSON bodies and inherited auth keys safely', () => {
    expect(errorMessage(new ApiError(500, 'null'), 'Bitte versuche es erneut.')).toBe('Bitte versuche es erneut.')
    expect(auth.authErrorMessage({ code: 'toString' })).toBe(
      'Die Anmeldung ist fehlgeschlagen. Versuche es erneut oder melde Dich mit E-Mail und Passwort an.',
    )
  })
  it('uses auth codes for API errors instead of exposing external messages', () => {
    expect(errorMessage(new ApiError(400, '{"code":"INVALID_PASSWORD","message":"provider detail"}'), 'Fehler')).toBe(
      'Das Passwort ist falsch.',
    )
  })
})
