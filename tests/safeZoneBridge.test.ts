// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { onFrameChange, registerFrameWindow, requestFrame, unregisterFrameWindow } from '../src/lib/frameBridge'

const flush = () => new Promise((r) => setTimeout(r, 0))

beforeEach(() => {
  vi.useRealTimers()
})

it('ignores replies from the wrong source window or wrong reqId', async () => {
  const posted: unknown[] = []
  const asked = { postMessage: (msg: unknown) => posted.push(msg) } as unknown as Window
  const forged = {} as Window
  const changed: number[] = []
  registerFrameWindow('spoof', asked)
  const off = onFrameChange('spoof', () => changed.push(1))
  const post = (source: Window, data: Record<string, unknown>) => {
    const evt = new MessageEvent('message', { data })
    Object.defineProperty(evt, 'source', { value: source })
    window.dispatchEvent(evt)
  }
  try {
    const pending = requestFrame('spoof', 'doop:safe-zones', {})
    await flush()
    // A forged reply from another frame's window must not resolve the request.
    post(forged, { type: 'doop:safe-zones-result', reqId: 1, status: 'ok', boxes: [], viewport: null })
    // A mismatched reply type must not resolve it either.
    post(asked, { type: 'doop:inspect-result', reqId: 1, info: null })
    // frame-updated from an unregistered window must not notify listeners.
    post(forged, { type: 'doop:frame-updated' })
    await flush()
    expect(changed).toEqual([])
    // The genuine reply from the asked window resolves.
    post(asked, {
      type: 'doop:safe-zones-result',
      reqId: 1,
      status: 'ok',
      boxes: [],
      viewport: { width: 10, height: 10 },
    })
    const reply = await pending
    expect(reply).toMatchObject({ status: 'ok' })
    // frame-updated from the registered window notifies with its generation.
    const generations: (number | undefined)[] = []
    const off2 = onFrameChange('spoof', (generation) => generations.push(generation))
    post(asked, { type: 'doop:frame-updated', generation: 7 })
    expect(generations).toEqual([7])
    off2()
  } finally {
    unregisterFrameWindow('spoof', asked)
    off()
  }
})
