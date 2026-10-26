/** Canvas events an outbound webhook can subscribe to. Names are stable API:
 *  they appear in the X-Doop-Event header and the payload's `type`. */
export const WEBHOOK_EVENTS = [
  'comment.created',
  'comment.replied',
  'comment.resolved',
  'frame.created',
  'task.completed',
  'task.failed',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number]

export const WEBHOOK_EVENT_LABELS: Record<WebhookEventType, string> = {
  'comment.created': 'Ein Kommentar wird zu einem Element hinterlassen',
  'comment.replied': 'Eine Antwort wird zu einem Kommentarverlauf hinzugefügt',
  'comment.resolved': 'Ein Kommentarverlauf wird als erledigt markiert',
  'frame.created': 'Eine Zeichenfläche wird erstellt',
  'task.completed': 'Ein Agent schließt eine Aufgabenkarte ab',
  'task.failed': 'Ein Agent kann eine Aufgabenkarte nicht abschließen',
}

/** A webhook as the settings page sees it: never the secret. */
export interface WebhookInfo {
  id: string
  url: string
  events: WebhookEventType[]
  enabled: boolean
  createdAt: number
  /** HTTP status of the last delivery attempt; null = no response (network, timeout, refused) */
  lastStatus: number | null
  lastAt: number | null
  lastError: string | null
  /** consecutive failed deliveries; resets on the first success */
  failures: number
}

export interface WebhookDeliveryResult {
  ok: boolean
  status: number | null
  error?: string
}
