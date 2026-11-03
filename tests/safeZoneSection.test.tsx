// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Canvas, Frame } from '../shared/types'

const permissions = vi.hoisted(() => ({ manageLocks: true }))
vi.mock('../src/prowin/canvasPermissions', () => ({
  useCanvasCapabilities: () => ({ manageLocks: permissions.manageLocks }),
  canManageFrameLocks: () => permissions.manageLocks,
}))
vi.mock('../src/lib/ws', () => ({ sendWs: vi.fn() }))
vi.mock('../src/lib/frameBridge', async (original) => ({
  ...(await original<typeof import('../src/lib/frameBridge')>()),
  requestSafeZones: vi.fn(async () => ({ status: 'ok', boxes: [], viewport: { width: 1080, height: 1080 } })),
  onFrameChange: vi.fn(() => () => undefined),
}))
vi.mock('../src/lib/api', async (original) => ({
  ...(await original<typeof import('../src/lib/api')>()),
  api: {
    updateFrame: vi.fn(async () => ({})),
    createFrame: vi.fn(async (_canvasId, input) => ({ ...input, id: 'copy' })),
    deleteFrame: vi.fn(async () => ({})),
  },
}))
const { SafeZoneSection } = await import('../src/prowin/SafeZoneSection')
const { useStore } = await import('../src/lib/store')
const { ApiError, api } = await import('../src/lib/api')
const history = await import('../src/lib/history')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const framed: Frame = {
  id: 'zoned',
  canvasId: 'c',
  name: 'Story',
  preset: 'ig-post',
  x: 0,
  y: 0,
  width: 1080,
  height: 1080,
  html: '',
  createdAt: 0,
  updatedAt: 1,
  updatedBy: 'Me',
}
const updateFrame = vi.mocked(api.updateFrame)
const flush = () => new Promise((r) => setTimeout(r, 0))

let root: Root
let container: HTMLDivElement
beforeEach(async () => {
  permissions.manageLocks = true
  vi.clearAllMocks()
  history.clearHistory()
  const { resetGeometrySaves } = await import('../src/lib/geometrySaves')
  resetGeometrySaves()
  localStorage.clear()
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...framed }] } as Canvas)
  useStore.setState({ notice: null })
  useStore.getState().setShowSafeZones(true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function renderSection(frame: Frame = framed) {
  await act(async () => root.render(<SafeZoneSection frame={frame} />))
  await act(async () => {
    await flush()
  })
}

function rejectedZone() {
  return new ApiError(400, JSON.stringify({ error: 'Der Safe-Zone-Abstand ist größer als die Zeichenfläche.' }))
}

it('toggle defaults on and persists under doop:safe-zones', async () => {
  await renderSection()
  const toggle = container.querySelector<HTMLInputElement>('input[aria-label="Safe-Zone-Warnungen anzeigen"]')!
  expect(toggle.checked).toBe(true)
  await act(async () => {
    toggle.click()
  })
  expect(useStore.getState().showSafeZones).toBe(false)
  expect(localStorage.getItem('doop:safe-zones')).toBe('0')
})

it('member sees read-only margins with no save controls', async () => {
  permissions.manageLocks = false
  await renderSection()
  expect(container.textContent).toMatch(/Abstände/)
  expect(container.querySelector('button')).toBe(null)
  expect(container.querySelector('[role="status"]')).not.toBe(null)
})

it('creator save applies locally and records history only after success', async () => {
  updateFrame.mockResolvedValueOnce({ ...framed, safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } })
  await renderSection()
  const top = container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!
  await act(async () => {
    top.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(top, '10')
    top.dispatchEvent(new Event('input', { bubbles: true }))
    top.blur()
    for (const side of ['Abstand rechts', 'Abstand unten', 'Abstand links']) {
      const el = container.querySelector<HTMLInputElement>(`input[aria-label="${side}"]`)!
      el.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, '10')
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.blur()
    }
  })
  await act(async () => {
    container.querySelector('button')!.click()
    await flush()
    await flush()
  })
  expect(updateFrame).toHaveBeenCalledWith('zoned', { safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } })
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'zoned')).toMatchObject({
    safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 },
  })
  await act(async () => {
    await history.undo()
  })
  expect(updateFrame).toHaveBeenCalledTimes(2)
})

it('denied save leaves policy and history untouched with German feedback', async () => {
  updateFrame.mockRejectedValueOnce(rejectedZone())
  await renderSection()
  const top = container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!
  await act(async () => {
    for (const [label, val] of [
      ['Abstand oben', '500'],
      ['Abstand rechts', '0'],
      ['Abstand unten', '500'],
      ['Abstand links', '0'],
    ] as const) {
      const el = container.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
      el.focus()
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, val)
      el.dispatchEvent(new Event('input', { bubbles: true }))
      el.blur()
    }
    void top
    await flush()
  })
  await act(async () => {
    const buttons = [...container.querySelectorAll('button')]
    buttons.find((b) => b.textContent === 'Speichern')!.click()
    await flush()
    await flush()
  })
  expect(useStore.getState().canvas!.frames.find((f) => f.id === 'zoned')!.safeZoneOverride).toBe(undefined)
  expect(useStore.getState().notice?.text).toMatch(/Safe-Zone/)
  await act(async () => {
    await history.undo()
  })
  expect(updateFrame).toHaveBeenCalledTimes(1)
})

it('reset sends an explicit null reset', async () => {
  const withOverride: Frame = { ...framed, safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } }
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...withOverride }] } as Canvas)
  updateFrame.mockResolvedValueOnce({ ...framed })
  await renderSection(withOverride)
  await act(async () => {
    const buttons = [...container.querySelectorAll('button')]
    buttons.find((b) => b.textContent === 'Zurücksetzen')!.click()
    await flush()
    await flush()
  })
  expect(updateFrame).toHaveBeenCalledWith('zoned', { safeZoneOverride: null })
})

it('creator fields start from the effective preset insets, not blank', async () => {
  await renderSection()
  // ig-post defaults to 50 px on every side: the draft shows them on first mount.
  const top = container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!
  expect(top.value).toBe('50')
  const left = container.querySelector<HTMLInputElement>('input[aria-label="Abstand links"]')!
  expect(left.value).toBe('50')
})

it('creator draft follows effective preset changes', async () => {
  await renderSection()
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!.value).toBe('50')
  const story: Frame = { ...framed, preset: 'ig-story' }
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...story }] } as Canvas)
  await renderSection(story)
  // ig-story defaults to top 200: the draft tracks the new effective insets.
  expect(container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!.value).toBe('200')
})

it('untouched empty fields never save zeroes', async () => {
  const withOverride: Frame = { ...framed, safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } }
  useStore.getState().setCanvas({ id: 'c', name: 'Canvas', frames: [{ ...withOverride }] } as Canvas)
  await renderSection(withOverride)
  await act(async () => {
    // Clear one field without typing a replacement: save must refuse, not zero the margins.
    const top = container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!
    top.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(top, '')
    top.dispatchEvent(new Event('input', { bubbles: true }))
    top.blur()
    await flush()
  })
  await act(async () => {
    const buttons = [...container.querySelectorAll('button')]
    buttons.find((b) => b.textContent === 'Speichern')!.click()
    await flush()
    await flush()
  })
  expect(updateFrame).not.toHaveBeenCalled()
  expect(useStore.getState().notice?.text).toMatch(/Ungültige Safe-Zone/)
})

it('fractional input is rejected without rounding', async () => {
  await renderSection()
  await act(async () => {
    const top = container.querySelector<HTMLInputElement>('input[aria-label="Abstand oben"]')!
    top.focus()
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(top, '10.5')
    top.dispatchEvent(new Event('input', { bubbles: true }))
    top.blur()
    await flush()
  })
  await act(async () => {
    const buttons = [...container.querySelectorAll('button')]
    buttons.find((b) => b.textContent === 'Speichern')!.click()
    await flush()
    await flush()
  })
  expect(updateFrame).not.toHaveBeenCalled()
  expect(useStore.getState().notice?.text).toMatch(/Ungültige Safe-Zone/)
})

it('toggle off reports hidden warnings instead of warning counts', async () => {
  const { requestSafeZones } = await import('../src/lib/frameBridge')
  vi.mocked(requestSafeZones).mockResolvedValueOnce({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 200, height: 200 }],
    viewport: { width: 1080, height: 1080 },
    generation: 1,
  })
  await renderSection()
  await act(async () => {
    await flush()
  })
  await act(async () => {
    container.querySelector<HTMLInputElement>('input[aria-label="Safe-Zone-Warnungen anzeigen"]')!.click()
  })
  expect(container.querySelector('[role="status"]')!.textContent).toMatch(/ausgeblendet/i)
})
