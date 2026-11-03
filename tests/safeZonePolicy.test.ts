import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Canvas } from '../shared/types.ts'

const canAccess = vi.hoisted(() => ({ current: true }))
vi.mock('../server/prowin/permissions.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../server/prowin/permissions.ts')>()
  return {
    ...mod,
    canvasCapabilities: (_canvas: Canvas) =>
      canAccess.current
        ? { manageLocks: true, publish: false, localAgent: false }
        : { manageLocks: false, publish: false, localAgent: false },
  }
})
vi.mock('../server/prowin/templateGuard.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../server/prowin/templateGuard.ts')>()
  return { ...mod, assertCanChangeLock: () => undefined, assertTemplateDelete: () => undefined }
})
vi.mock('../server/prowin/templateMeta.ts', () => ({
  assertCanChangeTemplateMeta: () => undefined,
}))
vi.mock('../server/db/persist.ts', () => ({
  saveFrame: () => undefined,
  saveCanvas: () => undefined,
  saveCanvasCopy: async () => undefined,
  savePageCopy: async () => undefined,
  saveFrameVersion: () => undefined,
  saveActivity: () => undefined,
  saveTask: () => undefined,
  saveFeedback: () => undefined,
  saveComment: () => undefined,
  deleteFrame: () => undefined,
}))

import { store } from '../server/store.ts'
import * as actions from '../server/actions.ts'
import { CreatorPermissionError } from '../server/prowin/permissions.ts'

const actor = (name: string) => ({ name, kind: 'user' as const, color: '#000' })

function canvasWith(preset?: Canvas['frames'][number]['preset']) {
  const canvas: Canvas = {
    id: 'c1',
    name: 'C',
    createdAt: 1,
    updatedAt: 1,
    pages: [{ id: 'p1', name: 'Page 1' }],
    frames: [],
  }
  store.canvases.clear()
  store.init([canvas])
  return actions.createFrame(
    'c1',
    { name: 'F', preset, html: '<p>x</p>', width: 1080, height: 1080, restoreDimensions: true },
    actor('creator'),
  )!
}

describe('safe-zone policy', () => {
  beforeEach(() => {
    canAccess.current = true
  })

  it('creator set and reset succeeds', () => {
    const f = canvasWith('ig-post')
    const updated = actions.updateFrame(
      f.id,
      { safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } },
      actor('creator'),
    )!
    expect(updated.safeZoneOverride).toEqual({ top: 10, right: 10, bottom: 10, left: 10 })
    const reset = actions.updateFrame(f.id, { safeZoneOverride: null }, actor('creator'))!
    expect(reset).not.toHaveProperty('safeZoneOverride')
  })

  it('member differing values and reset are denied without mutation', () => {
    const f = canvasWith('ig-post')
    canAccess.current = false
    expect(() =>
      actions.updateFrame(f.id, { safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } }, actor('m')),
    ).toThrow(CreatorPermissionError)
    expect(() => actions.updateFrame(f.id, { safeZoneOverride: null }, actor('m'))).toThrow(CreatorPermissionError)
    expect(store.getFrame(f.id)).not.toHaveProperty('safeZoneOverride')
  })

  it('rejects overrides without a preset', () => {
    const f = canvasWith(undefined)
    expect(() =>
      actions.updateFrame(f.id, { safeZoneOverride: { top: 1, right: 1, bottom: 1, left: 1 } }, actor('c')),
    ).toThrow(/Format/)
  })

  it('rejects invalid override values and oversized insets', () => {
    const f = canvasWith('ig-post')
    for (const bad of [
      { top: 1, right: 1, bottom: 1 },
      { top: -1, right: 0, bottom: 0, left: 0 },
      { top: 1.5, right: 0, bottom: 0, left: 0 },
      { top: 540, right: 0, bottom: 540, left: 0 },
    ]) {
      expect(() => actions.updateFrame(f.id, { safeZoneOverride: bad as never }, actor('c'))).toThrow()
    }
    expect(store.getFrame(f.id)).not.toHaveProperty('safeZoneOverride')
  })

  it('clears the override on preset switch but keeps it for the same preset', () => {
    const f = canvasWith('ig-post')
    actions.updateFrame(f.id, { safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } }, actor('c'))
    actions.updateFrame(f.id, { preset: 'ig-story' }, actor('c'))
    expect(store.getFrame(f.id)).not.toHaveProperty('safeZoneOverride')
    actions.updateFrame(f.id, { safeZoneOverride: { top: 10, right: 10, bottom: 10, left: 10 } }, actor('c'))
    actions.updateFrame(f.id, { preset: 'ig-story' }, actor('c'))
    expect(store.getFrame(f.id)).toHaveProperty('safeZoneOverride')
  })

  it('rejects resize and restore that invalidate the override', () => {
    const f = canvasWith('ig-post')
    actions.updateFrame(f.id, { safeZoneOverride: { top: 500, right: 0, bottom: 500, left: 0 } }, actor('c'))
    expect(() => actions.updateFrame(f.id, { height: 900 }, actor('c'))).toThrow()
    expect(store.getFrame(f.id)).toHaveProperty('safeZoneOverride')
  })

  it('member source copies inherit stored metadata including zeroes', () => {
    const f = canvasWith('ig-post')
    actions.updateFrame(f.id, { safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } }, actor('c'))
    canAccess.current = false
    const copy = actions.createFrame('c1', { name: 'Copy', html: '<p>x</p>', sourceFrameId: f.id }, actor('m'))!
    expect(copy.safeZoneOverride).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(() =>
      actions.createFrame(
        'c1',
        {
          name: 'Copy2',
          html: '<p>x</p>',
          sourceFrameId: f.id,
          safeZoneOverride: { top: 1, right: 1, bottom: 1, left: 1 },
        },
        actor('m'),
      ),
    ).toThrow(CreatorPermissionError)
  })
})
