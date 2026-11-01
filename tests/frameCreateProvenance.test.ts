import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('../src/lib/identity', () => ({ getIdentity: () => ({ clientId: 'client', name: 'Test' }) }))
import { api } from '../src/lib/api'

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({ id: 'created' }), { status: 200 }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

it.each([
  '<p>Plain</p>',
  '<!-- <p data-od-id="example">Example</p> --><p>Plain</p>',
  '<script>const example = \'<p data-od-id="example">Example</p>\'</script><p>Plain</p>',
])('does not send a stale source reference for metadata-free creation: %s', async (html) => {
  await api.createFrame('c1', { name: 'Plain', html, sourceFrameId: 'deleted-or-inaccessible' })
  const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, unknown>
  expect(body.html).toBe(html)
  expect(body).not.toHaveProperty('sourceFrameId')
})

it('retains source provenance for actual template fields', async () => {
  const html = '<p data-od-id="field" data-od-locked>Protected</p>'
  await api.createFrame('c1', { name: 'Template', html, sourceFrameId: 'source' })
  const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string) as Record<string, unknown>
  expect(body).toMatchObject({ html, sourceFrameId: 'source' })
})
