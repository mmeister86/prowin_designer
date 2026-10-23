import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

it.each([undefined, 'legacy-project-key'])('never sends analytics with key %s', async (key) => {
  vi.stubEnv('POSTHOG_KEY', key)
  vi.stubEnv('VITE_POSTHOG_KEY', key)
  const request = vi.fn().mockResolvedValue(new Response())
  vi.stubGlobal('fetch', request)
  const { capture, captureThrottled } = await import('../server/analytics.ts')

  capture('user-1', 'image_generated', { model: 'example' })
  captureThrottled('user-1', 'custom_agent_used', { first_tool: 'get_canvas' })
  captureThrottled('user-1', 'custom_agent_used', {}, 0)

  expect(request).not.toHaveBeenCalled()
})
