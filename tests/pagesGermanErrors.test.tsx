// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import type { Canvas } from '../shared/types'
import { api, ApiError } from '../src/lib/api'
import { useStore } from '../src/lib/store'
import { PagesPanel } from '../src/components/PagesPanel'

it.each([
  [{ code: 'INVALID_TOKEN', error: 'auth_error' }, 'Dieser Link ist ungültig oder abgelaufen. Fordere einen neuen an.'],
  [{ error: 'unknown_machine_code' }, 'Die Seiten konnten nicht gespeichert werden'],
] as const)('shows German page-save errors for %j', async (body, message) => {
  ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  const request = vi.spyOn(api, 'setPages').mockRejectedValue(new ApiError(400, JSON.stringify(body)))
  useStore.setState({
    canvas: { id: 'c', frames: [], pages: [{ id: 'p', name: 'My page' }] } as unknown as Canvas,
    notice: null,
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<PagesPanel />))
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="Seite hinzufügen"]')!.click())
    expect(useStore.getState().notice?.text).toBe(message)
    expect(useStore.getState().canvas?.pages?.[0]?.name).toBe('My page')
  } finally {
    act(() => root.unmount())
    container.remove()
    request.mockRestore()
  }
})
