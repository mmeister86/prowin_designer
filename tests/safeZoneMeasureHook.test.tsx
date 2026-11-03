// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

const bridge = vi.hoisted(() => ({
  requestSafeZones: vi.fn(),
  listeners: new Map<string, Set<(generation?: number) => void>>(),
}))
vi.mock('../src/lib/frameBridge', () => ({
  requestSafeZones: bridge.requestSafeZones,
  onFrameChange: (frameId: string, cb: (generation?: number) => void) => {
    let set = bridge.listeners.get(frameId)
    if (!set) {
      set = new Set()
      bridge.listeners.set(frameId, set)
    }
    set.add(cb)
    return () => {
      set!.delete(cb)
    }
  },
}))
const { useSafeZoneMeasure } = await import('../src/lib/useSafeZoneMeasure')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const frame = { id: 'f', html: '<div>one</div>', width: 1080, height: 1920 }
const viewport = { width: 1080, height: 1920 }
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

function emit(frameId: string, generation?: number) {
  for (const cb of bridge.listeners.get(frameId) ?? []) cb(generation)
}

function Probe() {
  const { boxes, status } = useSafeZoneMeasure(frame, { enabled: true })
  return (
    <div>
      <span data-status={status} />
      <span data-count={boxes.length} />
    </div>
  )
}

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  vi.clearAllMocks()
  bridge.listeners.clear()
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

async function renderProbe() {
  await act(async () => root.render(<Probe />))
}

const status = () => container.querySelector('[data-status]')!.getAttribute('data-status')!
const count = () => Number(container.querySelector('[data-count]')!.getAttribute('data-count')!)

it('shows measured boxes for the current generation', async () => {
  bridge.requestSafeZones.mockResolvedValue({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport,
    generation: 1,
  })
  await renderProbe()
  await act(async () => {
    emit('f', 1)
    await wait(220)
  })
  expect(status()).toBe('ok')
  expect(count()).toBe(1)
})

it('a stale reply from an older generation never produces trusted success', async () => {
  const boxA = { x: 0, y: 0, width: 10, height: 10 }
  const boxB = { x: 1, y: 1, width: 20, height: 20 }
  const boxC = { x: 2, y: 2, width: 30, height: 30 }
  bridge.requestSafeZones
    .mockImplementationOnce(() => wait(300).then(() => ({ status: 'ok', boxes: [boxA], viewport, generation: 0 })))
    .mockImplementationOnce(() => wait(250).then(() => ({ status: 'ok', boxes: [boxA], viewport, generation: 1 })))
    .mockImplementation(() => Promise.resolve({ status: 'ok', boxes: [boxB, boxC], viewport, generation: 2 }))
  await renderProbe()
  await act(async () => {
    // The mount-time request is still in flight when the first render lands.
    emit('f', 1)
    await wait(200)
    // A second render lands while that request is still in flight.
    emit('f', 2)
    await wait(500)
  })
  // Both older replies died; only the current generation-2 boxes show.
  expect(status()).toBe('ok')
  expect(count()).toBe(2)
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(3)
})

it('a late subscriber measures without waiting for a notification', async () => {
  // The Inspector opens long after the canvas rendered: no notification will
  // ever arrive, so the mount-time request must produce the status alone.
  bridge.requestSafeZones.mockResolvedValue({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport,
    generation: 4,
  })
  await renderProbe()
  await act(async () => {
    await wait(100)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(1)
  expect(status()).toBe('ok')
  expect(count()).toBe(1)
})

it('a change notification invalidates immediately before the delayed request', async () => {
  bridge.requestSafeZones.mockResolvedValue({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport,
    generation: 1,
  })
  await renderProbe()
  await act(async () => {
    emit('f', 1)
    await wait(220)
  })
  expect(status()).toBe('ok')
  bridge.requestSafeZones.mockClear()
  // The notification itself clears the trusted state synchronously; the
  // debounced re-request has not fired yet.
  await act(async () => {
    emit('f', 2)
  })
  expect(count()).toBe(0)
  expect(status()).not.toBe('ok')
  expect(bridge.requestSafeZones).not.toHaveBeenCalled()
})

it('rapid notifications coalesce into one delayed request', async () => {
  bridge.requestSafeZones.mockResolvedValue({ status: 'ok', boxes: [], viewport, generation: 3 })
  await renderProbe()
  await act(async () => {
    // One mount-time request plus one coalesced refresh for all three.
    emit('f', 1)
    emit('f', 2)
    emit('f', 3)
    await wait(250)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(2)
})

it('suspends while hidden and refreshes on return', async () => {
  bridge.requestSafeZones.mockResolvedValue({
    status: 'ok',
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
    viewport,
    generation: 1,
  })
  await renderProbe()
  await act(async () => {
    emit('f', 1)
    await wait(220)
  })
  expect(status()).toBe('ok')
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  bridge.requestSafeZones.mockClear()
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    emit('f', 1)
    await wait(220)
  })
  // Hidden: no request fires and no trusted boxes remain.
  expect(bridge.requestSafeZones).not.toHaveBeenCalled()
  expect(count()).toBe(0)
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalled()
})
