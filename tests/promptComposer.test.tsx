// @vitest-environment happy-dom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canvas } from '../shared/types'

/**
 * The prompt composer lives at the bottom of the Agents tab: Enter
 * queues the card, ⇧Enter breaks the line, and a ⌘K focus request from the
 * page lands the keyboard in it.
 */

const mocks = vi.hoisted(() => ({
  addCard: vi.fn(() => Promise.resolve({})),
  upload: vi.fn<(...args: unknown[]) => Promise<import('../src/lib/frameClipboard').ImageFrameUpload[]>>(() =>
    Promise.resolve([]),
  ),
  agentAllowance: vi.fn(() => Promise.resolve({ used: 0, limit: 5, localAgent: false })),
}))
vi.mock('../src/lib/api', () => ({
  errorMessage: (_error: unknown, fallback: string) => fallback,
  api: {
    addCard: mocks.addCard,
    agentAllowance: mocks.agentAllowance,
  },
  ApiError: class ApiError extends Error {},
}))
vi.mock('../src/lib/auth', () => ({ authClient: { useSession: () => ({ data: { user: { id: 'alice' } } }) } }))
vi.mock('../src/lib/frameClipboard', () => ({ uploadImageFrames: mocks.upload, hasFrameClip: () => false }))
vi.mock('../src/components/ChatPanel', () => ({ ChatPanel: () => null }))
vi.mock('../src/components/MemoryPanel', () => ({ MemoryPanel: () => null }))

const { useStore } = await import('../src/lib/store')
const { ActivityPanel } = await import('../src/components/ActivityPanel')
const { TooltipProvider } = await import('../src/components/ui/tooltip')
const { ContextMenu, ContextMenuTrigger } = await import('../src/components/ui/context-menu')
const { FrameContextMenu } = await import('../src/components/FrameContextMenu')

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const canvas = { id: 'c1', name: 'Canvas', frames: [], pages: [] } as unknown as Canvas

let container: HTMLDivElement
let root: Root

async function render(menuFrame?: Canvas['frames'][number]) {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () =>
    root.render(
      <TooltipProvider>
        {menuFrame && (
          <ContextMenu>
            <ContextMenuTrigger asChild>
              <button data-frame-menu>Zeichenflächenmenü</button>
            </ContextMenuTrigger>
            <FrameContextMenu frame={menuFrame} at={{ current: { x: 0, y: 0 } }} />
          </ContextMenu>
        )}
        <ActivityPanel canvasId="c1" onClose={() => {}} />
      </TooltipProvider>,
    ),
  )
}

function composer(): HTMLTextAreaElement {
  const ta = container.querySelector<HTMLTextAreaElement>('textarea[aria-label="Frag den Doop-Agenten"]')
  if (!ta) throw new Error('composer not rendered')
  return ta
}

async function type(text: string) {
  const ta = composer()
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!
    setter.call(ta, text)
    ta.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function press(key: string, init: KeyboardEventInit = {}) {
  await act(async () => {
    composer().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }))
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  useStore.setState({
    canvas,
    panelTab: 'tasks',
    composerFocusAt: 0,
    composerDrafts: {},
    composerAttachments: {},
    composerSend: null,
    flyTo: null,
    selectedId: null,
    selectedIds: [],
    selectedElement: null,
  })
})

const switchTab = (tab: 'tasks' | 'activity') => act(async () => useStore.getState().setPanelTab(tab))
const frameOn = (canvasId: string, id: string) =>
  ({ id, canvasId, name: id, x: 0, y: 0, width: 1, height: 1, html: '<p/>' }) as unknown as Canvas['frames'][number]
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('the Agents tab composer', () => {
  it('keeps composer focus after the reference context menu closes', async () => {
    const source = frameOn('c1', 'source')
    useStore.setState({ canvas: { ...canvas, frames: [source] } })
    await render(source)
    const trigger = container.querySelector<HTMLButtonElement>('[data-frame-menu]')!
    trigger.focus()
    await act(async () => {
      trigger.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })
    const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (node) => node.textContent === 'Als Referenz verwenden',
    )!
    expect(item).toBeTruthy()
    await act(async () => item.click())
    await act(async () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())))
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(useStore.getState().composerAttachments.c1).toEqual([{ kind: 'frame', frameId: source.id }])
    await act(async () => vi.waitFor(() => expect(document.activeElement).toBe(composer()), { timeout: 200 }))
  })

  it('adds the selected group through the visible composer button and suppresses source element scope', async () => {
    useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'a'), frameOn('c1', 'b')] } })
    useStore.setState({ selectedIds: ['b', 'a'], selectedId: 'a', selectedElement: { frameId: 'a', selector: 'p' } })
    await render()
    await act(async () =>
      Array.from(container.querySelectorAll('button'))
        .find((b) => b.textContent === 'Auswahl als Referenz')!
        .click(),
    )
    expect(useStore.getState().composerAttachments.c1).toEqual([
      { kind: 'frame', frameId: 'b' },
      { kind: 'frame', frameId: 'a' },
    ])
    expect(container.textContent).toContain('Kontaktdaten im Bild werden nicht automatisch entfernt')
    expect(container.querySelector('button[aria-label="Referenz a entfernen"]')).toBeTruthy()
    await type('create something')
    await press('Enter')
    expect(mocks.addCard).toHaveBeenCalledWith('c1', 'create something', ['doop'], ['b', 'a'], undefined)
    expect(useStore.getState().canvas?.frames).toHaveLength(2)
  })

  it('keeps references across panel switches and blocks a deleted reference until explicitly removed', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    useStore.getState().setComposerAttachments('c1', [
      { kind: 'frame', frameId: 'gone' },
      { kind: 'file', file: new File(['x'], 'x.png'), preview: 'blob:x' },
    ])
    await render()
    await switchTab('activity')
    expect(revoke).not.toHaveBeenCalled()
    await switchTab('tasks')
    expect(container.textContent).toContain('Quelle fehlt')
    await type('hello')
    await press('Enter')
    expect(mocks.addCard).not.toHaveBeenCalled()
    expect(mocks.upload).not.toHaveBeenCalled()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Referenz Quelle fehlt entfernen"]')!.click(),
    )
    expect(useStore.getState().composerAttachments.c1).toHaveLength(1)
    revoke.mockRestore()
  })

  it('reuses successful reference uploads after partial upload and queue failures', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const one = new File(['1'], 'same.png'),
      two = new File(['2'], 'same.png')
    useStore.getState().setComposerAttachments('c1', [
      { kind: 'file', file: one, preview: 'blob:one' },
      { kind: 'file', file: two, preview: 'blob:two' },
    ])
    mocks.upload.mockImplementationOnce(async () => {
      useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'first')] } })
      return [
        { file: two, error: 'Upload failed' },
        { file: one, frame: frameOn('c1', 'first') },
      ]
    })
    await render()
    await type('retry me')
    await press('Enter')
    expect(mocks.addCard).not.toHaveBeenCalled()
    expect(revoke.mock.calls).toEqual([['blob:one']])
    expect(useStore.getState().composerAttachments.c1?.[0]).toEqual({ kind: 'frame', frameId: 'first' })
    mocks.upload.mockImplementationOnce(async () => {
      useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'first'), frameOn('c1', 'second')] } })
      return [{ file: two, frame: frameOn('c1', 'second') }]
    })
    mocks.addCard.mockRejectedValueOnce(new Error('queue failed'))
    await press('Enter')
    expect(mocks.upload).toHaveBeenLastCalledWith('c1', [two], 'Angehängtes Bild')
    expect(revoke.mock.calls).toEqual([['blob:one'], ['blob:two']])
    const calls = mocks.upload.mock.calls.length
    await press('Enter')
    expect(mocks.upload).toHaveBeenCalledTimes(calls)
    expect(mocks.addCard).toHaveBeenLastCalledWith('c1', 'retry me', ['doop'], ['first', 'second'], undefined)
    expect(useStore.getState().composerAttachments.c1).toEqual([])
    revoke.mockRestore()
  })

  it('blocks user mutations while uploading but converts internally and preserves a different canvas draft', async () => {
    const file = new File(['x'], 'x.png')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    let finish!: (result: import('../src/lib/frameClipboard').ImageFrameUpload[]) => void
    mocks.upload.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'a')] } })
    useStore.setState({ flyTo: null })
    useStore.getState().setComposerAttachments('c1', [{ kind: 'file', file, preview: 'blob:x' }])
    await render()
    await type('send')
    await press('Enter')
    await act(async () => {
      useStore.getState().addComposerReferences('c1', ['a'])
      container.querySelector<HTMLButtonElement>('button[aria-label="Referenz x.png entfernen"]')!.click()
      const input = container.querySelector<HTMLInputElement>('input[type="file"]')!
      Object.defineProperty(input, 'files', { value: [new File(['y'], 'y.png')] })
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(useStore.getState().composerAttachments.c1).toHaveLength(1)
    await act(async () => {
      useStore.setState({ canvas: { ...canvas, id: 'c2' }, selectedId: 'other', selectedIds: ['other'] })
      useStore.getState().setComposerDraft('c2', 'keep')
      useStore.getState().setComposerAttachments('c2', [{ kind: 'frame', frameId: 'other' }])
      finish([{ file, frame: frameOn('c1', 'uploaded') }])
    })
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:x')
    expect(useStore.getState().composerDrafts.c2).toBe('keep')
    expect(useStore.getState().composerAttachments.c2).toEqual([{ kind: 'frame', frameId: 'other' }])
    expect(useStore.getState().selectedId).toBe('other')
    expect(useStore.getState().flyTo).toBeNull()
    revoke.mockRestore()
  })

  it('preserves a different selected element as the exact edit target', async () => {
    useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'source'), frameOn('c1', 'target')] } })
    useStore.getState().setComposerAttachments('c1', [{ kind: 'frame', frameId: 'source' }])
    useStore.setState({ selectedElement: { frameId: 'target', selector: 'p' } })
    await render()
    expect(container.textContent).toContain('Bearbeitungsziel:')
    await type('edit')
    await press('Enter')
    expect(mocks.addCard).toHaveBeenCalledWith('c1', 'edit', ['doop'], ['source'], { frameId: 'target', selector: 'p' })
  })

  it('keeps file previews per canvas through unmount and revokes on explicit removal', async () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    useStore
      .getState()
      .setComposerAttachments('c1', [{ kind: 'file', file: new File(['x'], 'draft.png'), preview: 'blob:draft' }])
    await render()
    await act(async () => {
      useStore.setState({ canvas: { ...canvas, id: 'c2' } })
      root.render(
        <TooltipProvider>
          <ActivityPanel canvasId="c2" onClose={() => {}} />
        </TooltipProvider>,
      )
    })
    expect(container.querySelector('img[alt="Referenz: draft.png"]')).toBeNull()
    expect(revoke).not.toHaveBeenCalled()
    await act(async () => {
      useStore.setState({ canvas })
      root.render(
        <TooltipProvider>
          <ActivityPanel canvasId="c1" onClose={() => {}} />
        </TooltipProvider>,
      )
    })
    expect(container.querySelector('img[alt="Referenz: draft.png"]')).toBeTruthy()
    await act(async () =>
      container.querySelector<HTMLButtonElement>('button[aria-label="Referenz draft.png entfernen"]')!.click(),
    )
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:draft')
    revoke.mockRestore()
  })

  it('keeps the send locked throughout a delayed allowance confirmation', async () => {
    const exhausted = { used: 5, limit: 5, localAgent: false }
    let confirm!: (value: typeof exhausted) => void
    mocks.agentAllowance.mockResolvedValueOnce(exhausted)
    await render()
    mocks.agentAllowance.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          confirm = resolve
        }),
    )
    await type('check allowance')
    await press('Enter')
    expect(useStore.getState().composerSend).toEqual({ canvasId: 'c1', status: 'busy' })
    await act(async () => useStore.getState().addComposerReferences('c1', ['anything']))
    expect(useStore.getState().composerAttachments.c1).toBeUndefined()
    await act(async () => confirm(exhausted))
    expect(mocks.upload).not.toHaveBeenCalled()
    expect(mocks.addCard).not.toHaveBeenCalled()
    expect(useStore.getState().composerDrafts.c1).toBe('check allowance')
    expect(useStore.getState().composerSend).toBeNull()
    useStore.setState({ limitWall: false })
  })
  it('is docked in the tasks tab with its send button', async () => {
    await render()
    const send = Array.from(container.querySelectorAll('button')).find((b) => b.getAttribute('aria-label') === 'Senden')
    expect(send).toBeTruthy()
    expect(send!.disabled).toBe(true) // nothing typed yet
    expect(composer().closest('[data-slot="panel-tab-panel"]')?.getAttribute('data-state')).toBe('active')
  })

  it('sends on Enter and keeps a ⇧Enter draft', async () => {
    await render()
    await type('a hero for the pricing page')
    await press('Enter', { shiftKey: true })
    expect(mocks.addCard).not.toHaveBeenCalled()
    expect(composer().value).toBe('a hero for the pricing page')

    await press('Enter')
    expect(mocks.addCard).toHaveBeenCalledWith('c1', 'a hero for the pricing page', ['doop'], [], undefined)
    expect(composer().value).toBe('')
  })

  it('scopes the card to the selected frame', async () => {
    useStore.setState({
      canvas: {
        ...canvas,
        frames: [{ id: 'f1', canvasId: 'c1', name: 'Hero', x: 0, y: 0, width: 1, height: 1, html: '<p/>' }],
      } as unknown as Canvas,
    })
    /* after the canvas: a send above left a camera watch on the store, and
       the frame "arriving" through it flies the camera, which resets the
       selection */
    useStore.getState().select('f1')
    await render()
    await type('make it bolder')
    await press('Enter')
    expect(mocks.addCard).toHaveBeenCalledWith('c1', 'make it bolder', ['doop'], [], { frameId: 'f1' })
  })

  it('takes the keyboard on a focus request', async () => {
    await render()
    expect(document.activeElement).not.toBe(composer())
    await act(async () => useStore.getState().requestComposerFocus())
    expect(document.activeElement).toBe(composer())
  })

  it('is not in the other tabs', async () => {
    useStore.setState({ panelTab: 'activity' })
    await render()
    expect(container.querySelector('textarea[aria-label="Frag den Doop-Agenten"]')).toBeNull()
  })

  it('keeps the draft across a tab switch, per canvas', async () => {
    await render()
    await type('half a thought')
    await switchTab('activity')
    expect(container.querySelector('textarea')).toBeNull()
    await switchTab('tasks')
    expect(composer().value).toBe('half a thought')
    expect(useStore.getState().composerDrafts).toEqual({ c1: 'half a thought' })
  })

  it('still reports a send that failed while another tab was open', async () => {
    let fail!: (err: Error) => void
    mocks.addCard.mockImplementationOnce(() => new Promise((_, reject) => (fail = reject)))
    await render()
    await type('a footer')
    await press('Enter')
    expect(composer().disabled).toBe(true) // in flight

    await switchTab('activity')
    await act(async () => fail(new Error('Unknown provider error')))
    await switchTab('tasks')
    expect(container.textContent).toContain('Deine Anfrage konnte nicht gesendet werden. Versuche es erneut.')
    expect(composer().value).toBe('a footer') // the draft is there for a retry
    expect(composer().disabled).toBe(false)

    /* touching the draft takes the failure down */
    await type('a footer, retried')
    expect(container.textContent).not.toContain('Deine Anfrage konnte nicht gesendet werden. Versuche es erneut.')
  })

  it('flies the camera to the first new frame on this canvas only', async () => {
    await render()
    await type('a hero')
    await press('Enter')
    expect(useStore.getState().flyTo).toBeNull()

    /* another canvas opened before the agent delivered: its frames are not
       deliverables, and the watch is over */
    useStore.setState({ canvas: null })
    useStore.setState({ canvas: { ...canvas, id: 'c2', frames: [frameOn('c2', 'elsewhere')] } as Canvas })
    expect(useStore.getState().flyTo).toBeNull()
    useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'late')] } as Canvas })
    expect(useStore.getState().flyTo).toBeNull()
  })

  it('flies the camera to the first new frame after a send', async () => {
    await render()
    await type('a hero')
    await press('Enter')
    useStore.setState({ canvas: null }) // a reconnect, not a navigation
    useStore.setState({ canvas: { ...canvas, frames: [frameOn('c1', 'delivered')] } as Canvas })
    expect(useStore.getState().flyTo).toMatchObject({ frameId: 'delivered' })
  })
})
