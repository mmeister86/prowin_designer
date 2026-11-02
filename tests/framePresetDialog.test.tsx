// @vitest-environment happy-dom
import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FramePresetDialog } from '../src/components/FramePresetDialog'
import type { FormatPresetId } from '../shared/prowin/formats'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
let root: Root
let container: HTMLDivElement
const create = vi.fn<(preset?: FormatPresetId) => Promise<void>>()
const changed = vi.fn()

function Harness() {
  const [open, setOpen] = useState(true)
  return (
    <FramePresetDialog
      open={open}
      onOpenChange={(next) => {
        changed(next)
        setOpen(next)
      }}
      onCreate={create}
    />
  )
}
const dialog = () => document.querySelector('[role="dialog"]')!
const button = (text: string) => [...dialog().querySelectorAll('button')].find((el) => el.textContent === text)!
const click = async (el: HTMLElement) => act(async () => el.click())

beforeEach(async () => {
  create.mockReset().mockResolvedValue(undefined)
  changed.mockClear()
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<Harness />))
})
afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

it('offers five named formats with their dimensions and a free frame', () => {
  for (const label of [
    'Instagram Post',
    'Instagram Story',
    'WhatsApp Status',
    'Facebook Post',
    'A4 (Druck)',
    'Freie Zeichenfläche',
  ]) {
    expect(dialog().textContent).toContain(label)
  }
  for (const size of ['1080 × 1080', '1080 × 1920', '1200 × 630', '794 × 1123', '640 × 480']) {
    expect(dialog().textContent).toContain(size)
  }
  expect(dialog().contains(document.activeElement)).toBe(true)
})

it.each([
  ['ig-story', 'ig-story'],
  ['wa-status', 'wa-status'],
  ['free', undefined],
] as const)('creates the selected %s choice and closes only on success', async (choice, preset) => {
  await click(dialog().querySelector<HTMLInputElement>(`input[value="${choice}"]`)!)
  await click(button('Erstellen'))
  expect(create).toHaveBeenCalledExactlyOnceWith(preset)
  expect(changed).toHaveBeenCalledWith(false)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('cancels without creating', async () => {
  await click(button('Abbrechen'))
  expect(create).not.toHaveBeenCalled()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('dismisses with Escape without creating', async () => {
  await act(async () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
  })
  expect(create).not.toHaveBeenCalled()
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('guards repeated submissions while pending', async () => {
  let finish!: () => void
  create.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  const submit = button('Erstellen')
  await click(submit)
  await click(submit)
  expect(create).toHaveBeenCalledTimes(1)
  expect(submit.disabled).toBe(true)
  expect(changed).not.toHaveBeenCalled()
  await act(async () => finish())
  expect(changed).toHaveBeenCalledWith(false)
})

it('shows a request failure and keeps the choice open for retry', async () => {
  create.mockRejectedValueOnce(new Error('offline'))
  await click(dialog().querySelector<HTMLInputElement>('input[value="a4"]')!)
  await click(button('Erstellen'))
  expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('nicht erstellt')
  expect(changed).not.toHaveBeenCalled()
  expect(dialog().querySelector<HTMLInputElement>('input[value="a4"]')?.checked).toBe(true)
  await click(button('Erstellen'))
  expect(create).toHaveBeenLastCalledWith('a4')
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})
