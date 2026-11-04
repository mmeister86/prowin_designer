// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { Frame } from '../shared/types'
import { FrameShareActions } from '../src/prowin/FrameShareActions'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const frame: Frame = {
  id: 'export-frame',
  canvasId: 'canvas',
  name: 'Poster',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  html: '<p>neu</p>',
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'me',
}

let container: HTMLDivElement
let root: Root
let clicked: HTMLAnchorElement[]
type Pending = { resolve: (res: Response) => void; reject: (err: unknown) => void; signal?: AbortSignal | null }
let pending: Pending[]

function stubFetch() {
  pending = []
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
      const entry: Pending = { resolve: () => {}, reject: () => {}, signal: init?.signal ?? null }
      const promise = new Promise<Response>((resolve, reject) => {
        entry.resolve = resolve
        entry.reject = reject
      })
      pending.push(entry)
      init?.signal?.addEventListener('abort', () => entry.reject(init.signal!.reason))
      return promise
    }),
  )
}

function stubShare(supported = true) {
  const share = vi.fn(async () => {})
  vi.stubGlobal('navigator', { share, canShare: vi.fn(() => supported) })
  return share
}

function renderShare(current: Frame = frame) {
  act(() => {
    root.render(<FrameShareActions frame={current} />)
  })
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === label)
  if (!found) throw new Error(`missing button "${label}"`)
  return found as HTMLButtonElement
}

function buttons(): string[] {
  return Array.from(container.querySelectorAll('button')).map((b) => b.textContent ?? '')
}

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
}

async function prepare(label = 'PNG vorbereiten', body = 'png-bytes', headers?: HeadersInit) {
  act(() => {
    button(label).click()
  })
  await flush()
  expect(fetch).toHaveBeenCalledTimes(1)
  const last = pending[pending.length - 1]!
  await act(async () => {
    last.resolve(new Response(body, { headers }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
}

beforeEach(() => {
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
  URL.createObjectURL = vi.fn(() => 'blob:share')
  URL.revokeObjectURL = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('stays hidden without share support and explains the fallback', () => {
  vi.stubGlobal('navigator', {})
  stubFetch()
  renderShare()
  expect(buttons()).toHaveLength(0)
  expect(container.textContent).toContain('Dieser Browser kann keine Dateien teilen')
  expect(fetch).not.toHaveBeenCalled()
})

it('prepares on explicit click, then shares and downloads the same bytes with one fetch', async () => {
  const share = stubShare()
  stubFetch()
  renderShare()
  expect(buttons()).toEqual(expect.arrayContaining(['PNG vorbereiten', 'JPG vorbereiten']))

  act(() => {
    button('PNG vorbereiten').click()
  })
  await flush()
  expect(container.textContent).toContain('PNG wird vorbereitet…')
  expect(fetch).toHaveBeenCalledWith('/i/export-frame.png?download', expect.anything())
  expect(share).not.toHaveBeenCalled()

  await act(async () => {
    pending[0]!.resolve(
      new Response('png-bytes', { headers: { 'Content-Disposition': 'attachment; filename="Poster.png"' } }),
    )
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(container.textContent).toContain('Poster.png')
  expect(buttons()).toEqual(expect.arrayContaining(['Teilen', 'Herunterladen']))

  await act(async () => {
    button('Teilen').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(share).toHaveBeenCalledTimes(1)
  const shared = (share.mock.calls[0] as unknown as [{ files: File[] }])[0].files[0]!
  expect(shared).toBeInstanceOf(File)
  expect(shared.type).toBe('image/png')
  expect(await shared.text()).toBe('png-bytes')

  act(() => {
    button('Herunterladen').click()
  })
  expect(clicked).toHaveLength(1)
  expect(clicked[0]!.download).toBe('Poster.png')
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('prepares JPG with its URL and MIME type', async () => {
  stubShare()
  stubFetch()
  renderShare()
  await prepare('JPG vorbereiten', 'jpg-bytes', { 'Content-Disposition': 'attachment; filename="Poster.jpg"' })
  expect(fetch).toHaveBeenCalledWith('/i/export-frame.jpg?download', expect.anything())
  expect(container.textContent).toContain('Poster.jpg')
})

it('ignores a second prepare click while pending', async () => {
  stubShare()
  stubFetch()
  renderShare()

  act(() => {
    button('PNG vorbereiten').click()
    button('PNG vorbereiten').click()
  })
  await flush()
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('shows the server error and retries on the next explicit click', async () => {
  stubShare()
  stubFetch()
  renderShare()

  act(() => {
    button('JPG vorbereiten').click()
  })
  await flush()
  await act(async () => {
    pending[0]!.resolve(Response.json({ error: 'JPG export rate limit — wait a minute' }, { status: 429 }))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(container.textContent).toContain('JPG export rate limit — wait a minute')
  expect(buttons()).not.toContain('Teilen')

  act(() => {
    button('JPG vorbereiten').click()
  })
  await flush()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('discards a stale preparation when the frame changes', async () => {
  stubShare()
  stubFetch()
  renderShare()

  act(() => {
    button('PNG vorbereiten').click()
  })
  await flush()
  renderShare({ ...frame, updatedAt: 1 })
  await act(async () => {
    pending[0]!.resolve(new Response('old-bytes'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(container.textContent).not.toContain('Teilen')
  expect(container.textContent).not.toMatch(/„.*“ ist bereit/)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('prefers the newest preparation when the frame changes mid-flight', async () => {
  stubShare()
  stubFetch()
  renderShare()

  act(() => {
    button('PNG vorbereiten').click()
  })
  await flush()
  renderShare({ ...frame, updatedAt: 1 })
  act(() => {
    button('JPG vorbereiten').click()
  })
  await flush()
  expect(fetch).toHaveBeenCalledTimes(2)
  await act(async () => {
    pending[0]!.resolve(new Response('png-bytes'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(container.textContent).not.toContain('Teilen')
  await act(async () => {
    pending[1]!.resolve(new Response('jpg-bytes'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(fetch).toHaveBeenCalledWith('/i/export-frame.jpg?download', expect.anything())
  expect(container.textContent).toContain('Poster.jpg')
})

it('keeps the prepared file when sharing is cancelled', async () => {
  vi.stubGlobal('navigator', {
    share: vi.fn(async () => Promise.reject(new DOMException('cancelled', 'AbortError'))),
    canShare: vi.fn(() => true),
  })
  stubFetch()
  renderShare()
  await prepare()
  await act(async () => {
    button('Teilen').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(buttons()).toEqual(expect.arrayContaining(['Teilen', 'Herunterladen']))
  act(() => {
    button('Herunterladen').click()
  })
  expect(clicked).toHaveLength(1)
  expect(fetch).toHaveBeenCalledTimes(1)
})

it('keeps the prepared download when the real file cannot be shared', async () => {
  const share = vi.fn(async () => {})
  vi.stubGlobal('navigator', { share, canShare: vi.fn(({ files }: { files: File[] }) => files[0]!.size <= 10) })
  stubFetch()
  renderShare()
  await prepare('PNG vorbereiten', 'x'.repeat(200))

  await act(async () => {
    button('Teilen').click()
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
  await flush()
  expect(share).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Dieser Browser kann keine Dateien teilen')
  act(() => {
    button('Herunterladen').click()
  })
  expect(clicked).toHaveLength(1)
})

it('sanitizes long path-like names keeping the extension', async () => {
  stubShare()
  stubFetch()
  renderShare({ ...frame, name: `../../${'x'.repeat(200)}.txt` })
  await prepare()
  expect(container.textContent).toMatch(/x+\.png/)
  expect(container.textContent).not.toContain('/')
})

it('unmounts cleanly while preparing', async () => {
  stubShare()
  stubFetch()
  renderShare()
  act(() => {
    button('PNG vorbereiten').click()
  })
  await flush()
  act(() => root.unmount())
  await act(async () => {
    pending[0]!.resolve(new Response('png-bytes'))
    await new Promise((resolve) => setTimeout(resolve, 0))
  })
})
