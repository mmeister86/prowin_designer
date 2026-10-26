// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { WebhookInfo } from '../shared/webhooks'

const mocks = vi.hoisted(() => ({ listWebhooks: vi.fn() }))
vi.mock('../src/lib/api', () => ({ api: { listWebhooks: mocks.listWebhooks }, errorMessage: () => '' }))
const { Webhooks } = await import('../src/components/Webhooks')
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

it.each([
  'paused after 10 failed deliveries in a row (last: HTTP 500)',
  'Pausiert nach 10 fehlgeschlagenen Zustellungen in Folge (zuletzt: HTTP 500)',
])('shows the stored pause reason verbatim: %s', async (lastError) => {
  const hook: WebhookInfo = {
    id: 'h1',
    url: 'https://example.com/hook',
    events: ['comment.created'],
    enabled: false,
    failures: 10,
    lastError,
    lastAt: 1,
    lastStatus: 500,
    createdAt: 1,
  }
  mocks.listWebhooks.mockResolvedValue([hook])
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Webhooks />))
    expect(container.textContent).toContain(lastError)
    expect(hook.lastError).toBe(lastError)
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})
