import { errorMessage } from './api'

/** Native IPC currently rejects with strings, without machine codes. Keep the
 * legacy and German producer variants explicit until that contract changes. */
export function localClaudeActionMessage(
  error: unknown,
  fallback = 'Die Aktion konnte nicht abgeschlossen werden. Versuche es erneut.',
): string {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  if (['Connect Claude on this device first', 'Verbinde zuerst Claude auf diesem Gerät'].includes(message))
    return 'Verbinde zuerst Claude auf diesem Gerät und versuche es erneut.'
  if (['Claude is already running a task', 'Claude führt bereits eine Aufgabe aus'].includes(message))
    return 'Claude führt bereits eine Aufgabe aus. Warte, bis sie abgeschlossen ist, und versuche es erneut.'
  if (['Task is too large', 'Die Aufgabe ist zu groß'].includes(message))
    return 'Die Aufgabe ist zu groß. Kürze Deine Anfrage und versuche es erneut.'
  if (
    [
      'Claude output exceeded the 2 MB line limit. The run was stopped; retry with a smaller tool result.',
      'Die Claude-Ausgabe hat die Zeilengrenze von 2 MB überschritten. Der Lauf wurde gestoppt. Versuche es mit einem kleineren Tool-Ergebnis erneut.',
    ].includes(message)
  )
    return 'Die Claude-Ausgabe hat die Zeilengrenze von 2 MB überschritten. Der Lauf wurde gestoppt. Versuche es mit einem kleineren Tool-Ergebnis erneut.'
  if (
    [
      'Claude run stopped or timed out. Retry when ready.',
      'Der Claude-Lauf wurde gestoppt oder hat das Zeitlimit überschritten. Versuche es erneut, wenn Du bereit bist.',
    ].includes(message)
  )
    return 'Der Claude-Lauf wurde gestoppt oder hat das Zeitlimit überschritten. Versuche es erneut, wenn Du bereit bist.'
  if (
    message.startsWith('Could not read Claude output:') ||
    message.startsWith('Die Claude-Ausgabe konnte nicht gelesen werden:')
  )
    return 'Die Claude-Ausgabe konnte nicht gelesen werden. Prüfe Deine CLI-Installation und versuche es erneut.'
  // This command is stable across native UI languages.
  if (message.includes('claude auth login')) {
    return 'Die Anmeldung wurde nicht abgeschlossen. Führe claude auth login im Terminal aus und klicke anschließend auf Aktualisieren.'
  }
  if (
    [
      'Installation did not finish in time. Refresh to check, or use the installation guide.',
      'Die Installation wurde nicht rechtzeitig abgeschlossen. Klicke zum Prüfen auf Aktualisieren oder nutze die Installationsanleitung.',
    ].includes(message)
  ) {
    return 'Die Installation hat das Zeitlimit überschritten. Klicke zum Prüfen auf Aktualisieren oder nutze die Installationsanleitung.'
  }
  if (
    message.startsWith('Could not start the installer:') ||
    message.startsWith('Das Installationsprogramm konnte nicht gestartet werden:')
  ) {
    return 'Das Installationsprogramm konnte nicht gestartet werden. Nutze die Installationsanleitung und versuche es erneut.'
  }
  if (
    [
      'Claude Code was installed but could not start. See the installation guide.',
      'Claude Code wurde installiert, konnte aber nicht gestartet werden. Sieh in der Installationsanleitung nach.',
    ].includes(message)
  ) {
    return 'Claude Code wurde installiert, lässt sich aber nicht starten. Nutze die Installationsanleitung.'
  }
  if (
    [
      'Installation failed',
      'Installation failed. Check your internet connection or use the installation guide.',
      'Die Installation ist fehlgeschlagen. Prüfe Deine Internetverbindung oder nutze die Installationsanleitung.',
    ].includes(message)
  ) {
    return 'Die Installation ist fehlgeschlagen. Prüfe Deine Internetverbindung oder nutze die Installationsanleitung.'
  }
  if (
    ['Claude Code installation is already running.', 'Die Installation von Claude Code läuft bereits.'].includes(
      message,
    )
  ) {
    return 'Die Installation von Claude Code läuft bereits. Warte kurz und klicke dann auf Aktualisieren.'
  }
  if (['Installation cancelled.', 'Die Installation wurde abgebrochen.'].includes(message)) {
    return 'Die Installation wurde abgebrochen. Starte sie bei Bedarf erneut.'
  }
  if (
    [
      'Installiere Claude Code, um Dich zu verbinden.',
      'Melde Dich bei Claude Code an, um Dich zu verbinden.',
      'Aktualisiere die Doop-Desktop-App, um Claude lokal zu verwenden.',
    ].includes(message)
  )
    return message
  return errorMessage(error, fallback)
}
