import { CreatorRegistration } from '../prowin/CreatorRegistration'
import { useCallback, useEffect, useState } from 'react'
import { authClient, authErrorMessage } from '../lib/auth'
import { api } from '../lib/api'
import type { NotificationSettings } from '../../shared/notifications'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Badge } from './ui/badge'
import { Note } from './ui/note'
import { Checkbox } from './ui/checkbox'
import { CardDescription, CardHeader, CardRow, CardTitle, SettingsCard } from './ui/card'

/* settings fields are a fixed column on desktop and full width on a phone */

/** The "Your account" pane of /settings: who you are on a canvas, and how you
 *  get back into one. Everything here is better-auth's own account surface —
 *  no endpoints of ours. */
export function AccountSettings() {
  const { data: session } = authClient.useSession()
  const user = session?.user

  /* null while untouched, so the field tracks the session until you type */
  const [draft, setDraft] = useState<string | null>(null)
  const name = draft ?? user?.name ?? ''
  const dirty = name.trim().length > 0 && name.trim() !== (user?.name ?? '')

  const [savingName, setSavingName] = useState(false)
  const [nameNote, setNameNote] = useState('')
  const [nameError, setNameError] = useState('')

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwNote, setPwNote] = useState('')
  const [pwError, setPwError] = useState('')

  const [verifyNote, setVerifyNote] = useState('')

  /* null until the server has answered — the switch renders inert meanwhile */
  const [notify, setNotify] = useState<NotificationSettings | null>(null)
  const [notifyError, setNotifyError] = useState('')
  /* one save at a time: two in flight could land out of order and show the older choice */
  const [savingNotify, setSavingNotify] = useState(false)
  const refreshNotify = useCallback(() => {
    api.notificationSettings().then(setNotify, () => {})
  }, [])
  useEffect(refreshNotify, [refreshNotify])

  async function saveName() {
    setSavingName(true)
    setNameNote('')
    setNameError('')
    const { error } = await authClient.updateUser({ name: name.trim() })
    setSavingName(false)
    if (error) return setNameError(authErrorMessage(error, 'Der Name konnte nicht gespeichert werden'))
    setDraft(null)
    setNameNote('Gespeichert — Agenten übernehmen die Änderung innerhalb einer Minute')
  }

  async function savePassword() {
    setSavingPw(true)
    setPwNote('')
    setPwError('')
    /* revoking is the point: a password change you make because you fear a
       device is compromised is useless if that device stays signed in */
    const { error } = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      revokeOtherSessions: true,
    })
    setSavingPw(false)
    if (error) return setPwError(authErrorMessage(error, 'Das Passwort konnte nicht geändert werden'))
    setCurrent('')
    setNext('')
    setPwNote('Passwort aktualisiert — alle anderen Sitzungen wurden abgemeldet')
  }

  async function setCommentEmails(on: boolean) {
    if (!notify || savingNotify) return
    setSavingNotify(true)
    setNotify({ ...notify, commentEmails: on })
    setNotifyError('')
    try {
      setNotify(await api.setNotificationPrefs({ commentEmails: on }))
    } catch {
      setNotifyError('Speichern fehlgeschlagen — versuche es erneut')
      refreshNotify()
    } finally {
      setSavingNotify(false)
    }
  }

  async function resendVerification() {
    if (!user?.email) return
    setVerifyNote('')
    const { error } = await authClient.sendVerificationEmail({ email: user.email })
    setVerifyNote(
      error ? authErrorMessage(error, 'Die E-Mail konnte nicht gesendet werden') : 'Bestätigungs-E-Mail gesendet',
    )
  }

  return (
    <>
      <CreatorRegistration />
      <SettingsCard>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
          <CardDescription>
            Dein Name wird an Cursorn, im Aktivitätsverlauf und bei allem angezeigt, was Du für einen Agenten
            hinterlässt. Agenten sehen die Änderung innerhalb einer Minute.
          </CardDescription>
        </CardHeader>

        <CardRow
          label="Name"
          action={
            <Button size="sm" disabled={!dirty || savingName} onClick={saveName}>
              {savingName ? 'Wird gespeichert…' : 'Speichern'}
            </Button>
          }
          control={
            <Input
              value={name}
              onChange={(e) => {
                setDraft(e.target.value)
                setNameNote('')
                setNameError('')
              }}
              maxLength={60}
              aria-label="Anzeigename"
            />
          }
        >
          {nameError ? (
            <Note tone="error">{nameError}</Note>
          ) : nameNote ? (
            <Note tone="success">{nameNote}</Note>
          ) : dirty ? (
            <Note>Geändert — noch nicht gespeichert</Note>
          ) : null}
        </CardRow>

        <CardRow
          label="E-Mail"
          action={
            user?.emailVerified ? (
              <Note>Anmeldeadresse — derzeit nicht änderbar</Note>
            ) : (
              <Button size="sm" onClick={resendVerification}>
                Bestätigung erneut senden
              </Button>
            )
          }
        >
          <span className="min-w-0 font-mono text-body [overflow-wrap:anywhere]">{user?.email}</span>
          {user?.emailVerified ? <Badge tone="success">bestätigt</Badge> : <Badge>unbestätigt</Badge>}
          {verifyNote && <Note tone="success">{verifyNote}</Note>}
        </CardRow>
      </SettingsCard>

      <SettingsCard>
        <CardHeader>
          <CardTitle>Benachrichtigungen</CardTitle>
          <CardDescription>
            E-Mails zu Ereignissen auf Deinen Arbeitsflächen, während Du sie nicht ansiehst. Deine eigenen Kommentare
            lösen keine E-Mail aus.
          </CardDescription>
        </CardHeader>
        <CardRow label="Kommentar-E-Mails">
          <label className="relative flex cursor-pointer items-center gap-2.5 text-body text-ink">
            <Checkbox
              checked={notify?.commentEmails ?? true}
              disabled={!notify || !notify.emailConfigured || savingNotify}
              onChange={(e) => void setCommentEmails(e.target.checked)}
              aria-label="Schicke mir E-Mails zu neuen Kommentaren und Antworten"
            />
            <span>
              Neue Kommentare und Antworten auf Arbeitsflächen, die Dir gehören, zu denen Du eingeladen wurdest oder auf
              denen Du geschrieben hast — alle paar Minuten in einer E-Mail pro Arbeitsfläche zusammengefasst.
            </span>
          </label>
          {notify && !notify.emailConfigured ? (
            <Note>
              Für dieses doop ist kein E-Mail-Versand eingerichtet (SMTP_HOST). Es werden daher keine E-Mails gesendet.
            </Note>
          ) : notifyError ? (
            <Note tone="error">{notifyError}</Note>
          ) : null}
        </CardRow>
      </SettingsCard>

      <SettingsCard>
        <CardHeader>
          <CardTitle>Passwort</CardTitle>
          <CardDescription>
            Beim Ändern werden alle anderen Browser und Geräte abgemeldet — dieses bleibt angemeldet.
          </CardDescription>
        </CardHeader>
        <CardRow
          label="Aktuelles Passwort"
          control={
            <Input
              type="password"
              value={current}
              onChange={(e) => {
                setCurrent(e.target.value)
                setPwError('')
              }}
              autoComplete="current-password"
              aria-label="Aktuelles Passwort"
            />
          }
        />
        <CardRow
          label="Neues Passwort"
          action={
            <Button size="sm" disabled={savingPw || !current || next.length < 8} onClick={savePassword}>
              {savingPw ? 'Wird aktualisiert…' : 'Passwort aktualisieren'}
            </Button>
          }
          control={
            <Input
              type="password"
              value={next}
              onChange={(e) => {
                setNext(e.target.value)
                setPwError('')
              }}
              autoComplete="new-password"
              aria-label="Neues Passwort"
            />
          }
        >
          {pwError ? (
            <Note tone="error">{pwError}</Note>
          ) : pwNote ? (
            <Note tone="success">{pwNote}</Note>
          ) : (
            <Note>Mindestens 8 Zeichen</Note>
          )}
        </CardRow>
      </SettingsCard>
    </>
  )
}
