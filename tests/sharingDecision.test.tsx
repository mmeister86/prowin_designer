// @vitest-environment happy-dom
import { act, type ComponentProps, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from '../src/lib/api'
import { useStore } from '../src/lib/store'
import { Onboarding } from '../src/components/Onboarding'
import { ShareModal } from '../src/components/ShareModal'
import { TooltipProvider } from '../src/components/ui/tooltip'
import type { WorkspaceSummary } from '../shared/types'

const mocks = vi.hoisted(() => ({ userId: 'owner', mobile: false }))

vi.mock('../src/App', () => ({ navigate: vi.fn() }))
vi.mock('../src/lib/auth', () => ({
  authClient: { useSession: () => ({ data: { user: { id: mocks.userId } } }) },
}))
vi.mock('../src/hooks/use-mobile', () => ({ useIsMobile: () => mocks.mobile }))

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type ShareCanvas = ComponentProps<typeof ShareModal>['canvas']
const OWNER = { id: 'share', name: 'Design', ownerId: 'owner', memberIds: [] } satisfies Partial<ShareCanvas>
const writeText = vi.fn()

const workspace: WorkspaceSummary = {
  id: 'w1',
  name: 'Team',
  ownerId: 'owner',
  role: 'owner',
  status: 'active',
  active: true,
  plan: null,
  interval: null,
  seats: 1,
  memberCount: 3,
  canvasCount: 1,
  cancelAtPeriodEnd: false,
  createdAt: 0,
  updatedAt: 0,
}

async function withPage(page: ReactNode, check: (container: HTMLDivElement) => void | Promise<void>) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<TooltipProvider>{page}</TooltipProvider>))
    await act(async () => {})
    await check(container)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}

function shareModal(canvas: ShareCanvas, onChange = vi.fn(), onCopied = vi.fn()) {
  return <ShareModal canvas={canvas} onChange={onChange} onClose={() => {}} onCopied={onCopied} />
}

const dialogText = () => document.body.querySelector('[role="dialog"]')?.textContent ?? ''
const button = (container: HTMLElement, label: string) =>
  Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes(label))
const dialogButton = (label: string) => button(document.body, label)

beforeEach(() => {
  mocks.userId = 'owner'
  mocks.mobile = false
  writeText.mockReset().mockResolvedValue(undefined)
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(writeText)
  vi.spyOn(api, 'listMembers').mockResolvedValue([])
  vi.spyOn(api, 'listWorkspaces').mockResolvedValue({ workspaces: [], billing: { enabled: false } })
  vi.spyOn(api, 'canvasCapabilities').mockResolvedValue({ manageLocks: false, localAgent: false, publish: false })
  vi.spyOn(api, 'setLinkAccess').mockResolvedValue(undefined)
  useStore.setState({ tasks: [], presences: {} })
  localStorage.removeItem('doop:onboarding')
})

afterEach(() => vi.restoreAllMocks())

it('names an active link as coediting for owners and keeps the warning visible', async () => {
  await withPage(shareModal({ ...OWNER, id: 'active-owner', linkAccess: 'edit' }), () => {
    expect(dialogText()).toContain('Alle Angemeldeten mit dem Link können bearbeiten')
    expect(dialogText()).toContain(
      'Angemeldete Personen mit diesem Link können Deine Arbeitsfläche mitbearbeiten. Dies ist kein reiner Ansichts-Link.',
    )
    expect(dialogButton('Bearbeitungslink kopieren')).toBeTruthy()
  })
})

it('shows the same coediting warning to non-owners without management controls', async () => {
  mocks.userId = 'guest'
  await withPage(shareModal({ ...OWNER, id: 'active-guest', linkAccess: 'edit' }), () => {
    expect(dialogText()).toContain('Alle Angemeldeten mit dem Link können bearbeiten')
    expect(dialogText()).toContain('Dies ist kein reiner Ansichts-Link.')
    expect(dialogButton('Bearbeitungslink kopieren')).toBeTruthy()
    expect(document.body.querySelector('input[type="checkbox"]')).toBeNull()
  })
})

it('explains existing access for an inactive link, including workspace members', async () => {
  vi.spyOn(api, 'listWorkspaces').mockResolvedValue({ workspaces: [workspace], billing: { enabled: false } })
  await withPage(shareModal({ ...OWNER, id: 'inactive-workspace', linkAccess: 'none', workspaceId: 'w1' }), () => {
    expect(dialogButton('Link kopieren')).toBeTruthy()
    expect(dialogText()).not.toContain('kein reiner Ansichts-Link')
    expect(dialogText()).toContain(
      'Zugriff haben nur Du, eingeladene Personen und Mitglieder des zugehörigen Arbeitsbereichs.',
    )
  })
})

it('does not promise workspace access when the canvas has none', async () => {
  mocks.userId = 'guest'
  await withPage(shareModal({ ...OWNER, id: 'inactive-guest', memberIds: ['guest'] }), () => {
    expect(dialogButton('Link kopieren')).toBeTruthy()
    expect(dialogText()).not.toContain('kein reiner Ansichts-Link')
    expect(dialogText()).toContain('Zugriff haben nur Du und eingeladene Personen.')
    expect(dialogText()).not.toContain('Mitglieder des zugehörigen Arbeitsbereichs')
  })
})

it('copies the unchanged link without changing access or reporting a copy failure', async () => {
  const onChange = vi.fn()
  const onCopied = vi.fn()
  await withPage(shareModal({ ...OWNER, id: 'copy-ok', linkAccess: 'none' }, onChange, onCopied), async () => {
    await act(async () => dialogButton('Link kopieren')!.click())
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/c/copy-ok`)
    expect(onCopied).toHaveBeenCalledOnce()
    expect(onChange).not.toHaveBeenCalled()
    expect(api.setLinkAccess).not.toHaveBeenCalled()
    expect(dialogText()).not.toContain('Der Link konnte nicht kopiert werden')
  })
})

it('keeps clipboard error feedback and does not claim success', async () => {
  writeText.mockRejectedValueOnce(new Error('Permission denied'))
  const onCopied = vi.fn()
  await withPage(shareModal({ ...OWNER, id: 'copy-fail', linkAccess: 'none' }, vi.fn(), onCopied), async () => {
    await act(async () => dialogButton('Link kopieren')!.click())
    expect(onCopied).not.toHaveBeenCalled()
    expect(dialogText()).toContain('Der Link konnte nicht kopiert werden.')
  })
})

it('still requests edit or none from the checkbox and stays unchanged when rejected', async () => {
  const activate = vi.fn()
  await withPage(shareModal({ ...OWNER, id: 'toggle-on', linkAccess: 'none' }, activate), async () => {
    await act(async () => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    expect(api.setLinkAccess).toHaveBeenLastCalledWith('toggle-on', 'edit')
    expect(activate).toHaveBeenCalledWith({ linkAccess: 'edit' })
  })

  vi.mocked(api.setLinkAccess).mockRejectedValueOnce(new Error('Serverseitig abgelehnt'))
  const rejected = vi.fn()
  await withPage(shareModal({ ...OWNER, id: 'toggle-off', linkAccess: 'edit' }, rejected), async () => {
    await act(async () => document.body.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click())
    expect(api.setLinkAccess).toHaveBeenLastCalledWith('toggle-off', 'none')
    expect(rejected).not.toHaveBeenCalled()
    expect(dialogText()).toContain('Alle Angemeldeten mit dem Link können bearbeiten')
    expect(dialogText()).not.toContain('Zugriff haben nur Du')
    expect(dialogText()).toContain('Zugriffsänderung fehlgeschlagen')
  })
})

it('hides gallery promotion without publish capability', async () => {
  await withPage(shareModal({ ...OWNER, id: 'gallery-denied', linkAccess: 'none' }), () => {
    expect(dialogText()).not.toContain('Community-Galerie')
    expect(dialogText()).not.toContain('veröffentlichte Vorlagen')
    expect(dialogButton('Link kopieren')).toBeTruthy()
  })
})

it('describes gallery copies without claiming overall privacy for a published canvas', async () => {
  vi.spyOn(api, 'canvasCapabilities').mockResolvedValue({ manageLocks: false, localAgent: false, publish: true })
  await withPage(shareModal({ ...OWNER, id: 'gallery-published', linkAccess: 'edit', publishedAt: 1 }), () => {
    expect(dialogText()).toContain(
      'Alle angemeldeten Nutzerinnen können veröffentlichte Vorlagen ansehen und in ihr eigenes Konto kopieren. Die Veröffentlichung allein gewährt keinen Bearbeitungszugriff auf das Original.',
    )
    expect(dialogText()).not.toContain('bleibt privat')
    const label = Array.from(document.body.querySelectorAll('label')).find((node) =>
      node.textContent?.includes('Community-Galerie'),
    )
    expect(label?.getAttribute('title')).toContain('Veröffentlichung allein gewährt keinen Bearbeitungszugriff')
  })
})

it('offers export as the alternative to showing in the desktop share dialog', async () => {
  await withPage(shareModal({ ...OWNER, id: 'export-hint', linkAccess: 'none' }), () => {
    expect(dialogText()).toContain(
      'Nur zeigen? Exportiere Dein Design als Datei oder nutze „Als Datei teilen“. Die Datei ist eine Momentaufnahme ohne Zugriff auf Deine Arbeitsfläche.',
    )
  })
})

it('shows the sharing hint in the desktop onboarding checklist', async () => {
  await withPage(<Onboarding canvasId="onboarding-desktop" />, (container) => {
    expect(container.textContent).toContain(
      'Teilen: Ein aktivierter Bearbeitungslink erlaubt angemeldeten Personen die Mitbearbeitung. Zum reinen Zeigen exportiere Dein Design als Datei.',
    )
    expect(container.textContent).not.toContain('0/2')
  })
})

it('shows the same hint and keeps the two-step progress on mobile', async () => {
  mocks.mobile = true
  await withPage(<Onboarding canvasId="onboarding-mobile" />, async (container) => {
    const trigger = button(container, 'Erste Schritte')!
    expect(trigger.textContent).toContain('0/2')
    await act(async () => trigger.click())
    expect(document.body.textContent).toContain(
      'In zwei Schritten bringst Du Deinen eigenen Agenten auf die Arbeitsfläche.',
    )
    expect(document.body.textContent).toContain(
      'Teilen: Ein aktivierter Bearbeitungslink erlaubt angemeldeten Personen die Mitbearbeitung. Zum reinen Zeigen exportiere Dein Design als Datei.',
    )
  })
})

it('keeps a dismissed checklist with an acknowledged notice hidden', async () => {
  localStorage.setItem('doop:onboarding', JSON.stringify({ dismissed: true, notice: true }))
  await withPage(<Onboarding canvasId="onboarding-hidden" />, (container) => {
    expect(container.textContent).toBe('')
  })
})

it('shows only the AI notice when the checklist was dismissed without acknowledging it', async () => {
  localStorage.setItem('doop:onboarding', JSON.stringify({ dismissed: true }))
  await withPage(<Onboarding canvasId="onboarding-notice" />, (container) => {
    expect(container.textContent).toContain('KI-Hinweis')
    expect(container.textContent).toContain('KI-Hinweis:')
    expect(container.textContent).not.toContain('Erste Schritte')
    expect(container.textContent).not.toContain('Verbinde Deinen eigenen Agenten')
    expect(container.textContent).not.toContain('Teilen: Ein aktivierter Bearbeitungslink')
  })
})
