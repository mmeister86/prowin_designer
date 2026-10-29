import { beforeEach, describe, expect, it, vi } from 'vitest'

/* The queue mirrors into Postgres and broadcasts; this test only cares about
   the text a card carries. */
vi.mock('../server/db/persist.ts', () => ({
  saveTask: () => {},
  saveFeedback: () => {},
  saveComment: () => {},
  saveActivity: () => {},
  saveDecision: () => {},
  saveProposal: () => {},
  saveCanvas: () => {},
  saveGuideline: () => {},
  saveFrame: () => {},
  deleteFrame: () => {},
}))

const actions = await import('../server/actions.ts')
const { store } = await import('../server/store.ts')

/**
 * A card's text IS the prompt the resident agent runs on. It used to be cut
 * to 200 characters on the way in, so any instruction past that point never
 * reached the agent. These tests pin that the whole prompt is kept.
 */

const filler = 'this opening is deliberately filler and carries no instruction at all, please ignore it. '
const longPrompt = `${filler.repeat(3)}the real task: create one 600x400 frame named BRIEF OK with a centered black circle.`

let canvasId: string

beforeEach(() => {
  actions.wire(
    () => {},
    () => {},
  )
  actions.hydrateLogs({
    tasks: new Map(),
    feedback: new Map(),
    comments: new Map(),
    activity: new Map(),
    decisions: new Map(),
    proposals: new Map(),
  })
  canvasId = store.createCanvas('card prompt', 'kevin').id
})

describe('addQueuedCard', () => {
  it('keeps a prompt longer than 200 characters intact', () => {
    expect(longPrompt.length).toBeGreaterThan(200)
    const card = actions.addQueuedCard(canvasId, longPrompt, 'kevin')
    expect(card?.status).toBe(longPrompt)
    expect(actions.getTasks(canvasId)[0]?.status).toBe(longPrompt)
  })

  it('caps a pasted document at MAX_CARD_CHARS', () => {
    const card = actions.addQueuedCard(canvasId, 'x'.repeat(actions.MAX_CARD_CHARS + 1), 'kevin')
    expect(card?.status.length).toBe(actions.MAX_CARD_CHARS)
  })

  it('treats the same long prompt queued twice as one card', () => {
    const first = actions.addQueuedCard(canvasId, longPrompt, 'kevin')
    const again = actions.addQueuedCard(canvasId, ` ${longPrompt} `, 'kevin')
    expect(again?.id).toBe(first?.id)
    expect(actions.getTasks(canvasId)).toHaveLength(1)
  })

  it('does not merge two prompts that only share their first 200 characters', () => {
    const a = actions.addQueuedCard(canvasId, `${filler.repeat(3)}make it red`, 'kevin')
    const b = actions.addQueuedCard(canvasId, `${filler.repeat(3)}make it blue`, 'kevin')
    expect(b?.id).not.toBe(a?.id)
    expect(actions.getTasks(canvasId)).toHaveLength(2)
  })

  it('carries the selected frame and element as the card scope', () => {
    const frame = store.createFrame(canvasId, { name: 'Home' }, 'kevin')!
    const card = actions.addQueuedCard(canvasId, 'make it bolder', 'kevin', undefined, undefined, undefined, {
      frameId: frame.id,
      selector: 'aside:nth-of-type(1)',
    })
    expect(card?.scope).toEqual({ frameId: frame.id, selector: 'aside:nth-of-type(1)' })
    const whole = actions.addQueuedCard(canvasId, 'make it bolder', 'kevin', undefined, undefined, undefined, {
      frameId: frame.id,
      selector: '   ',
    })
    expect(whole?.scope).toEqual({ frameId: frame.id })
    expect(whole?.id).not.toBe(card?.id)
  })

  it('drops a scope whose frame is not on this canvas', () => {
    const other = store.createCanvas('elsewhere', 'kevin').id
    const foreign = store.createFrame(other, { name: 'Away' }, 'kevin')!
    const card = actions.addQueuedCard(canvasId, 'tidy up', 'kevin', undefined, undefined, undefined, {
      frameId: foreign.id,
      selector: 'div',
    })
    expect(card?.scope).toBeUndefined()
    const junk = actions.addQueuedCard(canvasId, 'tidy up again', 'kevin', undefined, undefined, undefined, 'nope')
    expect(junk?.scope).toBeUndefined()
  })
})

// A bad reference must never turn into an unrelated, reference-free task.
describe('card references', () => {
  it.each([
    [undefined, []],
    [
      ['one', 'two', 'one'],
      ['one', 'two'],
    ],
    [
      ['one', 'two', 'three', 'four'],
      ['one', 'two', 'three', 'four'],
    ],
    [null, null],
    ['one', null],
    [{}, null],
    [[1], null],
    [[''], null],
    [['  '], null],
    [['one', 'two', 'three', 'four', 'five'], null],
  ])('normalizes %j to %j', (input, expected) => {
    expect(actions.normalizeCardReferences(input)).toEqual(expected)
  })

  it('rejects malformed references without creating a card', () => {
    expect(actions.addQueuedCard(canvasId, 'design', 'kevin', undefined, [1])).toBeUndefined()
    expect(actions.getTasks(canvasId)).toHaveLength(0)
  })

  it('treats the same prompt with different references as different cards', () => {
    const a = store.createFrame(canvasId, { name: 'A' }, 'kevin')!
    const b = store.createFrame(canvasId, { name: 'B' }, 'kevin')!
    const first = actions.addQueuedCard(canvasId, 'design', 'kevin', undefined, [a.id])!
    const second = actions.addQueuedCard(canvasId, 'design', 'kevin', undefined, [b.id])!
    expect(second.id).not.toBe(first.id)
    expect(second.attachments).toEqual([b.id])
  })

  it('drops an edit scope that is also a reference', () => {
    const source = store.createFrame(canvasId, { name: 'Source' }, 'kevin')!
    const card = actions.addQueuedCard(canvasId, 'design', 'kevin', undefined, [source.id], undefined, {
      frameId: source.id,
      selector: 'h1',
    })!
    expect(card.scope).toBeUndefined()
    expect(card.attachments).toEqual([source.id])
  })

  it('keeps a distinct edit target with references', () => {
    const source = store.createFrame(canvasId, { name: 'Source' }, 'kevin')!
    const target = store.createFrame(canvasId, { name: 'Target' }, 'kevin')!
    const card = actions.addQueuedCard(canvasId, 'design', 'kevin', undefined, [source.id], undefined, {
      frameId: target.id,
      selector: 'h1',
    })!
    expect(card.scope).toEqual({ frameId: target.id, selector: 'h1' })
  })

  it('preserves an attachment deleted during admission for runtime failure', async () => {
    const source = store.createFrame(canvasId, { name: 'Source' }, 'kevin')!
    const checkedIds = [source.id]
    await Promise.resolve().then(() => store.deleteFrame(source.id))
    const card = actions.addQueuedCard(canvasId, 'design', 'kevin', undefined, checkedIds)!
    expect(card.attachments).toEqual([source.id])
  })
})
