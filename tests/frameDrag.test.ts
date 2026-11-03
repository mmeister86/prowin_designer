import { beforeEach, expect, it, vi } from 'vitest'
import type { Canvas, ClientMessage, Frame } from '../shared/types.ts'
import { relayFrameDrag } from '../server/frameDrag.ts'
import { permissionIdentity } from '../server/prowin/accounts.ts'
import { store } from '../server/store.ts'

vi.mock('../server/prowin/accounts.ts', () => ({ permissionIdentity: vi.fn() }))
vi.mock('../server/db/persist.ts', () => ({ saveFrame: vi.fn(), saveCanvas: vi.fn() }))

type Drag = Extract<ClientMessage, { type: 'frame:drag' }>
const session = async () => ({ user: { id: 'creator' } })
const drag = (x: number, patch: Partial<Drag> = {}): Drag => ({
  type: 'frame:drag',
  frameId: 'f',
  x,
  y: 77,
  width: 1111,
  height: 1080,
  ...patch,
})
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let frame: Frame
let canvas: Canvas
beforeEach(() => {
  vi.mocked(permissionIdentity)
    .mockReset()
    .mockImplementation(async (userId) => ({ userId, creator: true, admin: false }))
  frame = {
    id: 'f',
    canvasId: 'c',
    pageId: 'page',
    name: 'Preset',
    preset: 'ig-post',
    x: 0,
    y: 0,
    width: 1080,
    height: 1080,
    html: '<p>Design</p>',
    createdAt: 1,
    updatedAt: 1,
    updatedBy: 'Creator',
  }
  canvas = {
    id: 'c',
    name: 'Canvas',
    pages: [{ id: 'page', name: 'Page' }],
    ownerId: 'creator',
    memberIds: ['mate'],
    frames: [frame],
    createdAt: 1,
    updatedAt: 1,
  }
  store.init([canvas])
})

it('keeps relaying continuous 50-ms arrivals when the two lookups take 80 ms', async () => {
  vi.useFakeTimers()
  try {
    vi.mocked(permissionIdentity).mockImplementation(async (userId) => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return { userId, creator: true, admin: false }
    })
    const slowSession = async () => {
      await new Promise((resolve) => setTimeout(resolve, 40))
      return session()
    }
    const relays: number[] = []
    const pending: Promise<void>[] = []
    for (const x of [10, 20, 30, 40, 50]) {
      pending.push(
        relayFrameDrag('c', drag(x), slowSession, () => {
          relays.push(x)
        }),
      )
      await vi.advanceTimersByTimeAsync(50)
    }
    // The fifth lookup is still pending; peers must already have seen four live updates.
    expect(relays).toEqual([10, 20, 30, 40])
    await vi.advanceTimersByTimeAsync(50)
    await Promise.all(pending)
    expect(relays).toEqual([10, 20, 30, 40, 50])
  } finally {
    vi.useRealTimers()
  }
})

it.each(['denied', 'disconnected'] as const)(
  'does not let a newer %s drag suppress an older valid pending relay',
  async (outcome) => {
    const gate = deferred<void>()
    const started = deferred<void>()
    vi.mocked(permissionIdentity).mockImplementationOnce(async (userId) => {
      started.resolve()
      await gate.promise
      return { userId, creator: true, admin: false }
    })
    const relays: number[] = []
    const older = relayFrameDrag('c', drag(10), session, () => {
      relays.push(10)
    })
    await started.promise
    await relayFrameDrag('c', drag(20), outcome === 'denied' ? async () => null : session, () => false)
    gate.resolve()
    await older
    expect(relays).toEqual([10])
  },
)

it.each(['session', 'permission'] as const)(
  'drops an older drag when a newer drag finishes during its delayed %s lookup',
  async (stage) => {
    const gate = deferred<void>()
    const started = deferred<void>()
    if (stage === 'permission')
      vi.mocked(permissionIdentity).mockImplementationOnce(async (userId) => {
        started.resolve()
        await gate.promise
        return { userId, creator: true, admin: false }
      })
    const relays: number[] = []
    const older = relayFrameDrag(
      'c',
      drag(10),
      stage === 'session'
        ? async () => {
            started.resolve()
            await gate.promise
            return session()
          }
        : session,
      () => {
        relays.push(10)
      },
    )
    await started.promise
    await relayFrameDrag('c', drag(20), session, () => {
      relays.push(20)
    })
    expect(relays).toEqual([20])
    gate.resolve()
    await older
    expect(relays).toEqual([20])
  },
)

it.each(['session', 'permission'] as const)(
  'does not relay a drag over a committed update during its delayed %s lookup',
  async (stage) => {
    const gate = deferred<void>()
    const started = deferred<void>()
    if (stage === 'permission')
      vi.mocked(permissionIdentity).mockImplementationOnce(async (userId) => {
        started.resolve()
        await gate.promise
        return { userId, creator: true, admin: false }
      })
    const relay = vi.fn()
    const pending = relayFrameDrag(
      'c',
      drag(10),
      stage === 'session'
        ? async () => {
            started.resolve()
            await gate.promise
            return session()
          }
        : session,
      relay,
    )
    await started.promise
    store.updateFrame('f', { x: 99, width: 1200 }, 'Creator')
    expect(store.getFrame('f')).toBe(frame) // The real store mutates the same object.
    gate.resolve()
    await pending
    expect(relay).not.toHaveBeenCalled()
    expect(frame).toMatchObject({ x: 99, width: 1200 })
  },
)

it.each([{ width: 500 }, { height: 500 }])(
  'awaits a denied member size patch %j to completion without relaying',
  async (patch) => {
    const relay = vi.fn()
    await relayFrameDrag('c', drag(10, { width: 1080, ...patch }), async () => ({ user: { id: 'mate' } }), relay)
    expect(relay).not.toHaveBeenCalled()
  },
)

it.each(['missing', 'foreign'])('does not relay a %s frame into the joined room', async (id) => {
  const relay = vi.fn()
  if (id === 'foreign') frame.canvasId = 'other'
  await relayFrameDrag('c', drag(10, { frameId: id === 'missing' ? id : 'f' }), session, relay)
  expect(relay).not.toHaveBeenCalled()
})

it('awaits current-session denial to completion instead of using a viewport or timeout barrier', async () => {
  const gate = deferred<null>()
  const relay = vi.fn()
  const pending = relayFrameDrag('c', drag(10), () => gate.promise, relay)
  gate.resolve(null)
  await pending
  expect(relay).not.toHaveBeenCalled()
})

it('rechecks Creator revocation for subsequent drags but still allows position-only messages', async () => {
  const relay = vi.fn()
  await relayFrameDrag('c', drag(10), session, relay)
  expect(relay).toHaveBeenCalledTimes(1)
  vi.mocked(permissionIdentity).mockResolvedValue({ userId: 'creator', creator: false, admin: false })
  await relayFrameDrag('c', drag(20), session, relay)
  expect(relay).toHaveBeenCalledTimes(1)
  await relayFrameDrag('c', { type: 'frame:drag', frameId: 'f', x: 30, y: 77 } as Drag, session, relay)
  expect(relay).toHaveBeenCalledTimes(2)
})

it('drops a pending position-only relay after source canvas access is revoked', async () => {
  const gate = deferred<void>()
  const started = deferred<void>()
  vi.mocked(permissionIdentity).mockImplementationOnce(async (userId) => {
    started.resolve()
    await gate.promise
    return { userId, creator: true, admin: false }
  })
  const relay = vi.fn()
  const pending = relayFrameDrag(
    'c',
    { type: 'frame:drag', frameId: 'f', x: 30, y: 77 } as Drag,
    async () => ({ user: { id: 'mate' } }),
    relay,
  )
  await started.promise
  canvas.memberIds = []
  gate.resolve()
  await pending
  expect(relay).not.toHaveBeenCalled()
})

it('drops a live drag that would break the stored safe-zone override but still relays valid drags', async () => {
  frame.safeZoneOverride = { top: 500, right: 0, bottom: 500, left: 0 }
  const relay = vi.fn()
  /* shrinking to 880 leaves no room for top+bottom 1000: never reach peers */
  await relayFrameDrag('c', drag(10, { width: 1080, height: 880 }), session, relay)
  expect(relay).not.toHaveBeenCalled()
  /* the same position at a fitting size still relays */
  await relayFrameDrag('c', drag(10, { width: 1080, height: 1080 }), session, relay)
  expect(relay).toHaveBeenCalledTimes(1)
  /* position-only messages carry no size change and still relay */
  await relayFrameDrag('c', { type: 'frame:drag', frameId: 'f', x: 30, y: 77 } as Drag, session, relay)
  expect(relay).toHaveBeenCalledTimes(2)
})

it('does not discard a pending drag just because another frame is being dragged', async () => {
  const other = { ...frame, id: 'other' }
  canvas.frames.push(other)
  store.init([canvas])
  const gate = deferred<void>()
  const started = deferred<void>()
  vi.mocked(permissionIdentity).mockImplementationOnce(async (userId) => {
    started.resolve()
    await gate.promise
    return { userId, creator: true, admin: false }
  })
  const relays: string[] = []
  const pending = relayFrameDrag('c', drag(10), session, () => {
    relays.push('f')
  })
  await started.promise
  await relayFrameDrag('c', drag(20, { frameId: 'other' }), session, () => {
    relays.push('other')
  })
  gate.resolve()
  await pending
  expect(relays).toEqual(['other', 'f'])
})
