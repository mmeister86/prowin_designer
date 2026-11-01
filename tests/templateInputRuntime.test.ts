// @vitest-environment happy-dom
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { FRAME_BOOTSTRAP } from '../src/lib/frameRuntime'

/* Runs the real text-guard branches of the frame runtime: the bootstrap
   script is eval'd in the test document (indirect eval, global scope) with
   `parent` pointed at the test window. Breaks caught here: code-unit
   instead of codepoint counting (emoji); per-element instead of whole-field
   counting (siblings ignored); selection replacement wrongly rejected;
   paste/composition bypassing the guard; nested locked content clobbered;
   legacy over-limit text trimmed or ungrowable-but-unfixable; rejected
   live content not revertable. Hand-derived literals. */
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

const notices: string[] = []

function send(data: Record<string, unknown>) {
  window.dispatchEvent(new MessageEvent('message', { data, source: window }))
}

function beforeInput(
  target: Element,
  opts: { inputType?: string; data?: string | null; pasteText?: string; targetText?: string },
): boolean {
  const ev = new Event('beforeinput', { bubbles: true, cancelable: true }) as Event & {
    inputType?: string
    data?: string | null
    dataTransfer?: { getData: (type: string) => string } | null
    getTargetRanges?: () => Array<{ startContainer: Node; endContainer: Node; toString: () => string }>
  }
  ev.inputType = opts.inputType ?? 'insertText'
  ev.data = opts.data ?? null
  ev.dataTransfer = opts.pasteText !== undefined ? { getData: () => opts.pasteText! } : null
  if (opts.targetText !== undefined) {
    const text = target.firstChild!
    ev.getTargetRanges = () => [{ startContainer: text, endContainer: text, toString: () => opts.targetText! }]
  }
  target.dispatchEvent(ev)
  return ev.defaultPrevented
}

function selectText(node: Node, start: number, end: number) {
  const sel = window.getSelection()
  sel?.removeAllRanges()
  const range = document.createRange()
  range.setStart(node, start)
  range.setEnd(node, end)
  sel?.addRange(range)
}

const tick = () => new Promise((r) => setTimeout(r, 0))

describe('frame runtime template text guard', () => {
  beforeAll(() => {
    install()
    window.addEventListener('message', (ev: MessageEvent) => {
      if (ev.data?.type === 'doop:edit-notice' && typeof ev.data.text === 'string') notices.push(ev.data.text)
    })
  })

  beforeEach(() => {
    notices.length = 0
    document.body.innerHTML = ''
  })

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

  it('counts codepoints: A😀B fits a limit of 3, A😀BC does not', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="3"><span id="t">A😀B</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    expect(beforeInput(document.querySelector('#t')!, { data: 'C' })).toBe(true)
    await tick()
    expect(notices.some((n) => n.includes('3 Zeichen'))).toBe(true)
    document.querySelector('#t')!.textContent = 'A😀'
    expect(beforeInput(document.querySelector('#t')!, { data: 'B' })).toBe(false)
    await stopEdit()
  })

  it('lets a selection replacement fit inside the limit', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="3"><span id="t">ABC</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    selectText(document.querySelector('#t')!.firstChild!, 1, 2)
    expect(beforeInput(document.querySelector('#t')!, { data: 'X' })).toBe(false)
    await stopEdit()
  })

  it('counts the whole ancestor field including siblings', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="3"><span id="a">AB</span><span id="b">C</span></section>'
    await editMode()
    click(document.querySelector('#b')!)
    /* locally "C"+"D" would fit — the field "ABCD" does not */
    expect(beforeInput(document.querySelector('#b')!, { data: 'D' })).toBe(true)
    await stopEdit()
  })

  it('guards paste and composition inserts', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="3"><span id="t">AB</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    expect(beforeInput(document.querySelector('#t')!, { inputType: 'insertFromPaste', pasteText: 'CD' })).toBe(true)
    expect(beforeInput(document.querySelector('#t')!, { inputType: 'insertCompositionText', data: 'DE' })).toBe(true)
    expect(beforeInput(document.querySelector('#t')!, { inputType: 'insertFromPaste', pasteText: 'C' })).toBe(false)
    await tick()
    expect(notices.some((n) => n.includes('3 Zeichen'))).toBe(true)
    await stopEdit()
  })

  it('keeps nested locked content out of reach and unchanged', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="10"><span id="t">Hi <span id="lk" data-od-id="lk" data-od-locked="true">fix</span></span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    expect(document.querySelector('#lk')!.getAttribute('contenteditable')).toBe('false')
    expect(beforeInput(document.querySelector('#lk')!, { data: 'X' })).toBe(true)
    expect(document.querySelector('#lk')!.textContent).toBe('fix')
    expect(beforeInput(document.querySelector('#t')!, { data: '!' })).toBe(false)
    await stopEdit()
    expect(document.querySelector('#lk')!.hasAttribute('contenteditable')).toBe(false)
    expect(document.querySelector('#lk')!.textContent).toBe('fix')
  })

  it('never trims legacy over-limit text but rejects growth and allows a fitting replacement', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="1"><span id="t">viel zu lang</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    await tick()
    expect(document.querySelector('#t')!.textContent).toBe('viel zu lang')
    expect(beforeInput(document.querySelector('#t')!, { data: '!' })).toBe(true)
    const text = document.querySelector('#t')!.firstChild!
    selectText(text, 0, text.textContent!.length)
    expect(beforeInput(document.querySelector('#t')!, { data: 'x' })).toBe(false)
    await stopEdit()
  })

  it('restores the last valid text when an over-limit input slips through', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="3"><span id="t">ABC</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'ABCD'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await tick()
    expect(document.querySelector('#t')!.textContent).toBe('ABC')
    expect(notices.some((n) => n.includes('3 Zeichen'))).toBe(true)
    await stopEdit()
  })

  it('reverts the live document on doop:revert, ending an active edit', async () => {
    document.body.innerHTML = '<section><p id="t">alt</p></section>'
    send({
      type: 'doop:revert',
      html: '<!doctype html><html><head></head><body><section><p id="t">neu</p></section></body></html>',
    })
    await tick()
    expect(document.querySelector('#t')!.textContent).toBe('neu')

    /* a rejected save mid-typing restores the stored state even though the
       edit is still open: no invalid state survives, in the store or live */
    document.body.innerHTML = '<section data-od-id="f" data-od-role="body"><span id="t">live</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.textContent = 'live plus invalid'
    send({
      type: 'doop:revert',
      html: '<!doctype html><html><head></head><body><section data-od-id="f" data-od-role="body"><span id="t">stored</span></section></body></html>',
    })
    await tick()
    expect(document.querySelector('#t')!.textContent).toBe('stored')
    expect(document.querySelector('#t')!.hasAttribute('contenteditable')).toBe(false)
    expect(document.querySelector('[data-v-active]')).toBeNull()
    await stopEdit()
  })

  it('does not reserialize rejected content after a revert', async () => {
    const edited: unknown[] = []
    const collect = (ev: MessageEvent) => {
      if (ev.data?.type === 'doop:edited') edited.push(ev.data.html)
    }
    window.addEventListener('message', collect)
    try {
      document.body.innerHTML = '<section data-od-id="f" data-od-role="body"><span id="t">live</span></section>'
      await editMode()
      click(document.querySelector('#t')!)
      /* a valid keystroke starts the save debounce … */
      document.querySelector('#t')!.textContent = 'live!'
      document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
      /* … then the rejection wins the race and must cancel the pending save */
      send({
        type: 'doop:revert',
        html: '<!doctype html><html><head></head><body><section data-od-id="f" data-od-role="body"><span id="t">stored</span></section></body></html>',
      })
      await new Promise((r) => setTimeout(r, 600))
      expect(edited).toEqual([])
      expect(document.querySelector('#t')!.textContent).toBe('stored')
    } finally {
      window.removeEventListener('message', collect)
    }
    await stopEdit()
  })

  it('serializes no runtime fence attributes after typing beside a locked descendant', async () => {
    const edited: string[] = []
    const collect = (ev: MessageEvent) => {
      if (ev.data?.type === 'doop:edited' && typeof ev.data.html === 'string') edited.push(ev.data.html)
    }
    window.addEventListener('message', collect)
    try {
      /* the locked descendant survives activation fenced; the debounced
         save must carry author markup only, or the server refuses a
         runtime-only attribute change on frozen content */
      document.body.innerHTML =
        '<section data-od-id="f" data-od-role="body" data-od-max-length="50"><span id="t">Hi <span id="lk" data-od-id="lk" data-od-locked="true">fix</span></span></section>'
      await editMode()
      click(document.querySelector('#t')!)
      document.querySelector('#t')!.firstChild!.textContent = 'Hi!'
      document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
      await new Promise((r) => setTimeout(r, 600))
      expect(edited.length).toBe(1)
      expect(edited[0]).not.toContain('contenteditable')
      expect(edited[0]).not.toContain('data-v-frozen')
      expect(edited[0]).toContain('data-od-locked="true"')
      expect(edited[0]).toContain('>fix</span>')
    } finally {
      window.removeEventListener('message', collect)
    }
    await stopEdit()
  })

  it('rejects whole-selection edits that touch frozen descendants', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="50"><span id="t">Hi <span id="lk" data-od-id="lk" data-od-locked="true">fix</span></span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    /* select-all spans the locked child: the length arithmetic alone
       would allow it, the range guard must refuse it */
    const text = document.querySelector('#t')!
    selectText(text, 0, text.childNodes.length)
    expect(beforeInput(text, { data: 'X' })).toBe(true)
    selectText(text, 0, text.childNodes.length)
    expect(beforeInput(text, { inputType: 'deleteContentBackward' })).toBe(true)
    expect(document.querySelector('#lk')!.textContent).toBe('fix')
    expect(document.querySelector('#t')!.textContent).toBe('Hi fix')
    await tick()
    expect(notices.some((n) => n.includes('gesperrt'))).toBe(true)
    await stopEdit()
  })

  it('restores frozen descendants in the input fallback and keeps the session editable', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="50"><span id="t">Hi <span id="lk" data-od-id="lk" data-od-locked="true">fix</span></span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    /* an unannounced edit removes the locked child: the fallback must
       restore it from the snapshot instead of accepting the result */
    document.querySelector('#lk')!.remove()
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await tick()
    expect(document.querySelector('#lk')!.textContent).toBe('fix')
    expect(notices.some((n) => n.includes('gesperrt'))).toBe(true)
    /* the session survives the restore: the editable node is resolved
       again and the guard still judges */
    const active = document.querySelector('#t')!
    expect(active.hasAttribute('contenteditable')).toBe(true)
    expect(active.hasAttribute('data-v-active')).toBe(true)
    document.querySelector('#t')!.firstChild!.textContent = 'Hi!'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await tick()
    expect(document.querySelector('#lk')!.textContent).toBe('fix')
    await stopEdit()
  })

  it('never activates unsafe descendants of a field, but keeps safe spans and field roots editable', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body"><p id="u">Text <span id="v">tief</span></p>' +
      '<span id="ok">frei</span></section><p id="r" data-od-id="g" data-od-role="body">Wurzel</p>'
    await editMode()
    /* unsafe wrapper and the span below it: no activation, no editable state */
    click(document.querySelector('#u')!)
    expect(document.querySelector('#u')!.hasAttribute('contenteditable')).toBe(false)
    expect(document.querySelector('[data-v-active]')).toBeNull()
    click(document.querySelector('#v')!)
    expect(document.querySelector('#v')!.hasAttribute('contenteditable')).toBe(false)
    expect(document.querySelector('[data-v-active]')).toBeNull()
    /* safe span directly in the field and a p field root still activate */
    click(document.querySelector('#ok')!)
    expect(document.querySelector('#ok')!.getAttribute('contenteditable')).not.toBeNull()
    click(document.querySelector('#r')!)
    expect(document.querySelector('#r')!.getAttribute('contenteditable')).not.toBeNull()
    await stopEdit()
  })

  it('credits composition replacement ranges instead of double-counting them', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="5"><span id="t">AB</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    /* a composition update replacing the in-progress "AB" with "ABCDE"
       fits the limit of 5 — counted as 2 - 2 + 5, not 2 + 5 */
    expect(
      beforeInput(document.querySelector('#t')!, {
        inputType: 'insertCompositionText',
        data: 'ABCDE',
        targetText: 'AB',
      }),
    ).toBe(false)
    /* without a replacement range the same insert still overflows */
    expect(beforeInput(document.querySelector('#t')!, { inputType: 'insertCompositionText', data: 'ABCDE' })).toBe(true)
    await stopEdit()
  })

  it('defers the fallback restore until compositionend', async () => {
    document.body.innerHTML =
      '<section data-od-id="f" data-od-role="body" data-od-max-length="3"><span id="t">ABC</span></section>'
    await editMode()
    click(document.querySelector('#t')!)
    document.querySelector('#t')!.dispatchEvent(new Event('compositionstart', { bubbles: true }))
    /* an uncommitted IME change past the limit must not be restored
       mid-composition (that would end the composition and jump the caret) */
    document.querySelector('#t')!.textContent = 'ABCD'
    document.querySelector('#t')!.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }))
    await tick()
    expect(document.querySelector('#t')!.textContent).toBe('ABCD')
    expect(notices.some((n) => n.includes('3 Zeichen'))).toBe(false)
    /* committing the over-limit text restores the last valid state once */
    document.querySelector('#t')!.dispatchEvent(new Event('compositionend', { bubbles: true }))
    await tick()
    expect(document.querySelector('#t')!.textContent).toBe('ABC')
    expect(notices.some((n) => n.includes('3 Zeichen'))).toBe(true)
    await stopEdit()
  })
})
