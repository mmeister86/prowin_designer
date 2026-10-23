// @vitest-environment happy-dom
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
import { AppRail } from '../src/components/AppRail'
import { TooltipProvider } from '../src/components/ui/tooltip'

vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: null }) } }))
vi.mock('../src/components/DashShell', () => ({ AccountMenu: () => null }))

afterEach(() => localStorage.clear())

it.each(['wide', 'narrow'])('hides optional navigation in the %s sidebar', (mode) => {
  localStorage.setItem('doop-rail', mode)
  const html = renderToStaticMarkup(
    <TooltipProvider>
      <AppRail active="all" canvases={[]} workspaces={[]} />
    </TooltipProvider>,
  )
  expect(html).toContain('Community')
  expect(html).toContain('Connect an agent')
  expect(html).not.toMatch(/Automations|Integrations|Resources/)
})
