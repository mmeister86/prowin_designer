/* Placeholder redaction for text on its way to a model: e-mail, phone and IBAN
   are replaced by ``[E-Mail entfernt]``-style markers (`redactPii`) or by
   reversible ``[[PII-n]]`` tokens (`createRedactionSession`).

   shortcut: names and free-form postal addresses are not detectable by regex,
   upgrade when frames mark contact blocks with data-od-role="contact" (TASK-29). */

type PiiKind = 'email' | 'iban' | 'phone'

const PLACEHOLDER: Record<PiiKind, string> = {
  email: '[E-Mail entfernt]',
  iban: '[IBAN entfernt]',
  phone: '[Telefon entfernt]',
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
const IBAN = /\b[A-Z]{2}\d{2}(?: ?[A-Z0-9]{2,4}){2,9}\b/g
const PHONE = /(?<![\w+])(?:\+|00)?\d[\d \t/-]{5,}\d(?!\w)/g
const TOKEN = /\[\[PII-\d+\]\]/g

/* The patterns are broad; these guards keep design text such as "Artikel
   123456" or "DE89" fragments from being treated as PII. */
function isPhone(match: string): boolean {
  return match.replace(/\D/g, '').length >= 6 && /^(\+|00|0)/.test(match)
}

function isIban(match: string): boolean {
  const compact = match.replace(/ /g, '').length
  return compact >= 15 && compact <= 34
}

function replaceMatches(text: string, replacement: (kind: PiiKind, match: string) => string): string {
  return (
    text
      .replace(EMAIL, (match) => replacement('email', match))
      /* IBAN before phone: the digits of an IBAN must not be read as a phone number. */
      .replace(IBAN, (match) => (isIban(match) ? replacement('iban', match) : match))
      .replace(PHONE, (match) => (isPhone(match) ? replacement('phone', match) : match))
  )
}

export function redactPii(text: string): string {
  return replaceMatches(text, (kind) => PLACEHOLDER[kind])
}

export function createRedactionSession(): {
  redact(text: string): string
  restore(text: string): string
  readonly size: number
} {
  const tokenByOriginal = new Map<string, string>()
  const originalByToken = new Map<string, string>()

  return {
    redact(text) {
      return replaceMatches(text, (_kind, match) => {
        let token = tokenByOriginal.get(match)
        if (!token) {
          token = `[[PII-${tokenByOriginal.size + 1}]]`
          tokenByOriginal.set(match, token)
          originalByToken.set(token, match)
        }
        return token
      })
    },
    restore(text) {
      /* Unknown tokens are left alone so user HTML that already contains
         ``[[PII-n]]`` cannot be rewritten by us. */
      return text.replace(TOKEN, (match) => originalByToken.get(match) ?? match)
    },
    get size() {
      return tokenByOriginal.size
    },
  }
}
