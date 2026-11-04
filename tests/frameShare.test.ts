// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { canShareFrameFile, shareFrameFile } from '../src/prowin/frameShare'

const file = () => new File(['img-bytes'], 'Poster.png', { type: 'image/png' })
let clicked: HTMLAnchorElement[]

beforeEach(() => {
  clicked = []
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    clicked.push(this)
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('reports no share support when navigator.share is missing', () => {
  vi.stubGlobal('navigator', {})
  expect(canShareFrameFile(file())).toBe(false)
})

it('reports no share support when canShare throws', () => {
  vi.stubGlobal('navigator', {
    share: vi.fn(),
    canShare: vi.fn(() => {
      throw new Error('boom')
    }),
  })
  expect(canShareFrameFile(file())).toBe(false)
})

it('reports no share support when canShare rejects the real file', () => {
  const canShare = vi.fn(() => false)
  vi.stubGlobal('navigator', { share: vi.fn(), canShare })
  expect(canShareFrameFile(file())).toBe(false)
  expect(canShare).toHaveBeenCalledWith({ files: [expect.any(File)] })
})

it('reports share support when canShare accepts the real file', () => {
  vi.stubGlobal('navigator', { share: vi.fn(), canShare: vi.fn(() => true) })
  expect(canShareFrameFile(file())).toBe(true)
})

it('shares without canShare when only share exists', () => {
  vi.stubGlobal('navigator', { share: vi.fn() })
  expect(canShareFrameFile(file())).toBe(true)
})

it('calls share synchronously in the click and resolves neutrally', async () => {
  const share = vi.fn(async () => {})
  vi.stubGlobal('navigator', { share })
  const current = file()

  const pending = shareFrameFile(current)
  expect(share).toHaveBeenCalledTimes(1)
  expect(share).toHaveBeenCalledWith({ files: [current] })
  await expect(pending).resolves.toBeNull()
  expect(clicked).toHaveLength(0)
})

it('treats a resolved share as neutral, never as delivered', async () => {
  vi.stubGlobal('navigator', { share: vi.fn(async () => {}) })
  await expect(shareFrameFile(file())).resolves.toBeNull()
})

it('treats an AbortError rejection as neutral', async () => {
  vi.stubGlobal('navigator', { share: vi.fn(async () => Promise.reject(new DOMException('cancelled', 'AbortError'))) })
  await expect(shareFrameFile(file())).resolves.toBeNull()
  expect(clicked).toHaveLength(0)
})

it('treats a synchronous AbortError throw as neutral', async () => {
  vi.stubGlobal('navigator', {
    share: vi.fn(() => {
      throw new DOMException('cancelled', 'AbortError')
    }),
  })
  await expect(shareFrameFile(file())).resolves.toBeNull()
})

it('explains a blocked share in German', async () => {
  vi.stubGlobal('navigator', {
    share: vi.fn(async () => Promise.reject(new DOMException('denied', 'NotAllowedError'))),
  })
  await expect(shareFrameFile(file())).resolves.toBe('Das Teilen wurde blockiert. Versuche es erneut.')
  expect(clicked).toHaveLength(0)
})

it('explains a failed share in German', async () => {
  vi.stubGlobal('navigator', { share: vi.fn(async () => Promise.reject(new Error('no targets'))) })
  await expect(shareFrameFile(file())).resolves.toBe('Das Teilen hat nicht funktioniert. Versuche es erneut.')
})

it('explains a missing share API in German without downloading', async () => {
  vi.stubGlobal('navigator', {})
  await expect(shareFrameFile(file())).resolves.toBe('Dieser Browser kann keine Dateien teilen')
  expect(clicked).toHaveLength(0)
})
