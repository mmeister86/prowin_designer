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

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function EnabledProbe({ enabled, html }: { enabled: boolean; html: string }) {
  const { boxes, status } = useSafeZoneMeasure({ id: 'f', html, width: 1080, height: 1920 }, { enabled })
  return (
    <div>
      <span data-status={status} />
      <span data-count={boxes.length} />
    </div>
  )
}

async function renderEnabled(enabled: boolean, html: string) {
  await act(async () => {
    root.render(<EnabledProbe enabled={enabled} html={html} />)
  })
}

it('an in-flight reply dies across a same-generation change notification', async () => {
  const boxA = { x: 0, y: 0, width: 10, height: 10 }
  const boxB = { x: 1, y: 1, width: 20, height: 20 }
  const first = deferred<unknown>()
  const second = deferred<unknown>()
  const third = deferred<unknown>()
  bridge.requestSafeZones
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise)
    .mockImplementation(() => third.promise)
  await renderProbe()
  await act(async () => {
    first.resolve({ status: 'ok', boxes: [boxA], viewport, generation: 5 })
    await wait(50)
  })
  expect(status()).toBe('ok')
  // A new render starts a fresh request.
  await act(async () => {
    emit('f', 6)
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(2)
  // A same-document change (no generation bump: resource/layout/DOM) clears
  // immediately and kills the in-flight reply via a new request token.
  await act(async () => {
    emit('f')
  })
  expect(count()).toBe(0)
  expect(status()).not.toBe('ok')
  // The stale in-flight reply resolves after the notification: it must die.
  await act(async () => {
    second.resolve({ status: 'ok', boxes: [boxB], viewport, generation: 6 })
    await wait(50)
  })
  expect(count()).toBe(0)
  expect(status()).not.toBe('ok')
  // The delayed refresh measures the current document instead.
  await act(async () => {
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(3)
  await act(async () => {
    third.resolve({ status: 'ok', boxes: [boxB], viewport, generation: 6 })
    await wait(50)
  })
  expect(status()).toBe('ok')
  expect(count()).toBe(1)
})

it('an in-flight reply never restores trusted boxes while hidden', async () => {
  const box = { x: 0, y: 0, width: 10, height: 10 }
  const first = deferred<unknown>()
  const second = deferred<unknown>()
  const third = deferred<unknown>()
  bridge.requestSafeZones
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise)
    .mockImplementation(() => third.promise)
  await renderProbe()
  await act(async () => {
    first.resolve({ status: 'ok', boxes: [box], viewport, generation: 5 })
    await wait(50)
  })
  expect(status()).toBe('ok')
  await act(async () => {
    emit('f', 6)
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(2)
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
  })
  expect(count()).toBe(0)
  expect(status()).toBe('unavailable')
  // The in-flight reply resolves while hidden: it must die, not restore ok.
  await act(async () => {
    second.resolve({ status: 'ok', boxes: [box], viewport, generation: 6 })
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(2)
  expect(count()).toBe(0)
  expect(status()).toBe('unavailable')
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'))
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(3)
  await act(async () => {
    third.resolve({ status: 'ok', boxes: [box], viewport, generation: 6 })
    await wait(50)
  })
  expect(status()).toBe('ok')
  expect(count()).toBe(1)
})

it('a malformed reply after success reports incomplete with empty boxes', async () => {
  const box = { x: 0, y: 0, width: 10, height: 10 }
  const first = deferred<unknown>()
  const second = deferred<unknown>()
  bridge.requestSafeZones.mockImplementationOnce(() => first.promise).mockImplementation(() => second.promise)
  await renderProbe()
  await act(async () => {
    first.resolve({ status: 'ok', boxes: [box], viewport, generation: 5 })
    await wait(50)
  })
  expect(status()).toBe('ok')
  await act(async () => {
    emit('f', 6)
    await wait(220)
  })
  // Malformed payload: trusted shape missing, null generation.
  await act(async () => {
    second.resolve({ status: 'ok', boxes: [box], viewport: null, generation: null })
    await wait(50)
  })
  expect(count()).toBe(0)
  expect(status()).toBe('incomplete')
})

it('a stale same-generation revival cannot survive a malformed refresh', async () => {
  const box = { x: 0, y: 0, width: 10, height: 10 }
  const first = deferred<unknown>()
  const second = deferred<unknown>()
  const third = deferred<unknown>()
  bridge.requestSafeZones
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise)
    .mockImplementation(() => third.promise)
  await renderProbe()
  await act(async () => {
    first.resolve({ status: 'ok', boxes: [box], viewport, generation: 5 })
    await wait(50)
  })
  await act(async () => {
    emit('f', 6)
    await wait(220)
  })
  await act(async () => {
    emit('f')
  })
  // Stale in-flight reply for the notified generation: must die.
  await act(async () => {
    second.resolve({ status: 'ok', boxes: [box], viewport, generation: 6 })
    await wait(50)
  })
  expect(status()).not.toBe('ok')
  // The refresh then resolves malformed: prior ok must be cleared,
  // reporting incomplete rather than leaving the stale success visible.
  await act(async () => {
    await wait(220)
  })
  await act(async () => {
    third.resolve({ garbage: true })
    await wait(50)
  })
  expect(count()).toBe(0)
  expect(status()).toBe('incomplete')
})

it('re-enabling measurement on the same frame fetches again', async () => {
  const box = { x: 0, y: 0, width: 10, height: 10 }
  bridge.requestSafeZones.mockResolvedValue({ status: 'ok', boxes: [box], viewport, generation: 7 })
  await renderEnabled(false, '<div>one</div>')
  await act(async () => {
    await wait(220)
  })
  // Disabled: no request fires and nothing is trusted.
  expect(bridge.requestSafeZones).not.toHaveBeenCalled()
  expect(count()).toBe(0)
  expect(status()).toBe('unavailable')
  await renderEnabled(true, '<div>one</div>')
  await act(async () => {
    await wait(100)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(1)
  expect(status()).toBe('ok')
  expect(count()).toBe(1)
})

it('enabling alongside new html waits for the render notification', async () => {
  const box = { x: 0, y: 0, width: 10, height: 10 }
  bridge.requestSafeZones.mockResolvedValue({ status: 'ok', boxes: [box], viewport, generation: 9 })
  await renderEnabled(false, '<div>one</div>')
  await act(async () => {
    await wait(100)
  })
  expect(bridge.requestSafeZones).not.toHaveBeenCalled()
  // The stored html changed in the same commit: the runtime has not rendered
  // it yet, so enabling must not measure the old document — the render
  // notification drives the request instead.
  await renderEnabled(true, '<div>two</div>')
  await act(async () => {
    await wait(100)
  })
  expect(bridge.requestSafeZones).not.toHaveBeenCalled()
  expect(status()).toBe('unavailable')
  await act(async () => {
    emit('f', 9)
    await wait(220)
  })
  expect(bridge.requestSafeZones).toHaveBeenCalledTimes(1)
  expect(status()).toBe('ok')
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
