/**
 * Plans and subscription vocabulary, shared by the server (Stripe glue,
 * entitlement checks) and the client (pricing modal, billing page).
 *
 * The product is simple on purpose: personal use is free, a shared
 * workspace is the paid thing, and it is priced per seat. Prices live here
 * as display data only — Stripe is the source of truth for what is charged,
 * through the price ids the server reads from its environment.
 */

export type WorkspaceStatus = 'inactive' | 'trialing' | 'active' | 'past_due' | 'canceled'
export type BillingInterval = 'month' | 'year'
export type PlanId = 'free' | 'team' | 'enterprise'

export interface Plan {
  id: PlanId
  name: string
  tagline: string
  /** USD cents per seat per interval; absent on plans that are not self-serve */
  seatPrice?: Record<BillingInterval, number>
  features: string[]
}

/** $20 a seat a month, or $192 a seat a year (two months free). */
export const TEAM_SEAT_PRICE: Record<BillingInterval, number> = { month: 2000, year: 19200 }

export const PLANS: readonly Plan[] = [
  {
    id: 'free',
    name: 'Privat',
    tagline: 'Für Dich und Deine Agenten.',
    features: [
      'Unbegrenzt viele persönliche Arbeitsflächen',
      'Personen zu einzelnen Arbeitsflächen einladen',
      'KI-Agenten über MCP und der Doop-Agent',
      'Community-Galerie, Importe und Designwissen',
    ],
  },
  {
    id: 'team',
    name: 'Team',
    tagline: 'Ein gemeinsamer Arbeitsbereich für Dein gesamtes Team.',
    seatPrice: TEAM_SEAT_PRICE,
    features: [
      'Gemeinsame Arbeitsbereiche – jedes Mitglied hat Zugriff auf alle Arbeitsflächen',
      'Rollen: Eigentümer, Creator, Mitglied',
      'Per E-Mail einladen, Abrechnung der Plätze beim Beitritt',
      'Arbeitsflächen zwischen persönlichem Bereich und Arbeitsbereich verschieben',
      'Alles aus dem Tarif Privat',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    tagline: 'Selbst betreiben oder von uns betreiben lassen.',
    features: ['Persönliche Unterstützung', 'Individuelle Konditionen und Rechnungsstellung'],
  },
]

export const TEAM_PLAN = PLANS.find((p) => p.id === 'team')!

export const ENTERPRISE_CONTACT = 'mailto:hello@doop.design?subject=Doop%20Enterprise'

/** A workspace whose members may grow it: create canvases in it, invite
 *  people, move canvases in. past_due counts — Stripe is retrying the card,
 *  and locking a team out over a failed charge is the wrong first move. */
export function isWorkspaceActive(status: WorkspaceStatus): boolean {
  return status === 'active' || status === 'trialing' || status === 'past_due'
}

/** Stripe's subscription statuses folded into the five the product knows. */
export function workspaceStatusFrom(stripeStatus: string): WorkspaceStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active'
    case 'trialing':
      return 'trialing'
    case 'past_due':
    case 'unpaid':
      return 'past_due'
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled'
    default:
      /* 'incomplete' and 'paused': nothing is paid for yet */
      return 'inactive'
  }
}

export const STATUS_LABELS: Record<WorkspaceStatus, string> = {
  inactive: 'Noch kein Tarif',
  trialing: 'Testphase',
  active: 'Aktiv',
  past_due: 'Zahlung fehlgeschlagen',
  canceled: 'Gekündigt',
}

/** "$20" / "$16.50" — whole dollars stay whole. */
export function formatUsd(cents: number): string {
  const dollars = cents / 100
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: Number.isInteger(dollars) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(dollars)
}

/** What a seat costs per month on a given interval, for the comparison line. */
export function seatPerMonth(interval: BillingInterval): number {
  return interval === 'year' ? Math.round(TEAM_SEAT_PRICE.year / 12) : TEAM_SEAT_PRICE.month
}

export function isBillingInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year'
}
