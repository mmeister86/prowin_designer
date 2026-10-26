// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { AuthPage } from '../src/pages/AuthPage'
import { ConfirmDialog } from '../src/components/ui/alert-dialog'
import { Modal, ModalTitle } from '../src/components/ui/modal'
import { themeOptions } from '../src/components/ThemePicker'
import { RunDot, formatRunTime } from '../src/components/AutomateShell'
import { DesktopSignIn } from '../src/pages/DesktopSignIn'
import { Integrations } from '../src/pages/Integrations'
import { Workspace } from '../src/pages/Workspace'
import type { WorkspaceDetail } from '../shared/types'

const auth = vi.hoisted(() => ({ email: vi.fn(), social: vi.fn(), signup: vi.fn(), reset: vi.fn() }))

vi.mock('../src/lib/auth', async (original) => ({
  ...(await original<typeof import('../src/lib/auth')>()),
  authClient: {
    useSession: () => ({ data: { user: { id: 'owner' } } }),
    signIn: { email: auth.email, social: auth.social },
    signUp: { email: auth.signup },
    resetPassword: auth.reset,
  },
}))
vi.mock('../src/components/AppRail', () => ({
  AppRail: ({ children }: { children?: React.ReactNode }) => <aside>{children}</aside>,
  railLayout: '',
}))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

beforeEach(() => {
  vi.stubGlobal('location', new URL('http://localhost/auth'))
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ ok: true, json: async () => ({ google: true, apple: true, exists: true }) }),
  )
  auth.email.mockResolvedValue({ error: { code: 'INVALID_EMAIL_OR_PASSWORD', message: 'upstream secret' } })
  auth.social.mockResolvedValue({ error: { code: 'UNKNOWN', message: 'upstream secret' } })
  auth.signup.mockResolvedValue({
    error: { code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL', message: 'upstream secret' },
  })
  auth.reset.mockResolvedValue({ error: { code: 'INVALID_TOKEN', message: 'upstream secret' } })
})
afterEach(() => vi.unstubAllGlobals())

async function withPage(page: React.ReactNode, run: (container: HTMLDivElement) => Promise<void>) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(page))
    await run(container)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}

it('shows the German sign-in heading', () => {
  expect(renderToStaticMarkup(<AuthPage />)).toContain('Willkommen zurück.')
})

it('uses German confirmation defaults and an accessible close label', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () =>
      root.render(<ConfirmDialog open onOpenChange={() => {}} title="Prüfen" onConfirm={() => {}} />),
    )
    expect(document.body.querySelector('[role="alertdialog"]')?.textContent).toContain('Abbrechen')
    expect(document.body.querySelector('[role="alertdialog"]')?.textContent).toContain('Bestätigen')
    await act(async () =>
      root.render(
        <Modal onClose={() => {}} aria-describedby={undefined}>
          <ModalTitle>Prüfen</ModalTitle>
        </Modal>,
      ),
    )
    expect(document.body.querySelector('button[aria-label="Schließen"]')).not.toBeNull()
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it('keeps technical theme values while showing German labels', () => {
  expect(themeOptions.map(({ label }) => label)).toEqual(['System', 'Hell', 'Dunkel'])
  expect(themeOptions.map(({ value }) => value)).toEqual(['system', 'light', 'dark'])
})

it('declares German HTML and product metadata', () => {
  const html = readFileSync('index.html', 'utf8')
  expect(html).toContain('lang="de"')
  expect(html).toContain('gestaltet von Agenten &amp; Menschen')
  expect(html).toContain('KI-Agenten')
})

it.each([
  ['UNKNOWN', 'Die Anmeldung ist fehlgeschlagen.'],
  ['account_not_linked', 'Melde Dich mit E-Mail und Passwort an'],
  [
    'Sign_up_is_restricted_to_@prowin.net_email_addresses.',
    'Die Registrierung ist auf E-Mail-Adressen von @prowin.net beschränkt.',
  ],
  [
    'Die_Registrierung_ist_auf_E-Mail-Adressen_von_@prowin.net_beschränkt.',
    'Die Registrierung ist auf E-Mail-Adressen von @prowin.net beschränkt.',
  ],
])('shows safe translated OAuth redirects for %s', (code, expected) => {
  vi.stubGlobal(
    'location',
    new URL(`http://localhost/auth?error=${encodeURIComponent(code)}&error_description=upstream%20secret`),
  )
  const html = renderToStaticMarkup(<AuthPage />)
  expect(html).toContain(expected)
  expect(html).not.toContain('upstream secret')
})

it('translates email sign-in errors through their code', async () => {
  await withPage(<AuthPage />, async (container) => {
    await act(async () =>
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    )
    expect(container.textContent).toContain('E-Mail-Adresse oder Passwort ist falsch.')
    expect(container.textContent).not.toContain('upstream secret')
  })
})

it('keeps the signup suggestion for existing accounts', async () => {
  await withPage(<AuthPage />, async (container) => {
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((b) => b.textContent === 'Noch kein Konto? Registrieren')!
        .click(),
    )
    await act(async () =>
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    )
    expect(container.textContent).toContain('Ein Konto mit dieser E-Mail-Adresse existiert bereits.')
    expect(container.textContent).toContain('Stattdessen anmelden →')
    expect(auth.signup).toHaveBeenCalledOnce()
  })
})

it('keeps verification recovery for the stable unverified-email code', async () => {
  auth.email.mockResolvedValue({ error: { code: 'EMAIL_NOT_VERIFIED', message: 'upstream secret' } })
  await withPage(<AuthPage />, async (container) => {
    await act(async () =>
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    )
    expect(container.textContent).toContain('Diese E-Mail-Adresse wurde noch nicht bestätigt.')
    expect(container.textContent).toContain('Bestätigungs-E-Mail erneut senden →')
    expect(container.textContent).not.toContain('upstream secret')
  })
})

it('offers signup when the existing account check finds no account', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ exists: false }) }))
  await withPage(<AuthPage />, async (container) => {
    await act(async () =>
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    )
    expect(container.textContent).toContain('Für diese E-Mail-Adresse wurde kein Konto gefunden.')
    expect(container.textContent).toContain('Stattdessen ein Konto erstellen →')
  })
})

it('translates password-reset errors without showing provider descriptions', async () => {
  vi.stubGlobal('location', new URL('http://localhost/auth/reset?token=expired'))
  await withPage(<AuthPage />, async (container) => {
    await act(async () =>
      container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    )
    expect(container.textContent).toContain('Dieser Link ist ungültig oder abgelaufen.')
    expect(container.textContent).not.toContain('upstream secret')
    expect(auth.reset).toHaveBeenCalledWith({ newPassword: '', token: 'expired' })
  })
})

it('preserves the integration error query key and uses a safe German notice', () => {
  vi.stubGlobal('location', new URL('http://localhost/integrations?metaError=upstream%20secret'))
  const html = renderToStaticMarkup(<Integrations />)
  expect(html).toContain('Die Verbindung mit Meta ist fehlgeschlagen. Versuche es erneut.')
  expect(html).not.toContain('upstream secret')
})

it('never reflects unknown provider messages when starting web or desktop sign-in', async () => {
  await withPage(<AuthPage />, async (container) => {
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((b) => b.textContent?.includes('mit Google'))!
        .click(),
    )
    expect(container.textContent).toContain('Die Anmeldung konnte nicht gestartet werden')
    expect(container.textContent).not.toContain('upstream secret')
  })
  vi.stubGlobal(
    'location',
    new URL(`http://localhost/desktop/signin?provider=google&challenge=${'a'.repeat(32)}&to=%2F`),
  )
  await withPage(<DesktopSignIn signedIn={false} />, async (container) => {
    expect(container.textContent).toContain('kehre zur doop-App zurück')
    expect(container.textContent).not.toContain('upstream secret')
  })
})

it('shows German run status labels and explicit German date formatting', () => {
  expect(renderToStaticMarkup(<RunDot status="running" />)).toContain('aria-label="Wird ausgeführt"')
  expect(renderToStaticMarkup(<RunDot status="failed" />)).toContain('aria-label="Fehlgeschlagen"')
  const at = new Date(2026, 9, 25, 14, 5).getTime()
  const date = new Date(at)
  expect(formatRunTime(at)).toBe(
    `${date.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · ${date.toLocaleTimeString('de-DE', { hour: 'numeric', minute: '2-digit' })}`,
  )
})

it('shows German workspace roles and billing units while preserving select values and user names', async () => {
  const workspace: WorkspaceDetail = {
    id: 'w1',
    name: 'My original workspace',
    ownerId: 'owner',
    role: 'owner',
    status: 'active',
    active: true,
    plan: 'team',
    interval: 'year',
    seats: 2,
    memberCount: 2,
    canvasCount: 1000,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: new Date(2027, 9, 25).getTime(),
    createdAt: 0,
    updatedAt: 0,
    members: [
      { userId: 'owner', name: 'Original Owner', email: 'owner@example.com', role: 'owner', addedAt: 0 },
      { userId: 'member', name: 'Original Member', email: 'member@example.com', role: 'member', addedAt: 0 },
    ],
    invites: [{ id: 'i1', email: 'invite@example.com', role: 'member', invitedByName: 'Original Owner', createdAt: 0 }],
    billing: { enabled: true, portal: true },
  }
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation(async (url: string) => ({
      ok: true,
      json: async () => (url === '/api/workspaces' ? { workspaces: [workspace] } : workspace),
    })),
  )
  // Radix renders its native select for form submission only inside a form.
  await withPage(
    <form>
      <Workspace workspaceId="w1" />
    </form>,
    async (container) => {
      expect(container.textContent).toContain('My original workspace')
      expect(container.textContent).toContain('Original Member')
      expect(container.textContent).toContain('Eigentümer')
      expect(container.textContent).toContain('Mitglied')
      expect(container.textContent).toContain('1.000 Arbeitsflächen')
      const roleSelect = container.querySelector<HTMLSelectElement>('select')!
      expect(Array.from(roleSelect.options).map(({ value, textContent }) => [value, textContent])).toEqual([
        ['member', 'Mitglied'],
        ['creator', 'Creator'],
      ])
      expect(roleSelect.value).toBe('member')
      await act(async () =>
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Tarif & Abrechnung')!
          .click(),
      )
      expect(container.textContent).toContain('pro Jahr')
      expect(container.textContent).toContain('Aktiv')
      expect(container.textContent).toContain('25.10.2027')
      expect(workspace.interval).toBe('year')
      expect(workspace.members[1]?.role).toBe('member')
      await act(async () =>
        Array.from(container.querySelectorAll('button'))
          .find((button) => button.textContent === 'Allgemein')!
          .click(),
      )
      const deleteButton = Array.from(container.querySelectorAll('button')).find(
        (button) => button.textContent === '„My original workspace“ löschen',
      )
      expect(deleteButton).toBeDefined()
      expect(deleteButton?.getAttribute('aria-label') ?? deleteButton?.textContent).toBe(
        '„My original workspace“ löschen',
      )
    },
  )
})
