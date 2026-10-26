// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { Webhooks } from '../src/components/Webhooks'
import { api, errorMessage } from '../src/lib/api'
import { uploadImageFrames, pasteImagesCentered } from '../src/lib/frameClipboard'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('renders six German webhook labels and submits only unchanged selected event keys', async () => {
  let submitted: unknown
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    expect(url).toBe('/api/webhooks')
    if (init?.method === 'POST') {
      submitted = JSON.parse(init.body as string)
      return Response.json({
        id: 'h',
        url: 'https://example.com/hook',
        events: ['comment.created'],
        enabled: true,
        failures: 0,
        createdAt: 1,
        lastAt: null,
        lastStatus: null,
        lastError: null,
        secret: 'secret',
      })
    }
    return Response.json([])
  })
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    await act(async () => root.render(<Webhooks />))
    const labels = [
      'Ein Kommentar wird zu einem Element hinterlassen',
      'Eine Antwort wird zu einem Kommentarverlauf hinzugefügt',
      'Ein Kommentarverlauf wird als erledigt markiert',
      'Eine Zeichenfläche wird erstellt',
      'Ein Agent schließt eine Aufgabenkarte ab',
      'Ein Agent kann eine Aufgabenkarte nicht abschließen',
    ]
    const checks = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
    expect(checks.map((input) => input.getAttribute('aria-label'))).toEqual(labels)
    for (const label of labels) expect(container.textContent).toContain(label)
    for (const check of checks.slice(1)) await act(async () => check.click())
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Webhook-URL"]')!
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'https://example.com/hook')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((button) => button.textContent === 'Webhook hinzufügen')!
        .click(),
    )
    expect(submitted).toEqual({ url: 'https://example.com/hook', events: ['comment.created'] })
  } finally {
    await act(async () => root.unmount())
    container.remove()
  }
})

it.each([
  [
    400,
    { error: 'Nicht unterstützter Dateityp. Erlaubt sind PNG, JPG, WebP, GIF und SVG.' },
    'Nicht unterstützter Dateityp. Erlaubt sind PNG, JPG, WebP, GIF und SVG.',
  ],
  [413, {}, 'Das Bild überschreitet die Grenze von 5 MB.'],
  [502, { message: 'upstream secret' }, 'Das Bild konnte nicht hochgeladen werden. Versuche es erneut.'],
])(
  'preserves safe upload advice through the actual clipboard and display helpers (HTTP %s)',
  async (status, body, want) => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json(body, { status }))
    vi.stubGlobal(
      'Image',
      class {
        onload?: () => void
        set src(_value: string) {
          this.onload?.()
        }
      },
    )
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const file = new File(['test'], 'My English image.png', { type: 'image/png' })
    for (const upload of [
      () => api.uploadAsset('c', file),
      () => uploadImageFrames('c', [file]),
      () => pasteImagesCentered('c', [file]),
    ]) {
      const error = await upload().catch((error: unknown) => error)
      expect(errorMessage(error, 'Deine Anfrage konnte nicht gesendet werden. Versuche es erneut.')).toBe(want)
    }
  },
)

it('hides raw network and foreign errors after a real upload attempt', async () => {
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('provider secret'))
  const error = await api.uploadAsset('c', new Blob(['test'])).catch((error: unknown) => error)
  expect(errorMessage(error, 'Das Einfügen ist fehlgeschlagen. Versuche es erneut.')).toBe(
    'Das Einfügen ist fehlgeschlagen. Versuche es erneut.',
  )
})
