// @vitest-environment happy-dom
import { act, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { api, adminApi } from '../src/lib/api'
import { AutomationEditor } from '../src/pages/AutomationEditor'
import { Admin } from '../src/pages/Admin'
import { Community } from '../src/pages/Community'
import { ShareModal } from '../src/components/ShareModal'
import { MoveCanvasModal } from '../src/components/WorkspaceModals'
import { SelectionBar } from '../src/components/ui/selection-bar'
import { TooltipProvider } from '../src/components/ui/tooltip'
import type { Automation } from '../shared/automations'

vi.mock('../src/App', () => ({ navigate: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'owner' } } }) } }))
vi.mock('../src/components/AppRail', () => ({
  AppRail: ({ children }: { children?: ReactNode }) => <aside>{children}</aside>,
  railLayout: '',
}))
vi.mock('../src/components/FramePreview', () => ({ FramePreview: () => null, FrameThumb: () => null }))
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => vi.restoreAllMocks())

async function withPage(page: ReactNode, check: (container: HTMLDivElement) => void | Promise<void>) {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<TooltipProvider>{page}</TooltipProvider>))
    await check(container)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
}

it('renders German editor prepositions and the missing-canvas run fallback without changing stored steps', async () => {
  const automation: Automation = {
    id: 'a1',
    name: 'Original English automation',
    enabled: false,
    schedule: { kind: 'daily', weekday: 1, hour: 9, minute: 0, tz: 'Europe/Berlin' },
    steps: [
      { id: 's1', type: 'pull', provider: 'meta', accountId: 'act_1234', filter: 'active', canvasId: 'c1' },
      {
        id: 's2',
        type: 'agent',
        title: 'Original agent title',
        prompt: 'Original user prompt',
        roles: ['designer'],
        canvasId: 'c1',
      },
    ],
    nextRunAt: null,
    lastRun: null,
    createdAt: 0,
    updatedAt: 0,
  }
  vi.spyOn(api, 'getAutomation').mockResolvedValue(automation)
  vi.spyOn(api, 'listCanvases').mockResolvedValue([])
  vi.spyOn(api, 'integrations').mockResolvedValue({ meta: { enabled: false, connected: false, accounts: [] } })
  vi.spyOn(api, 'listRuns').mockResolvedValue([
    {
      id: 'r1',
      automationId: 'a1',
      startedAt: 1,
      endedAt: 2,
      status: 'ok',
      summary: 'Original result',
      error: null,
      canvasId: 'missing',
      failure: null,
    },
  ])
  await withPage(<AutomationEditor automationId="a1" />, (container) => {
    const words = Array.from(container.querySelectorAll('span')).map((span) => span.textContent)
    expect.soft(words).toContain('in')
    expect.soft(words).toContain('auf')
    expect.soft(words).not.toContain('into')
    expect.soft(words).not.toContain('on')
    expect
      .soft(Array.from(container.querySelectorAll('button')).some((b) => b.textContent === 'Öffnen Arbeitsfläche →'))
      .toBe(true)
    expect(container.textContent).toContain('Original result')
    expect(automation.steps[0]).toMatchObject({
      type: 'pull',
      provider: 'meta',
      filter: 'active',
      accountId: 'act_1234',
    })
  })
})

it('formats large selection counts in German', async () => {
  await withPage(<SelectionBar count={1234} total={5678} />, (container) => {
    expect(container.textContent).toBe('1.234 von 5.678 ausgewählt')
  })
})

it('formats admin result totals and mobile navigation counts in German', async () => {
  vi.spyOn(adminApi, 'canvases').mockResolvedValue({
    total: 5678,
    canvases: Array.from({ length: 1234 }, (_, i) => ({
      id: `c${i}`,
      name: 'Original canvas',
      createdAt: 0,
      updatedAt: 0,
      frameCount: 0,
      linkAccess: 'none',
      memberCount: 1234,
    })),
  })
  vi.spyOn(adminApi, 'users').mockResolvedValue([])
  vi.spyOn(adminApi, 'stats').mockResolvedValue({ users: 5678, canvases: 1234, frames: 0 })
  await withPage(<Admin />, (container) => {
    expect
      .soft(container.textContent?.includes('Angezeigt werden die 1.234 zuletzt aktualisierten von 5.678'))
      .toBe(true)
    expect.soft(container.textContent?.includes('1.234 eingeladen')).toBe(true)
    expect.soft(container.querySelector('[role="tab"][data-state="active"]')?.textContent).toContain('1.234')
  })
})

it('formats filtered community result and category counts in German', async () => {
  vi.spyOn(api, 'listCommunity').mockResolvedValue(
    Array.from({ length: 1234 }, (_, i) => ({
      id: `c${i}`,
      name: 'Original design',
      category: 'website',
      authorName: 'Original Author',
      publishedAt: 0,
      updatedAt: 0,
      copyCount: 0,
      frames: [],
    })),
  )
  await withPage(<Community />, async (container) => {
    const category = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('Websites ·'),
    )!
    expect.soft(category.textContent).toContain('1.234')
    await act(async () => category.click())
    expect(container.textContent?.includes('1.234 von 1.234')).toBe(true)
    expect(container.textContent).toContain('Original design')
  })
})

it('keeps the sharing action in the accessible modal title and preserves the canvas name', async () => {
  vi.spyOn(api, 'listMembers').mockResolvedValue([])
  vi.spyOn(api, 'listWorkspaces').mockResolvedValue({ workspaces: [], billing: { enabled: false } })
  vi.spyOn(api, 'canvasCapabilities').mockResolvedValue({ manageLocks: false, localAgent: false, publish: false })
  await withPage(
    <ShareModal
      canvas={{ id: 'c1', name: 'Original English name', memberIds: [], linkAccess: 'none' }}
      onChange={() => {}}
      onClose={() => {}}
      onCopied={() => {}}
    />,
    () => {
      const dialog = document.body.querySelector('[role="dialog"]')!
      expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
        '„Original English name“ teilen',
      )
    },
  )
})

it('keeps the moving action in the accessible modal title and preserves the canvas name', async () => {
  await withPage(
    <MoveCanvasModal
      canvas={{ id: 'c1', name: 'Original English name' }}
      workspaces={[]}
      onClose={() => {}}
      onMoved={() => {}}
      onPaywall={() => {}}
    />,
    () => {
      const dialog = document.body.querySelector('[role="dialog"]')!
      expect(document.getElementById(dialog.getAttribute('aria-labelledby')!)?.textContent).toBe(
        '„Original English name“ verschieben',
      )
    },
  )
})
