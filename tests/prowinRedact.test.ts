import { describe, expect, it } from 'vitest'
import { createRedactionSession, redactPii } from '../server/prowin/redact.ts'

describe('redactPii', () => {
  it('replaces e-mail addresses and leaves no original behind', () => {
    const text = 'Kontakt: max@example.de, bitte melden'
    const redacted = redactPii(text)
    expect(redacted).toBe('Kontakt: [E-Mail entfernt], bitte melden')
    expect(redacted).not.toContain('max@example.de')
  })

  it.each(['+49 170 1234567', '0170/123456', '030 901820'])('replaces the phone number %j', (phone) => {
    const redacted = redactPii(`Ruf ${phone} an`)
    expect(redacted).toBe('Ruf [Telefon entfernt] an')
    expect(redacted).not.toContain(phone)
  })

  it.each(['DE89 3704 0044 0532 0130 00', 'DE89370400440532013000'])('replaces the IBAN %j', (iban) => {
    const redacted = redactPii(`Konto: ${iban}`)
    expect(redacted).toBe('Konto: [IBAN entfernt]')
    expect(redacted).not.toContain(iban)
  })

  it.each(['Online-Party: Do., 14. Okt., 20 Uhr', '120 x 80 cm', 'ab 29,99 €', 'Artikel 123456'])(
    'leaves non-PII text %j unchanged',
    (text) => {
      expect(redactPii(text)).toBe(text)
    },
  )

  it('redacts every class in one pass without touching surrounding text', () => {
    const text = 'max@example.de, +49 170 1234567, DE89 3704 0044 0532 0130 00, 120 x 80 cm'
    expect(redactPii(text)).toBe('[E-Mail entfernt], [Telefon entfernt], [IBAN entfernt], 120 x 80 cm')
  })
})

describe('createRedactionSession', () => {
  it('assigns one stable token per distinct original', () => {
    const session = createRedactionSession()
    expect(session.redact('max@example.de und max@example.de')).toBe('[[PII-1]] und [[PII-1]]')
    expect(session.size).toBe(1)
  })

  it('numbers distinct originals in order of first appearance', () => {
    const session = createRedactionSession()
    expect(session.redact('a@b.de, c@d.de, a@b.de')).toBe('[[PII-1]], [[PII-2]], [[PII-1]]')
  })

  it('counts distinct originals across all classes and reuses tokens', () => {
    const session = createRedactionSession()
    session.redact('max@example.de')
    const redacted = session.redact('+49 170 1234567, max@example.de, DE89 3704 0044 0532 0130 00')
    expect(redacted).not.toContain('max@example.de')
    expect(redacted).not.toContain('+49 170 1234567')
    expect(redacted).not.toContain('DE89 3704 0044 0532 0130 00')
    expect(redacted.match(/\[\[PII-1\]\]/g)).toHaveLength(1)
    expect(session.size).toBe(3)
  })

  it.each(['Mail max@example.de oder +49 170 1234567', 'Konto DE89370400440532013000, Party 20 Uhr, 120 x 80 cm'])(
    'round-trips %j through redact and restore',
    (text) => {
      const session = createRedactionSession()
      expect(session.restore(session.redact(text))).toBe(text)
    },
  )

  it('leaves foreign tokens untouched in restore', () => {
    const session = createRedactionSession()
    const text = '[[PII-99]] max@example.de'
    const redacted = session.redact(text)
    expect(redacted).toBe('[[PII-99]] [[PII-1]]')
    expect(session.restore(redacted)).toBe(text)
  })
})
