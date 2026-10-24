// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ creator: false, register: vi.fn() }))
vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'alice' } } }) } }))
vi.mock('../src/lib/me', () => ({ useMe: () => ({ creator: mocks.creator }) }))
vi.mock('../src/lib/api', () => ({ api: { registerCreator: mocks.register }, errorMessage: (e: Error) => e.message }))
import { CreatorRegistration } from '../src/prowin/CreatorRegistration'
afterEach(() => {
  vi.clearAllMocks()
  mocks.creator = false
})
it('offers explicit registration to advisors and shows active status for Creators', () => {
  expect(renderToStaticMarkup(<CreatorRegistration />)).toContain('Als Creator registrieren')
  mocks.creator = true
  const html = renderToStaticMarkup(<CreatorRegistration />)
  expect(html).toContain('Creator aktiv')
  expect(html).not.toContain('Als Creator registrieren')
})
it('registers on a deliberate click and reports server errors without claiming success', async () => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const container = document.createElement('div')
  const root = createRoot(container)
  const done = vi.fn()
  try {
    mocks.register.mockRejectedValue(new Error('Server unavailable'))
    await act(async () => root.render(<CreatorRegistration onRegistered={done} />))
    expect(mocks.register).not.toHaveBeenCalled()
    await act(async () => container.querySelector('button')!.click())
    expect(container.textContent).toContain('Server unavailable')
    expect(done).not.toHaveBeenCalled()
    mocks.register.mockResolvedValue({ creator: true, canCreateWorkspace: true })
    await act(async () => container.querySelector('button')!.click())
    expect(done).toHaveBeenCalledOnce()
  } finally {
    await act(async () => root.unmount())
  }
})
