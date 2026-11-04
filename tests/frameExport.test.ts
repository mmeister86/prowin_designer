// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { Frame } from '../shared/types'
import { copyFramePng, downloadFrameExport, prepareFrameExport, saveBlob } from '../src/lib/frameExport'
import { useStore } from '../src/lib/store'

const frame: Frame = {
  id: 'export-frame',
  canvasId: 'canvas',
  name: 'Poster',
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  html: '',
  createdAt: 0,
  updatedAt: 0,
  updatedBy: 'me',
}
let clicked: HTMLAnchorElement[]

beforeEach(() => {
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
  URL.createObjectURL = vi.fn(() => 'blob:export')
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  delete (globalThis as { __DOOP_DESKTOP__?: string }).__DOOP_DESKTOP__
  useStore.setState({ notice: null })
})

it('shows a busy toast while rendering, then saves through a download link named by the server', async () => {
  let respond!: (res: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))),
  )

  const done = downloadFrameExport(frame, 'jpg')
  expect(fetch).toHaveBeenCalledWith('/i/export-frame.jpg?download', expect.anything())
  expect(useStore.getState().notice).toMatchObject({ text: 'JPG wird exportiert…', busy: true })

  respond(new Response('jpg-bytes', { headers: { 'Content-Disposition': 'attachment; filename="Poster.jpg"' } }))
  await done

  expect(clicked).toHaveLength(1)
  expect(clicked[0]!.download).toBe('Poster.jpg')
  expect(clicked[0]!.href).toBe('blob:export')
  expect(useStore.getState().notice).toMatchObject({ text: '„Poster.jpg“ ist bereit', busy: false })
})

it('reports the server error instead of saving a failed render', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'JPG export rate limit — wait a minute' }, { status: 429 })),
  )

  await downloadFrameExport(frame, 'jpg')

  expect(clicked).toHaveLength(0)
  expect(useStore.getState().notice?.text).toBe('JPG export rate limit — wait a minute')
})

it('requests PNG and JPG as downloads without a forced scale', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('img')),
  )
  await downloadFrameExport(frame, 'png')
  await downloadFrameExport(frame, 'jpg')
  expect(vi.mocked(fetch).mock.calls.map(([url]) => url)).toEqual([
    '/i/export-frame.png?download',
    '/i/export-frame.jpg?download',
  ])
  expect(clicked.map((a) => a.download)).toEqual(['Poster.png', 'Poster.jpg'])
})

it('keeps the spinner up while another export is still rendering', async () => {
  const pending: ((res: Response) => void)[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))),
  )

  const png = downloadFrameExport(frame, 'png')
  const jpg = downloadFrameExport(frame, 'jpg')
  pending[0]!(new Response('img', { headers: { 'Content-Disposition': 'attachment; filename="Poster.png"' } }))
  await png
  expect(useStore.getState().notice).toMatchObject({
    text: '„Poster.png“ ist bereit · Noch 1 Export in Arbeit…',
    busy: true,
  })

  pending[1]!(new Response('jpg', { headers: { 'Content-Disposition': 'attachment; filename="Poster.jpg"' } }))
  await jpg
  expect(useStore.getState().notice).toMatchObject({ text: '„Poster.jpg“ ist bereit', busy: false })
})

it('in the desktop shell leaves the outcome to the save panel, which may be cancelled', async () => {
  ;(globalThis as { __DOOP_DESKTOP__?: string }).__DOOP_DESKTOP__ = '0.4.0'
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('img')),
  )

  await downloadFrameExport(frame, 'png')

  expect(clicked).toHaveLength(1)
  expect(useStore.getState().notice).toBeNull()
})

/* A clipboard that resolves each item's pending data the way browsers do. */
function stubClipboard() {
  const written: Blob[] = []
  vi.stubGlobal(
    'ClipboardItem',
    class {
      constructor(readonly items: Record<string, Promise<Blob>>) {}
    },
  )
  const write = vi.fn(async (items: { items: Record<string, Promise<Blob>> }[]) => {
    written.push(await items[0]!.items['image/png']!)
  })
  vi.stubGlobal('navigator', { clipboard: { write } })
  return { written, write }
}

it('copies the PNG, handing the clipboard the pending render so the click still counts', async () => {
  let respond!: (res: Response) => void
  vi.stubGlobal(
    'fetch',
    vi.fn(() => new Promise<Response>((resolve) => (respond = resolve))),
  )
  const { written, write } = stubClipboard()

  const done = copyFramePng(frame)
  expect(fetch).toHaveBeenCalledWith('/i/export-frame.png?download', expect.anything())
  expect(write).toHaveBeenCalledTimes(1)
  expect(useStore.getState().notice).toMatchObject({ text: 'PNG wird kopiert…', busy: true })

  respond(new Response('png-bytes'))
  await done

  expect(await written[0]!.text()).toBe('png-bytes')
  expect(clicked).toHaveLength(0)
  expect(useStore.getState().notice).toMatchObject({ text: 'PNG kopiert', busy: false })
})

it('reports the server error when the PNG to copy fails to render', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { error: 'Zu viele Vorschauanfragen. Bereits zwischengespeicherte URLs bleiben verfügbar.' },
        { status: 429 },
      ),
    ),
  )
  const { written } = stubClipboard()

  await copyFramePng(frame)

  expect(written).toHaveLength(0)
  expect(useStore.getState().notice?.text).toBe(
    'Zu viele Vorschauanfragen. Bereits zwischengespeicherte URLs bleiben verfügbar.',
  )
})

it('surfaces the controlled font error with no download and no busy leak', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { error: 'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.' },
        { status: 500 },
      ),
    ),
  )

  await downloadFrameExport(frame, 'png')

  expect(clicked).toHaveLength(0)
  expect(useStore.getState().notice).toMatchObject({
    text: 'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.',
    busy: false,
  })
})

it('reports the controlled font error when the PNG to copy fails on unsettled fonts', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { error: 'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.' },
        { status: 500 },
      ),
    ),
  )
  const { written } = stubClipboard()

  await copyFramePng(frame)

  expect(written).toHaveLength(0)
  expect(useStore.getState().notice?.text).toBe(
    'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.',
  )
})

it('says so without rendering when the browser has no async clipboard', async () => {
  vi.stubGlobal('fetch', vi.fn())
  vi.stubGlobal('navigator', {})

  await copyFramePng(frame)

  expect(fetch).not.toHaveBeenCalled()
  expect(useStore.getState().notice?.text).toBe('Dieser Browser kann keine Bilder kopieren')
})

it('leaves no unhandled rejection when the clipboard refuses before reading the render', async () => {
  const unhandled = vi.fn()
  process.on('unhandledRejection', unhandled)
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'Die Vorschau konnte nicht erstellt werden.' }, { status: 500 })),
  )
  stubClipboard().write.mockRejectedValue(new DOMException('denied', 'NotAllowedError'))

  await copyFramePng(frame)
  await new Promise((resolve) => setTimeout(resolve, 0))

  process.off('unhandledRejection', unhandled)
  expect(unhandled).not.toHaveBeenCalled()
  expect(useStore.getState().notice?.text).toBe('Das PNG konnte nicht kopiert werden')
})

it('prepares a PNG file with exact URL, MIME, server name and bytes and no download click', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('png-bytes', { headers: { 'Content-Disposition': 'attachment; filename="Poster.png"' } }),
    ),
  )

  const file = await prepareFrameExport(frame, 'png')

  expect(fetch).toHaveBeenCalledWith('/i/export-frame.png?download', expect.anything())
  expect(file).toBeInstanceOf(File)
  expect(file.name).toBe('Poster.png')
  expect(file.type).toBe('image/png')
  expect(await file.text()).toBe('png-bytes')
  expect(clicked).toHaveLength(0)
})

it('prepares a JPG file falling back to the frame name', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('jpg-bytes')),
  )

  const file = await prepareFrameExport(frame, 'jpg')

  expect(fetch).toHaveBeenCalledWith('/i/export-frame.jpg?download', expect.anything())
  expect(file.name).toBe('Poster.jpg')
  expect(file.type).toBe('image/jpeg')
  expect(await file.text()).toBe('jpg-bytes')
  expect(clicked).toHaveLength(0)
})

it('throws the server font and rate-limit errors when preparing', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () =>
      Response.json(
        { error: 'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.' },
        { status: 500 },
      ),
    ),
  )
  await expect(prepareFrameExport(frame, 'png')).rejects.toThrow(
    'Die Schriftarten konnten nicht vollständig geladen werden. Der Export wurde abgebrochen.',
  )

  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json({ error: 'JPG export rate limit — wait a minute' }, { status: 429 })),
  )
  await expect(prepareFrameExport(frame, 'jpg')).rejects.toThrow('JPG export rate limit — wait a minute')
  expect(clicked).toHaveLength(0)
})

it('throws a controlled message when preparing fails without a server error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('oops', { status: 500 })),
  )
  await expect(prepareFrameExport(frame, 'png')).rejects.toThrow('Das PNG konnte nicht exportiert werden')
})

it('throws the controlled timeout message after 120 seconds without rendering', async () => {
  vi.useFakeTimers()
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
          }),
      ),
    )
    const pending = prepareFrameExport(frame, 'png')
    const assertion = expect(pending).rejects.toThrow('Der PNG-Export hat zu lange gedauert. Versuche es erneut.')
    await vi.advanceTimersByTimeAsync(120_000)
    await assertion
  } finally {
    vi.useRealTimers()
  }
})

it('lets caller cancellation stay distinguishable from export errors', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
        }),
    ),
  )
  const controller = new AbortController()
  const pending = prepareFrameExport(frame, 'png', controller.signal)
  controller.abort()
  const error = await pending.catch((err: unknown) => err)
  expect(error).toBeInstanceOf(DOMException)
  expect((error as DOMException).name).toBe('AbortError')
  expect(fetch).toHaveBeenCalledWith('/i/export-frame.png?download', expect.anything())
})

it('does not fetch when the caller signal is already aborted', async () => {
  vi.stubGlobal('fetch', vi.fn())
  const controller = new AbortController()
  controller.abort()
  const error = await prepareFrameExport(frame, 'png', controller.signal).catch((err: unknown) => err)
  expect(error).toBeInstanceOf(DOMException)
  expect(fetch).not.toHaveBeenCalled()
})

it('sanitizes long path-like names keeping the extension', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('img')),
  )
  const file = await prepareFrameExport({ ...frame, name: `../../${'x'.repeat(200)}.txt` }, 'png')
  expect(file.name).not.toContain('/')
  expect(file.name).not.toContain('\\')
  expect(file.name.endsWith('.png')).toBe(true)
  expect(file.name.length).toBeLessThanOrEqual(84)
})

it('saves a prepared blob through a download link without fetching', async () => {
  vi.stubGlobal('fetch', vi.fn())
  saveBlob(new File(['ready-bytes'], 'Poster.png', { type: 'image/png' }), 'Poster.png')
  expect(fetch).not.toHaveBeenCalled()
  expect(clicked).toHaveLength(1)
  expect(clicked[0]!.download).toBe('Poster.png')
  expect(clicked[0]!.href).toBe('blob:export')
})

it('preserves the original server filename for downloads while preparing a safe name', async () => {
  const serverName = `exports/${'n'.repeat(100)}.jpeg`
  vi.stubGlobal(
    'fetch',
    vi.fn(
      async () =>
        new Response('jpg-bytes', { headers: { 'Content-Disposition': `attachment; filename="${serverName}"` } }),
    ),
  )

  const file = await prepareFrameExport(frame, 'jpg')
  expect(file.name).not.toContain('/')
  expect(file.name.endsWith('.jpg')).toBe(true)
  expect(file.name.length).toBeLessThanOrEqual(84)
  expect(clicked).toHaveLength(0)

  await downloadFrameExport(frame, 'jpg')

  expect(clicked).toHaveLength(1)
  expect(clicked[0]!.download).toBe(serverName)
  expect(useStore.getState().notice).toMatchObject({ text: `„${serverName}“ ist bereit`, busy: false })
})

it('reports caller cancellation while the body is still reading', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
      const res = new Response('body-bytes')
      vi.spyOn(res, 'blob').mockImplementation(
        () =>
          new Promise<Blob>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
          }),
      )
      return Promise.resolve(res)
    }),
  )
  const controller = new AbortController()
  const pending = prepareFrameExport(frame, 'png', controller.signal)
  await new Promise((resolve) => setTimeout(resolve, 0))
  controller.abort()
  const error = await pending.catch((err: unknown) => err)
  expect(error).toBeInstanceOf(DOMException)
  expect((error as DOMException).name).toBe('AbortError')
  expect(clicked).toHaveLength(0)
})

it('reports the timeout when the body stalls past 120 seconds', async () => {
  vi.useFakeTimers()
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        const res = new Response('body-bytes')
        vi.spyOn(res, 'blob').mockImplementation(
          () =>
            new Promise<Blob>((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
            }),
        )
        return Promise.resolve(res)
      }),
    )
    const pending = prepareFrameExport(frame, 'png')
    const assertion = expect(pending).rejects.toThrow('Der PNG-Export hat zu lange gedauert. Versuche es erneut.')
    await vi.advanceTimersByTimeAsync(120_000)
    await assertion
  } finally {
    vi.useRealTimers()
  }
})

it('reports the timeout when the error body stalls past 120 seconds', async () => {
  vi.useFakeTimers()
  try {
    vi.stubGlobal(
      'fetch',
      vi.fn((_url: string, init?: { signal?: AbortSignal }) => {
        const failed = {
          ok: false,
          headers: new Headers(),
          json: () =>
            new Promise((_resolve, reject) => {
              init?.signal?.addEventListener('abort', () => reject(init.signal!.reason))
            }),
        } as unknown as Response
        return Promise.resolve(failed)
      }),
    )
    const pending = prepareFrameExport(frame, 'png')
    const assertion = expect(pending).rejects.toThrow('Der PNG-Export hat zu lange gedauert. Versuche es erneut.')
    await vi.advanceTimersByTimeAsync(120_000)
    await assertion
  } finally {
    vi.useRealTimers()
  }
})

it('treats an aborted error-body read as caller cancellation', async () => {
  let rejectJson!: (err: unknown) => void
  const failed = {
    ok: false,
    headers: new Headers(),
    json: () => new Promise((_resolve, reject) => (rejectJson = reject)),
  } as unknown as Response
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => failed),
  )
  const controller = new AbortController()
  const pending = prepareFrameExport(frame, 'png', controller.signal)
  await Promise.resolve()
  controller.abort()
  rejectJson(controller.signal.reason)
  const error = await pending.catch((err: unknown) => err)
  expect(error).toBeInstanceOf(DOMException)
  expect((error as DOMException).name).toBe('AbortError')
})
