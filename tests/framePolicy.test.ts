import { expect, it } from 'vitest'
import { frameSrcDoc } from '../src/lib/framePolicy'

it.each(['null', 'file:///designer', 'data:text/html,test', 'javascript:alert(1)', 'blob:https://example.com/id'])(
  'rejects a non-instance origin: %s',
  (origin) => {
    expect(() => frameSrcDoc('<p>Preview</p>', origin)).toThrow()
  },
)
