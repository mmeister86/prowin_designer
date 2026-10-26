import { normalizePipeline } from './agents.ts'

/**
 * Automations: a schedule plus an ordered list of steps that run on it.
 *
 * Two step types only. A *pull* step asks an integration for designs and
 * lands them on a canvas as frames (Meta ad creatives today). An *agent*
 * step queues a board card for the resident team on a canvas — the same card
 * a person would write on the Board. Every step names its own canvas: an
 * agent only ever works on a canvas, so there is no separate canvas node.
 * Context between steps is implicit — the canvas, and whatever earlier steps
 * put on it.
 */

export type ScheduleKind = 'daily' | 'weekdays' | 'weekly'

export interface Schedule {
  kind: ScheduleKind
  /** weekly only: 0 = Sunday … 6 = Saturday */
  weekday: number
  /** wall-clock time in `tz` */
  hour: number
  minute: number
  /** IANA zone the wall-clock time is read in, e.g. Europe/Berlin */
  tz: string
}

export type PullFilter = 'active' | 'all'

export interface PullStep {
  id: string
  type: 'pull'
  provider: 'meta'
  /** Meta ad account id, e.g. act_1234 — empty until the user picks one */
  accountId: string
  filter: PullFilter
  canvasId: string
}

export interface AgentStep {
  id: string
  type: 'agent'
  /** short label shown on the node, e.g. "Wöchentliche Prüfung"; the prompt is the brief */
  title: string
  prompt: string
  /** the one agent role the card goes to (kept as a list for the card's pipeline shape) */
  roles: string[]
  canvasId: string
}

export type Step = PullStep | AgentStep

export type RunStatus = 'running' | 'ok' | 'failed'

export interface AutomationRun {
  id: string
  automationId: string
  startedAt: number
  endedAt: number | null
  status: RunStatus
  /** one line of what happened: "12 creatives pulled · 1 card queued" */
  summary: string | null
  error: string | null
  /** the first step's canvas — where "Open canvas" leads */
  canvasId: string | null
  /** what went wrong, when it's something the user can fix with one click */
  failure: 'reconnect' | null
}

export interface Automation {
  id: string
  name: string
  enabled: boolean
  schedule: Schedule
  steps: Step[]
  nextRunAt: number | null
  lastRun: Pick<AutomationRun, 'id' | 'startedAt' | 'status' | 'summary' | 'failure'> | null
  createdAt: number
  updatedAt: number
}

export const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'] as const
export const WEEKDAYS_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const
const SCHEDULER_WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export const MAX_STEPS = 6
export const MAX_NAME = 80
export const MAX_PROMPT = 4_000

export const DEFAULT_SCHEDULE: Schedule = { kind: 'weekly', weekday: 1, hour: 9, minute: 0, tz: 'UTC' }

/* ------------------------------------------------------------------ */
/* Schedule math                                                       */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

interface WallClock {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
  weekday: number
}

const partsCache = new Map<string, Intl.DateTimeFormat>()

function formatter(tz: string): Intl.DateTimeFormat {
  let f = partsCache.get(tz)
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      weekday: 'short',
    })
    partsCache.set(tz, f)
  }
  return f
}

/** The wall clock in `tz` at the instant `at`. */
export function wallClock(at: number, tz: string): WallClock {
  const parts: Record<string, string> = {}
  for (const p of formatter(tz).formatToParts(new Date(at))) parts[p.type] = p.value
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
    weekday: SCHEDULER_WEEKDAYS.indexOf(parts.weekday as (typeof SCHEDULER_WEEKDAYS)[number]),
  }
}

/** The zone's UTC offset (ms) at the instant `at`. */
function offsetAt(at: number, tz: string): number {
  const w = wallClock(at, tz)
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second)
  return asUtc - Math.floor(at / 1000) * 1000
}

/** The instant a wall-clock time in `tz` happens. Around a DST jump a
 *  nonexistent time resolves to the instant an hour later; an ambiguous one
 *  to its first occurrence. */
export function zonedTime(tz: string, year: number, month: number, day: number, hour: number, minute: number): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  const offset = offsetAt(guess, tz)
  const result = guess - offset
  /* the offset can differ at the resolved instant when a DST change sits
     between the guess and the answer — one correction settles it */
  const settled = offsetAt(result, tz)
  return settled === offset ? result : guess - settled
}

/** The next instant strictly after `after` that the schedule fires. */
export function nextRunAt(schedule: Schedule, after: number): number {
  const tz = isValidTimeZone(schedule.tz) ? schedule.tz : 'UTC'
  const now = wallClock(after, tz)
  /* walk day by day from today; a weekly schedule fires within 7 days */
  for (let ahead = 0; ahead <= 8; ahead++) {
    const dayStart = Date.UTC(now.year, now.month - 1, now.day + ahead)
    const d = new Date(dayStart)
    const candidate = zonedTime(
      tz,
      d.getUTCFullYear(),
      d.getUTCMonth() + 1,
      d.getUTCDate(),
      schedule.hour,
      schedule.minute,
    )
    if (candidate <= after) continue
    const weekday = wallClock(candidate, tz).weekday
    if (schedule.kind === 'weekly' && weekday !== schedule.weekday) continue
    if (schedule.kind === 'weekdays' && (weekday === 0 || weekday === 6)) continue
    return candidate
  }
  /* unreachable: 8 days always contain every weekday */
  return after + 7 * 86_400_000
}

/** The clock as the viewer's locale shows it; falls back to 24h where Intl is missing. */
export function clockTime(hour: number, minute: number): string {
  try {
    return new Date(2000, 0, 1, hour, minute).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  } catch {
    return `${pad(hour)}:${pad(minute)}`
  }
}

export function describeSchedule(s: Schedule): string {
  const time = clockTime(s.hour, s.minute)
  if (s.kind === 'daily') return `Jeden Tag um ${time}`
  if (s.kind === 'weekdays') return `Werktags um ${time}`
  return `Jeden ${WEEKDAYS[s.weekday] ?? 'Montag'} um ${time}`
}

/** "Mon 09:00" — the short form for list rows */
export function shortSchedule(s: Schedule): string {
  const time = clockTime(s.hour, s.minute)
  if (s.kind === 'daily') return `Täglich ${time}`
  if (s.kind === 'weekdays') return `Werktags ${time}`
  return `${WEEKDAYS_SHORT[s.weekday] ?? 'Mo'} ${time}`
}

/* ------------------------------------------------------------------ */
/* Validation                                                          */

function asInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  if (!Number.isInteger(n) || n < min || n > max) return fallback
  return n
}

export function normalizeSchedule(raw: unknown): Schedule {
  const r = (raw ?? {}) as Partial<Record<keyof Schedule, unknown>>
  const kind: ScheduleKind = r.kind === 'daily' || r.kind === 'weekdays' ? r.kind : 'weekly'
  const tz = typeof r.tz === 'string' && isValidTimeZone(r.tz) ? r.tz : DEFAULT_SCHEDULE.tz
  return {
    kind,
    weekday: asInt(r.weekday, 0, 6, DEFAULT_SCHEDULE.weekday),
    hour: asInt(r.hour, 0, 23, DEFAULT_SCHEDULE.hour),
    minute: asInt(r.minute, 0, 59, DEFAULT_SCHEDULE.minute),
    tz,
  }
}

function stepId(raw: unknown, index: number): string {
  return typeof raw === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(raw) ? raw : `s${index + 1}`
}

/** Shape-check the steps. Canvas ids are only validated for shape here — the
 *  server checks the owner can actually reach each one. */
export function normalizeSteps(raw: unknown): Step[] | string {
  if (!Array.isArray(raw)) return 'Die Schritte müssen als Liste angegeben werden.'
  if (raw.length > MAX_STEPS) return `Höchstens ${MAX_STEPS} Schritte sind erlaubt.`
  const out: Step[] = []
  raw.forEach((item, i) => {
    const s = (item ?? {}) as Record<string, unknown>
    const canvasId = typeof s.canvasId === 'string' ? s.canvasId.trim() : ''
    if (s.type === 'pull') {
      out.push({
        id: stepId(s.id, i),
        type: 'pull',
        provider: 'meta',
        accountId: typeof s.accountId === 'string' ? s.accountId.trim().slice(0, 40) : '',
        filter: s.filter === 'all' ? 'all' : 'active',
        canvasId,
      })
    } else if (s.type === 'agent') {
      out.push({
        id: stepId(s.id, i),
        type: 'agent',
        title: typeof s.title === 'string' ? s.title.trim().slice(0, MAX_NAME) : '',
        prompt: typeof s.prompt === 'string' ? s.prompt.trim().slice(0, MAX_PROMPT) : '',
        /* one agent per task — the first real role wins */
        roles: normalizePipeline(s.roles).slice(0, 1),
        canvasId,
      })
    }
  })
  if (out.length !== raw.length) return 'Jeder Schritt muss ein Import oder eine Agentenaufgabe sein.'
  return out
}

/** Why a saved automation cannot run yet — shown inline, and the reason the
 *  scheduler skips it. Undefined = ready. */
export function incompleteReason(steps: Step[]): string | undefined {
  if (steps.length === 0) return 'Füge einen Schritt hinzu.'
  for (const s of steps) {
    if (!s.canvasId) return 'Wähle für jeden Schritt eine Arbeitsfläche.'
    if (s.type === 'pull' && !s.accountId) return 'Wähle ein Meta-Werbekonto.'
    if (s.type === 'agent' && !s.prompt) return 'Beschreibe, was der Agent tun soll.'
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* Examples                                                            */

export type ExampleStep = Omit<PullStep, 'id' | 'canvasId'> | Omit<AgentStep, 'id' | 'canvasId'>

export interface AutomationExample {
  id: string
  name: string
  blurb: string
  schedule: Omit<Schedule, 'tz'>
  steps: ExampleStep[]
}

/** The "start from an example" cards. Canvas (and Meta account) are left for
 *  the user to pick; everything else is filled in. */
export const AUTOMATION_EXAMPLES: AutomationExample[] = [
  {
    id: 'weekly-creatives',
    name: 'Wöchentliche Werbemotive',
    blurb: 'Importiere jeden Montag alle aktiven Meta-Anzeigen auf eine Arbeitsfläche.',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    steps: [{ type: 'pull', provider: 'meta', accountId: '', filter: 'active' }],
  },
  {
    id: 'ad-variants',
    name: 'Anzeigenvarianten',
    blurb: 'Importiere die Werbemotive dieser Woche und lass Doop jeweils fünf Varianten erstellen.',
    schedule: { kind: 'weekly', weekday: 1, hour: 9, minute: 0 },
    steps: [
      { type: 'pull', provider: 'meta', accountId: '', filter: 'active' },
      {
        type: 'agent',
        title: 'Varianten erstellen',
        prompt:
          'Erstelle für jedes heute importierte Werbemotiv fünf Varianten als neue Zeichenflächen daneben: eine stärkere Überschrift, eine andere visuelle Hierarchie, eine mutigere Farbgestaltung, eine kürzere Textversion und eine Variante, die mit Kundenstimmen beginnt. Behalte die Marke bei.',
        roles: ['doop'],
      },
    ],
  },
  {
    id: 'friday-ux',
    name: 'UX-Prüfung am Freitag',
    blurb: 'Der UX-Agent prüft alles, was sich diese Woche geändert hat.',
    schedule: { kind: 'weekly', weekday: 5, hour: 16, minute: 0 },
    steps: [
      {
        type: 'agent',
        title: 'Wöchentliche Prüfung',
        prompt:
          'Prüfe jede Zeichenfläche auf dieser Arbeitsfläche aus Sicht der Bedienung. Korrigiere unklare Hauptaktionen, uneindeutige Hierarchien und fehlende Zustände. Hinterlasse eine kurze Notiz zu Deinen Änderungen.',
        roles: ['ux'],
      },
    ],
  },
  {
    id: 'brand-a11y',
    name: 'Marken- und Barrierefreiheitsprüfung',
    blurb: 'Bringe jede Zeichenfläche mit der Marke und WCAG AA in Einklang.',
    schedule: { kind: 'weekly', weekday: 3, hour: 10, minute: 0 },
    steps: [
      {
        type: 'agent',
        title: 'Markenprüfung',
        prompt:
          'Prüfe jede Zeichenfläche auf dieser Arbeitsfläche anhand der vorhandenen Marke: Farbpalette, Schrift, Radien und Tonalität sowie Kontrast und Semantik nach WCAG AA. Behebe Abweichungen, ohne das Design neu zu gestalten.',
        roles: ['brand'],
      },
    ],
  },
  {
    id: 'copy-pass',
    name: 'Wöchentliche Textprüfung',
    blurb: 'Der Text-Agent verbessert jede Überschrift und Beschriftung.',
    schedule: { kind: 'weekly', weekday: 2, hour: 9, minute: 30 },
    steps: [
      {
        type: 'agent',
        title: 'Textprüfung',
        prompt:
          'Gehe alle Zeichenflächen auf dieser Arbeitsfläche durch und straffe die Texte: konkrete Überschriften, kurze Beschriftungen, klare Handlungsaufrufe, keine Füllwörter. Halte jede Zeile innerhalb ihres vorhandenen Bereichs.',
        roles: ['copy'],
      },
    ],
  },
  {
    id: 'nightly-polish',
    name: 'Abendlicher Feinschliff',
    blurb: 'Der Feinschliff-Agent verbessert jeden Abend Abstände und Ausrichtung.',
    schedule: { kind: 'weekdays', weekday: 1, hour: 22, minute: 0 },
    steps: [
      {
        type: 'agent',
        title: 'Feinschliff',
        prompt:
          'Verfeinere jede Zeichenfläche auf dieser Arbeitsfläche: optische Ausrichtung, einheitliche Abstände, abgestufte Schriftgrößen und keine überstehenden Inhalte. Nimm nur kleine, gezielte Änderungen vor.',
        roles: ['polish'],
      },
    ],
  },
]

export function exampleById(id: string): AutomationExample | undefined {
  return AUTOMATION_EXAMPLES.find((e) => e.id === id)
}
