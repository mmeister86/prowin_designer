// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { FRAME_BOOTSTRAP } from '../src/lib/frameRuntime'

/* Runs the real `doop:template` branch of the frame runtime's message
   handler: the bootstrap script is eval'd in the test document (indirect
   eval, so its top-level runs in global scope) with `parent` pointed at the
   test window. `document.fonts` does not exist in happy-dom and is stubbed —
   the handler itself never touches it. */
function installRuntime(): { replies: Array<{ reqId?: string; ok?: boolean }> } {
  const src = new DOMParser()
    .parseFromString(FRAME_BOOTSTRAP, 'text/html')
    .querySelector('script[data-v-boot]')!.textContent!
  ;(document as unknown as { fonts: unknown }).fonts = { addEventListener: () => {} }
  ;(globalThis as unknown as { parent: unknown }).parent = window
  const replies: Array<{ reqId?: string; ok?: boolean }> = []
  window.addEventListener('message', (ev: MessageEvent) => {
    if (ev.data?.type === 'doop:template-result') replies.push(ev.data)
  })
  ;(0, eval)(src)
  return { replies }
}

const FIELD = {
  id: 'titel',
  role: 'headline',
  label: 'Titel',
  locked: true,
  maxLength: 60,
  allowedColors: ['prowin-ci-blau'],
}

function send(selector: string, field: typeof FIELD | null, reqId: string) {
  window.dispatchEvent(
    new MessageEvent('message', { data: { type: 'doop:template', selector, field, reqId }, source: window }),
  )
}

describe('frame runtime doop:template handler', () => {
  it('sets all six attributes on the live element and removes them when field is null', async () => {
    const { replies } = installRuntime()
    document.body.innerHTML = '<section id="target"><p>Hi</p></section>'
    send('#target', FIELD, 'set')
    await new Promise((r) => setTimeout(r, 0))
    const el = document.querySelector('#target')!
    expect(el.getAttribute('data-od-id')).toBe('titel')
    expect(el.getAttribute('data-od-role')).toBe('headline')
    expect(el.getAttribute('data-od-label')).toBe('Titel')
    expect(el.getAttribute('data-od-locked')).toBe('true')
    expect(el.getAttribute('data-od-max-length')).toBe('60')
    expect(el.getAttribute('data-od-allowed-colors')).toBe('prowin-ci-blau')
    expect(replies).toContainEqual({ type: 'doop:template-result', reqId: 'set', ok: true })

    send('#target', null, 'clear')
    await new Promise((r) => setTimeout(r, 0))
    for (const attr of [
      'data-od-id',
      'data-od-role',
      'data-od-label',
      'data-od-locked',
      'data-od-max-length',
      'data-od-allowed-colors',
    ]) {
      expect(el.hasAttribute(attr)).toBe(false)
    }
    expect(el.querySelector('p')!.textContent).toBe('Hi')
    expect(replies).toContainEqual({ type: 'doop:template-result', reqId: 'clear', ok: true })
  })
})
