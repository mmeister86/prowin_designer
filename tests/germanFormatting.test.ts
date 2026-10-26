import { afterEach, describe, expect, it, vi } from 'vitest'
import { timeAgo } from '../src/lib/time'
import { formatUsd } from '../shared/billing'
import { clockTime, describeSchedule, wallClock } from '../shared/automations'
import { mentionedRole, roleByAgentName, roleName } from '../shared/agents'

afterEach(() => vi.restoreAllMocks())

describe('German display formatting', () => {
  it('uses German agent labels while resolving existing names and mentions', () => {
    expect(roleName('a11y')).toBe('Barrierefreiheit')
    expect(roleByAgentName('Accessibility')?.id).toBe('a11y')
    expect(roleByAgentName('Barrierefreiheit')?.id).toBe('a11y')
    expect(mentionedRole('Please @VisualPolish this')?.id).toBe('polish')
    expect(mentionedRole('Bitte @Feinschliff prüfen')?.id).toBe('polish')
  })
  it.each([
    [0, 'gerade eben'],
    [5, 'vor 5 Sek.'],
    [60, 'vor 1 Min.'],
    [3600, 'vor 1 Std.'],
    [86400, 'vor 1 Tag'],
  ] as const)('formats %i seconds elapsed', (seconds, expected) => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000_000)
    expect(timeAgo(1_000_000_000 - seconds * 1000)).toBe(expected)
  })
  it('keeps USD and the amount while using German decimal formatting', () => {
    expect(formatUsd(1650)).toBe('16,50\u00a0$')
    expect(formatUsd(2000)).toBe('20\u00a0$')
  })
  it('localizes the schedule display without changing scheduler weekday arithmetic', () => {
    expect(clockTime(9, 5)).toBe('09:05')
    expect(describeSchedule({ kind: 'weekly', weekday: 1, hour: 9, minute: 5, tz: 'UTC' })).toBe(
      'Jeden Montag um 09:05',
    )
    expect(wallClock(Date.UTC(2026, 9, 26, 9, 5), 'UTC')).toMatchObject({ weekday: 1, hour: 9, minute: 5 })
  })
})
