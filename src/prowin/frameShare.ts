/* Narrow Web Share wrapper for prepared frame exports: capability probing
   and the explicit share call live here so the UI stays a state machine.
   Resolving (or merely opening) the sheet never claims delivery, so success
   and cancellation both resolve null. */

type ShareNavigator = Navigator & {
  share?: (data: ShareData) => Promise<void>
  canShare?: (data: ShareData) => boolean
}

function navigatorOf(): ShareNavigator | null {
  try {
    const current = globalThis.navigator as ShareNavigator | undefined
    return current ?? null
  } catch {
    return null
  }
}

/** True when this browser can hand the exact file to the share sheet.
 *  Never throws: missing or throwing APIs mean no file sharing. */
export function canShareFrameFile(file: File): boolean {
  try {
    const current = navigatorOf()
    if (!current || typeof current.share !== 'function') return false
    if (typeof current.canShare === 'function') return current.canShare({ files: [file] })
    return true
  } catch {
    return false
  }
}

const UNSUPPORTED_SHARE = 'Dieser Browser kann keine Dateien teilen'

function shareFailure(err: unknown): string | null {
  if (err instanceof DOMException && err.name === 'AbortError') return null
  if (err instanceof TypeError) return UNSUPPORTED_SHARE
  if (err instanceof DOMException && err.name === 'NotAllowedError')
    return 'Das Teilen wurde blockiert. Versuche es erneut.'
  return 'Das Teilen hat nicht funktioniert. Versuche es erneut.'
}

/** Open the share sheet for a prepared file. Must run directly in the
 *  share click's activation: `navigator.share` is invoked synchronously
 *  before the first await. Returns null when nothing needs saying
 *  (shared, cancelled, or merely opened), else a safe German message. */
export function shareFrameFile(file: File): Promise<string | null> {
  const current = navigatorOf()
  if (!current || typeof current.share !== 'function') return Promise.resolve(UNSUPPORTED_SHARE)
  let pending: Promise<void>
  try {
    pending = current.share({ files: [file] })
  } catch (err) {
    return Promise.resolve(shareFailure(err))
  }
  return pending.then(
    () => null,
    (err: unknown) => shareFailure(err),
  )
}
