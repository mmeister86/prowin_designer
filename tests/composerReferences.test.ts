// @vitest-environment happy-dom
import { beforeEach, expect, it, vi } from 'vitest'
import { useStore } from '../src/lib/store'
import type { Canvas } from '../shared/types'

beforeEach(() => {
  useStore.setState({
    canvas: { id: 'c1', frames: ['a', 'b', 'c'].map((id) => ({ id, canvasId: 'c1' })) } as Canvas,
    composerAttachments: {},
    composerSend: null,
  })
})

it('deduplicates canvas references within the combined four-item limit', () => {
  const s = useStore.getState()
  s.setComposerAttachments(
    'c1',
    [1, 2].map((n) => ({ kind: 'file', file: new File([''], `${n}.png`), preview: `blob:${n}` })),
  )
  s.addComposerReferences('c1', ['foreign', 'a', 'b', 'a', 'c'])
  expect(useStore.getState().composerAttachments.c1).toHaveLength(4)
  expect(useStore.getState().composerAttachments.c1?.filter((a) => a.kind === 'frame')).toEqual([
    { kind: 'frame', frameId: 'a' },
    { kind: 'frame', frameId: 'b' },
  ])
  expect(useStore.getState().notice?.text).toContain('4')
})

it('blocks user mutations during a send but permits internal conversion and revokes once', () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const s = useStore.getState()
  s.setComposerAttachments('c1', [{ kind: 'file', file: new File([''], 'a.png'), preview: 'blob:a' }])
  s.setComposerSend({ canvasId: 'c1', status: 'busy' })
  s.addComposerReferences('c1', ['b'])
  expect(useStore.getState().composerAttachments.c1).toHaveLength(1)
  s.setComposerAttachments('c1', [{ kind: 'frame', frameId: 'a' }])
  s.setComposerAttachments('c1', [])
  expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:a')
  revoke.mockRestore()
})
