// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
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

describe('frame runtime template policy (doop:policy)', () => {
  const seen: Array<Record<string, unknown>> = []
  function install(): void {
    const src = new DOMParser()
      .parseFromString(FRAME_BOOTSTRAP, 'text/html')
      .querySelector('script[data-v-boot]')!.textContent!
    ;(document as unknown as { fonts: unknown }).fonts = { addEventListener: () => {}, forEach: () => {} }
    ;(globalThis as unknown as { parent: unknown }).parent = window
    window.addEventListener('message', (ev: MessageEvent) => {
      if (typeof ev.data?.type === 'string' && ev.data.type.endsWith('-result')) seen.push(ev.data)
      if (ev.data?.type === 'doop:active') seen.push(ev.data)
    })
    ;(0, eval)(src)
  }
  function send(data: Record<string, unknown>) {
    window.dispatchEvent(new MessageEvent('message', { data, source: window }))
  }
  const tick = () => new Promise((r) => setTimeout(r, 0))
  const results = (reqId: string) => seen.filter((m) => m.reqId === reqId)

  beforeAll(install)
  beforeEach(() => {
    document.body.innerHTML =
      '<section data-od-id="hero" data-od-locked="true"><p id="s">Hi</p></section>' +
      '<section data-od-id="free"><p id="fld">A</p></section><p id="frz">B</p>'
    seen.length = 0
  })

  it('fail-closes: locked and frozen elements take no style/select until the parent sends capabilities', async () => {
    send({ type: 'doop:style', selector: '#s', styles: { color: 'red' }, reqId: 'locked-style' })
    send({ type: 'doop:select', selector: '#s', reqId: 'locked-select' })
    send({ type: 'doop:style', selector: '#frz', styles: { color: 'red' }, reqId: 'frozen-style' })
    send({ type: 'doop:style', selector: '#fld', styles: { color: 'red' }, reqId: 'field-style' })
    await tick()
    expect(results('locked-style').length).toBeGreaterThan(0)
    expect(results('locked-style').every((m) => m.ok === false)).toBe(true)
    expect(results('locked-select').every((m) => m.hit == null)).toBe(true)
    expect(results('frozen-style').every((m) => m.ok === false)).toBe(true)
    expect(results('field-style').some((m) => m.ok === true)).toBe(true)
  })

  it('opens locked elements for creators once capabilities arrive', async () => {
    seen.length = 0
    send({ type: 'doop:policy', manageLocks: true, reqId: 'policy-on' })
    await tick()
    send({ type: 'doop:style', selector: '#s', styles: { color: 'red' }, reqId: 'creator-style' })
    send({ type: 'doop:select', selector: '#s', reqId: 'creator-select' })
    await tick()
    expect(results('creator-style').some((m) => m.ok === true)).toBe(true)
    expect(results('creator-select').some((m) => m.hit != null)).toBe(true)
    send({ type: 'doop:policy', manageLocks: false, reqId: 'policy-off' })
    await tick()
  })

  it('ends an active edit on a locked element when capabilities are revoked', async () => {
    document.body.innerHTML = '<section data-od-id="hero" data-od-locked="true"><p id="t">Hi</p></section>'
    seen.length = 0
    send({ type: 'doop:policy', manageLocks: true, reqId: 'edit-creator' })
    await tick()
    send({ type: 'doop:edit', on: true })
    await tick()
    document
      .querySelector('#t')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }))
    await tick()
    const active = seen.filter((m) => m.type === 'doop:active')
    expect(active.length).toBeGreaterThan(0)
    expect(active.some((m) => (m.hit as { selector?: string } | null)?.selector === '#t')).toBe(true)
    expect(document.querySelector('#t')!.hasAttribute('data-v-active')).toBe(true)
    send({ type: 'doop:policy', manageLocks: false, reqId: 'edit-revoked' })
    await tick()
    const after = seen.filter((m) => m.type === 'doop:active')
    expect(after.at(-1)?.hit).toBeNull()
    expect(document.querySelector('#t')!.hasAttribute('data-v-active')).toBe(false)
    send({ type: 'doop:edit', on: false })
    await tick()
  })

  /* Breaks caught here: inspect() not reporting the live template policy,
     so the parent panel cannot tell a script-generated element (editable in
     plain frames, read-only in frozen areas, blocked under a script-added
     lock) from a stale selector. Hand-derived literals, not policy helpers. */
  it('reports the live template policy on inspect and null for stale selectors', async () => {
    seen.length = 0
    send({ type: 'doop:inspect', selector: '#s', reqId: 'inspect-locked' })
    send({ type: 'doop:inspect', selector: '#fld', reqId: 'inspect-field' })
    send({ type: 'doop:inspect', selector: '#frz', reqId: 'inspect-frozen' })
    send({ type: 'doop:inspect', selector: '#nope', reqId: 'inspect-stale' })
    await tick()
    const policyOf = (reqId: string) => (results(reqId)[0]?.info as { policy?: unknown } | null)?.policy ?? null
    expect(policyOf('inspect-locked')).toEqual({
      template: true,
      locked: true,
      readOnly: true,
      allowedColors: null,
    })
    expect(policyOf('inspect-field')).toEqual({
      template: true,
      locked: false,
      readOnly: false,
      allowedColors: null,
    })
    expect(policyOf('inspect-frozen')).toEqual({
      template: true,
      locked: false,
      readOnly: true,
      allowedColors: null,
    })
    expect(results('inspect-stale')[0]?.info ?? null).toBeNull()
  })

  it('intersects nested color bounds from the live document', async () => {
    document.body.innerHTML =
      '<section data-od-id="a" data-od-allowed-colors="prowin-ci-blau, prowin-ci-rot">' +
      '<p id="inner" data-od-id="b" data-od-allowed-colors="prowin-ci-rot,prowin-ci-gruen">x</p></section>'
    seen.length = 0
    send({ type: 'doop:inspect', selector: '#inner', reqId: 'inspect-colors' })
    await tick()
    const colors = results('inspect-colors')[0]?.info as { policy?: { allowedColors?: unknown } } | undefined
    expect(colors?.policy?.allowedColors).toEqual(['prowin-ci-rot'])
  })
})

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
