// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FRAME_BOOTSTRAP } from '../src/lib/frameRuntime'

/* Identity acknowledgement for already-live edits: the parent saves a
   runtime serialization without re-posting it (inline text, Design-panel
   styles), so the runtime must adopt the parent's expected-document token
   for exactly that HTML — and nothing else. Runs the real bootstrap, not a
   string pin: serialize() matching, token adoption and measurement stamping
   all execute. */
function install(): void {
  const src = new DOMParser()
    .parseFromString(FRAME_BOOTSTRAP, 'text/html')
    .querySelector('script[data-v-boot]')!.textContent!
  ;(document as unknown as { fonts: unknown }).fonts = {
    addEventListener: () => {},
    forEach: () => {},
  }
  ;(globalThis as unknown as { parent: unknown }).parent = window
  ;(0, eval)(src)
}

interface Posted {
  type?: string
  html?: string
  docToken?: number
  generation?: number
  status?: string
  reqId?: number
}

const posted: Posted[] = []

function send(data: Record<string, unknown>) {
  window.dispatchEvent(new MessageEvent('message', { data, source: window }))
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const slow = () => new Promise((r) => setTimeout(r, 650))

describe('frame runtime edited identity acknowledgement', () => {
  beforeAll(() => {
    install()
    window.addEventListener('message', (ev: MessageEvent) => {
      if (ev.data && typeof ev.data.type === 'string') posted.push(ev.data as Posted)
    })
  })

  beforeEach(() => {
    posted.length = 0
    document.body.innerHTML = ''
  })

  afterEach(async () => {
    // A failed expect must not leave edit mode stuck on for the next test:
    // doop:html renders nothing while editing.
    send({ type: 'doop:edit', on: false })
    await tick()
  })

  function updates() {
    return posted.filter((p) => p.type === 'doop:frame-updated')
  }

  function edited() {
    return posted.filter((p) => p.type === 'doop:edited').map((p) => String(p.html))
  }

  async function render(html: string, docToken: number) {
    send({ type: 'doop:html', html, docToken })
    await tick()
  }

  async function editMode() {
    send({ type: 'doop:edit', on: true })
    await tick()
  }

  async function stopEdit() {
    send({ type: 'doop:edit', on: false })
    await tick()
  }

  function click(el: Element) {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }))
  }

  const H0 = '<!doctype html><html><head></head><body><p id="t">Hallo</p></body></html>'

  it('blesses the exact live serialization and stamps the measurement with it', async () => {
    await render(H0, 101)
    expect(updates().at(-1)).toMatchObject({ generation: 1, docToken: 101 })
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    expect(edited()).toHaveLength(1)
    const live = edited()[0]!
    expect(live).toContain('Hallo!')
    posted.length = 0
    // The parent saved this exact HTML without re-posting: acknowledge it.
    send({ type: 'doop:edited-ack', html: live, docToken: 102 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 102 })
    send({ type: 'doop:safe-zones', reqId: 7 })
    await tick()
    expect(posted.filter((p) => p.type === 'doop:safe-zones-result').at(-1)).toMatchObject({ docToken: 102 })
    await stopEdit()
  })

  it('ignores a stale acknowledgement for superseded contents', async () => {
    await render(H0, 101)
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const stale = edited().at(-1)!
    // Newer typing supersedes the collected serialization before its ack lands.
    document.querySelector('#t')!.textContent = 'Hallo!!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const current = edited().at(-1)!
    expect(current).not.toBe(stale)
    posted.length = 0
    send({ type: 'doop:edited-ack', html: stale, docToken: 102 })
    await tick()
    // Stale: no blessing, no notification.
    expect(updates()).toHaveLength(0)
    send({ type: 'doop:edited-ack', html: current, docToken: 103 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 103 })
    await stopEdit()
  })

  it('ignores an acknowledgement after a different document rendered', async () => {
    await render(H0, 101)
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const stale = edited().at(-1)!
    // A revert renders a different document before the ack lands.
    const reverted = H0.replace('Hallo</p>', 'Stored</p>')
    send({ type: 'doop:revert', html: reverted, docToken: 104 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 104 })
    posted.length = 0
    send({ type: 'doop:edited-ack', html: stale, docToken: 102 })
    await tick()
    expect(updates()).toHaveLength(0)
    send({ type: 'doop:safe-zones', reqId: 8 })
    await tick()
    expect(posted.filter((p) => p.type === 'doop:safe-zones-result').at(-1)).toMatchObject({ docToken: 104 })
    await stopEdit()
  })

  it('blesses the save echo that canonicalizes to the live document', async () => {
    await render(H0, 101)
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const live = edited()[0]!
    // The server parse-round-trips every save: same DOM, different bytes.
    const echo = live.replace('id="t"', "id='t'")
    expect(echo).not.toBe(live)
    posted.length = 0
    send({ type: 'doop:edited-ack', html: echo, docToken: 107 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 107 })
    // ...but a remote document with different content is still rejected.
    posted.length = 0
    send({ type: 'doop:edited-ack', html: echo.replace('Hallo!', 'Fremd'), docToken: 108 })
    await tick()
    expect(updates()).toHaveLength(0)
    await stopEdit()
  })

  it('blesses a Design-panel style edit through its debounced serialization', async () => {
    await render(H0, 101)
    posted.length = 0
    send({ type: 'doop:style', selector: '#t', styles: { color: 'red' }, reqId: 3 })
    await slow()
    expect(edited()).toHaveLength(1)
    expect(edited()[0]).toContain('color: red')
    send({ type: 'doop:edited-ack', html: edited()[0]!, docToken: 105 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 105 })
  })

  it('adopts the token as metadata only: no remorph, selection survives', async () => {
    await render(H0, 101)
    await editMode()
    const el = document.querySelector('#t')!
    click(el)
    el.textContent = 'Hallo!'
    el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    expect(edited()).toHaveLength(1)
    const liveAck = edited()[0]!
    posted.length = 0
    send({ type: 'doop:edited-ack', html: liveAck, docToken: 106 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 106 })
    const live = document.querySelector('#t')!
    expect(live.textContent).toBe('Hallo!')
    expect(live.getAttribute('contenteditable')).not.toBeNull()
    expect(live.hasAttribute('data-v-active')).toBe(true)
    await stopEdit()
  })

  it('rejects a stale canonically-identical ack after a newer ack (107->102)', async () => {
    await render(H0, 101)
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const live = edited()[0]!
    // The server's normalized echo: same DOM, different bytes, newer token.
    const echo = live.replace('id="t"', "id='t'")
    expect(echo).not.toBe(live)
    posted.length = 0
    send({ type: 'doop:edited-ack', html: echo, docToken: 107 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 107 })
    // A delayed ack for canonically identical bytes with the older token
    // must not replace the newer identity.
    posted.length = 0
    send({ type: 'doop:edited-ack', html: live, docToken: 102 })
    await tick()
    expect(updates()).toHaveLength(0)
    send({ type: 'doop:safe-zones', reqId: 9 })
    await tick()
    expect(posted.filter((p) => p.type === 'doop:safe-zones-result').at(-1)).toMatchObject({ docToken: 107 })
    await stopEdit()
  })

  it('rejects a stale equivalent ack after a newer stamped render', async () => {
    await render(H0, 101)
    // A stamped render of canonically identical bytes with a newer token.
    const echoRender = H0.replace('id="t"', "id='t'")
    expect(echoRender).not.toBe(H0)
    await render(echoRender, 112)
    expect(updates().at(-1)).toMatchObject({ docToken: 112 })
    posted.length = 0
    send({ type: 'doop:edited-ack', html: H0, docToken: 102 })
    await tick()
    expect(updates()).toHaveLength(0)
    send({ type: 'doop:safe-zones', reqId: 10 })
    await tick()
    expect(posted.filter((p) => p.type === 'doop:safe-zones-result').at(-1)).toMatchObject({ docToken: 112 })
  })

  it('rejects a stale equivalent ack after a revert', async () => {
    await render(H0, 101)
    const echoRevert = H0.replace('id="t"', "id='t'")
    send({ type: 'doop:revert', html: echoRevert, docToken: 115 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 115 })
    posted.length = 0
    send({ type: 'doop:edited-ack', html: H0, docToken: 102 })
    await tick()
    expect(updates()).toHaveLength(0)
    send({ type: 'doop:safe-zones', reqId: 11 })
    await tick()
    expect(posted.filter((p) => p.type === 'doop:safe-zones-result').at(-1)).toMatchObject({ docToken: 115 })
  })

  it('accepts a newer canonical echo and a same-token re-ack', async () => {
    await render(H0, 101)
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const live = edited()[0]!
    const echo = live.replace('id="t"', "id='t'")
    expect(echo).not.toBe(live)
    posted.length = 0
    send({ type: 'doop:edited-ack', html: live, docToken: 102 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 102 })
    // Newer equivalent byte form advances the identity; repeating the same
    // token is idempotent and stays accepted.
    send({ type: 'doop:edited-ack', html: echo, docToken: 107 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 107 })
    send({ type: 'doop:edited-ack', html: echo, docToken: 107 })
    await tick()
    expect(updates().at(-1)).toMatchObject({ docToken: 107 })
    expect(updates()).toHaveLength(3)
    await stopEdit()
  })

  it('rejects a malformed-token ack even for matching content', async () => {
    await render(H0, 101)
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'Hallo!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await slow()
    const live = edited()[0]!
    posted.length = 0
    send({ type: 'doop:edited-ack', html: live, docToken: NaN })
    await tick()
    send({ type: 'doop:edited-ack', html: live })
    await tick()
    send({ type: 'doop:edited-ack', html: live, docToken: '102' })
    await tick()
    expect(updates()).toHaveLength(0)
    await stopEdit()
  })
})
