import type { Frame } from '../../shared/types'
import { isDesktopShell } from './shell'
import { useStore } from './store'

export type FrameExportFormat = 'png' | 'jpg'

const FORMAT_LABEL: Record<FrameExportFormat, string> = { png: 'PNG', jpg: 'JPG' }

/* Blob URLs are revoked late: in the desktop shell the save panel opens
   before WebKit reads the blob, and the person may take a while to pick. */
const BLOB_URL_LIFETIME_MS = 10 * 60_000

export function frameExportUrl(frame: Frame, format: FrameExportFormat): string {
  return `/i/${frame.id}.${format}?scale=2&download`
}

/** The server names the file after the frame; fall back to that if the
 *  header is missing or unreadable. */
function fileNameOf(res: Response, frame: Frame, format: FrameExportFormat): string {
  const header = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(header)
  return match?.[1] ?? `${frame.name || 'Zeichenfläche'}.${format}`
}

async function failureOf(res: Response, format: FrameExportFormat): Promise<string> {
  const body: unknown = await res.json().catch(() => null)
  const error = (body as { error?: unknown } | null)?.error
  return typeof error === 'string' ? error : `Das ${FORMAT_LABEL[format]} konnte nicht exportiert werden`
}

/* A `download` attribute is what makes this a download everywhere: the
   desktop shell's webview ignores Content-Disposition for types it can
   display (PNG and JPG) and would show the file
   in the window instead; with the attribute it opens the native save panel. */
function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), BLOB_URL_LIFETIME_MS)
}

/* An image of a busy frame renders in seconds; a request still open after
   this is stuck, and must not leave the spinner up forever. */
const EXPORT_TIMEOUT_MS = 2 * 60_000

/* Exports share the one canvas toast, so an outcome must not claim the
   spinner while another export is still rendering. */
let inFlight = 0

/** `outcome` null: nothing to say — the desktop shell's save panel is the
 *  feedback, and it may yet be cancelled, so "ready" would be a claim. */
function report(outcome: string | null) {
  const { notice, pushNotice } = useStore.getState()
  if (inFlight > 0) {
    const more = `Noch ${inFlight.toLocaleString('de-DE')} ${inFlight === 1 ? 'Export' : 'Exporte'} in Arbeit…`
    pushNotice(outcome ? `${outcome} · ${more}` : more, { busy: true })
  } else if (outcome) {
    pushNotice(outcome)
  } else if (notice?.busy) {
    useStore.setState({ notice: null })
  }
}

async function exportOutcome(frame: Frame, format: FrameExportFormat): Promise<string | null> {
  try {
    const res = await fetch(frameExportUrl(frame, format), { signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS) })
    if (!res.ok) return await failureOf(res, format)
    const fileName = fileNameOf(res, frame, format)
    saveBlob(await res.blob(), fileName)
    return isDesktopShell() ? null : `„${fileName}“ ist bereit`
  } catch (err) {
    return err instanceof DOMException && err.name === 'TimeoutError'
      ? `Der ${FORMAT_LABEL[format]}-Export hat zu lange gedauert. Versuche es erneut.`
      : `Das ${FORMAT_LABEL[format]} konnte nicht exportiert werden`
  }
}

/** Render and download a frame export, reporting through the canvas toast:
 *  a spinner while the server renders (rendering can take several seconds),
 *  then the outcome. Fired from surfaces that close on click, so the
 *  toast in the store is the only place the result can land. */
/** Save the frame's document as an .html file — the same text the raw editor
 *  shows, so a draft in progress exports as typed. Nothing to fetch, so it
 *  cannot fail the way the rendered exports can. */
export function downloadFrameHtml(frame: Frame, html = frame.html): void {
  saveBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${frame.name || 'Zeichenfläche'}.html`)
}

export async function downloadFrameExport(frame: Frame, format: FrameExportFormat): Promise<void> {
  inFlight += 1
  useStore.getState().pushNotice(`${FORMAT_LABEL[format]} wird exportiert…`, { busy: true })
  const outcome = await exportOutcome(frame, format)
  inFlight -= 1
  report(outcome)
}

/** Render the frame and put the PNG itself on the clipboard, reporting
 *  through the canvas toast like the downloads. ClipboardItem gets the
 *  pending blob, not an awaited one: WebKit allows the write only while the
 *  click's user activation is live, and the render can take seconds. */
export async function copyFramePng(frame: Frame): Promise<void> {
  /* no async clipboard outside a secure context (a self-hosted instance on
     plain http) or in older engines: say so before spending a render */
  if (!('clipboard' in navigator) || typeof ClipboardItem === 'undefined') {
    useStore.getState().pushNotice('Dieser Browser kann keine Bilder kopieren')
    return
  }
  inFlight += 1
  useStore.getState().pushNotice('PNG wird kopiert…', { busy: true })
  /* engines differ in what the write rejects with when the blob fails, so
     the render's reason is kept here rather than read off the error */
  let failure = 'Das PNG konnte nicht kopiert werden'
  const png = (async () => {
    try {
      const res = await fetch(frameExportUrl(frame, 'png'), { signal: AbortSignal.timeout(EXPORT_TIMEOUT_MS) })
      if (res.ok) return await res.blob()
      failure = await failureOf(res, 'png')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'TimeoutError')
        failure = 'Das Kopieren des PNG hat zu lange gedauert. Versuche es erneut.'
    }
    throw new Error(failure)
  })()
  /* the clipboard can refuse without ever reading it */
  png.catch(() => {})
  let outcome: string
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
    outcome = 'PNG kopiert'
  } catch {
    outcome = failure
  }
  inFlight -= 1
  report(outcome)
}
