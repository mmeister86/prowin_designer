import { beforeAll, expect, it } from 'vitest'
import { Window } from 'happy-dom'
import { assertTemplateWrite } from '../server/prowin/templateGuard'
import { templatePolicyOf } from '../src/prowin/templatePolicy'
import type { Canvas } from '../shared/types'

/* Client/server alignment (TASK-31 final fix): the client must offer exactly
   what the TASK-30 guard accepts. Each case applies the same text change at
   the same element through both verdicts — no shared implementation, only a
   shared outcome. Node env (the server guard chain cannot load under
   happy-dom); the client policy gets its DOMParser from a happy-dom Window. */

const page = (body: string) => `<!doctype html><html><head></head><body>${body}</body></html>`
const canvas = { id: 'c', name: 'Canvas', frames: [] } as unknown as Canvas

beforeAll(() => {
  const window = new Window()
  ;(globalThis as unknown as { DOMParser: unknown }).DOMParser = window.DOMParser
})

it.each([
  {
    name: 'p child of a field',
    body: '<div data-od-id="f" data-od-role="body"><p id="x">Text</p></div>',
    next: '<div data-od-id="f" data-od-role="body"><p id="x">Text!</p></div>',
    blocked: true,
  },
  {
    name: 'span below a p wrapper',
    body: '<div data-od-id="f" data-od-role="body"><p><span id="x">t</span></p></div>',
    next: '<div data-od-id="f" data-od-role="body"><p><span id="x">t!</span></p></div>',
    blocked: true,
  },
  {
    name: 'safe span directly in the field',
    body: '<div data-od-id="f" data-od-role="body"><span id="x">t</span></div>',
    next: '<div data-od-id="f" data-od-role="body"><span id="x">t!</span></div>',
    blocked: false,
  },
  {
    name: 'p field root',
    body: '<p id="x" data-od-id="f" data-od-role="body">Text</p>',
    next: '<p id="x" data-od-id="f" data-od-role="body">Text!</p>',
    blocked: false,
  },
  {
    name: 'nested field behind an unsafe ancestor of the outer field',
    body: '<div data-od-id="o" data-od-role="body"><p><span id="x" data-od-id="i" data-od-role="body">t</span></p></div>',
    next: '<div data-od-id="o" data-od-role="body"><p><span id="x" data-od-id="i" data-od-role="body">t!</span></p></div>',
    blocked: true,
  },
  {
    name: 'img outside an image-role field',
    body: '<div data-od-id="t" data-od-role="body"><img id="x" src="a.png" alt="A"></div>',
    next: '<div data-od-id="t" data-od-role="body"><img id="x" src="b.png" alt="B"></div>',
    blocked: true,
  },
])('client and server agree on $name', ({ body, next, blocked }) => {
  expect(templatePolicyOf(page(body), '#x', false)?.readOnly).toBe(blocked)
  if (blocked) {
    expect(() => assertTemplateWrite(canvas, page(body), page(next))).toThrow()
  } else {
    expect(() => assertTemplateWrite(canvas, page(body), page(next))).not.toThrow()
  }
})
