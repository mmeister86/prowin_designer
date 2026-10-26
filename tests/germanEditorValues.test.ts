import { expect, it } from 'vitest'
import * as cssValues from '../src/lib/cssValues'

it('separates German CSS display labels from persisted technical values', () => {
  expect(cssValues).toHaveProperty('cssValueLabel')
  const label = (cssValues as typeof cssValues & { cssValueLabel: (value: string) => string }).cssValueLabel
  expect(['row', 'column', 'flex-start', 'space-between', 'top', 'right', 'bottom', 'left'].map(label)).toEqual([
    'Zeile',
    'Spalte',
    'Anfang',
    'Abstand dazwischen',
    'oben',
    'rechts',
    'unten',
    'links',
  ])
  expect(label('custom-css-value')).toBe('custom-css-value')
  expect(cssValues.borderSummary([1, 0, 1, 0])).toEqual({ width: 1, sides: 'top bottom' })
})
