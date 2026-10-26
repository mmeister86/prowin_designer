import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import { taggingEnabled, tagWithModel } from '../server/backgrounds.ts'

const features = vi.hoisted(() => ({ backgrounds: true }))
vi.mock('../shared/prowin/features.ts', () => ({ OPTIONAL_FEATURES: features }))
vi.mock('../server/db/index.ts', () => ({ db: {} }))

const tags = {
  tone: 'dark',
  style: 'glow',
  palette: ['#101018', '#7C3AED'],
  tags: ['Purple', 'calm', 'tech', 'soft'],
  slots: ['hero'],
  text_zone: 'left',
  description: 'Soft purple glow',
}
const image = Buffer.from('synthetic-jpeg')

beforeEach(() => {
  features.backgrounds = true
  stubEnv('REQUESTY_API_KEY', 'requesty-test-key')
  stubEnv('ANTHROPIC_API_KEY', undefined)
  stubEnv('DOOP_AGENT_MODEL', 'policy/prowin-layout-gen')
})
afterEach(() => {
  vi.restoreAllMocks()
  unstubAllEnvs()
})

describe('Requesty background tagging', () => {
  it('sends the JPEG and JSON schema through the EU vision policy and normalizes the result', async () => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ choices: [{ message: { content: JSON.stringify(tags) } }] }))
    expect(taggingEnabled()).toBe(true)
    expect(await tagWithModel(image)).toMatchObject({
      palette: ['#101018', '#7c3aed'],
      tags: ['purple', 'calm', 'tech', 'soft'],
    })
    const [url, init] = fetcher.mock.calls[0]!
    expect(url).toBe('https://router.eu.requesty.ai/v1/chat/completions')
    expect(init).toMatchObject({ redirect: 'error', headers: { Authorization: 'Bearer requesty-test-key' } })
    const request = JSON.parse(init!.body as string)
    expect(request.model).toBe('policy/prowin-layout-gen')
    expect(request.messages[0].role).toBe('user')
    expect(request.messages[0].content[0]).toEqual({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` },
    })
    expect(request.response_format).toMatchObject({
      type: 'json_schema',
      json_schema: {
        name: 'background_tags',
        schema: { required: expect.arrayContaining(['tone', 'description']), additionalProperties: false },
      },
    })
  })

  it.each(['missing key', 'disabled feature'])(
    'prevents all network requests with %s even with a legacy key',
    async (reason) => {
      stubEnv('ANTHROPIC_API_KEY', 'legacy-test-key')
      if (reason === 'missing key') stubEnv('REQUESTY_API_KEY', '')
      else features.backgrounds = false
      const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unexpected network'))
      expect(taggingEnabled()).toBe(false)
      await expect(tagWithModel(image)).rejects.toThrow(/deaktiviert/)
      expect(fetcher).not.toHaveBeenCalled()
    },
  )

  it.each([{ refusal: 'Cannot describe this image', content: null }, { content: 'not json' }, { content: null }])(
    'rejects refusal or unusable output without an alternative provider: %j',
    async (message) => {
      const fetcher = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ choices: [{ message }] }))
      await expect(tagWithModel(image)).rejects.toThrow()
      expect(fetcher).toHaveBeenCalledTimes(1)
    },
  )

  it.each([401, 402, 429, 502])('surfaces HTTP %s without fallback', async (status) => {
    const fetcher = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(Response.json({ error: { message: 'Request failed' } }, { status }))
    await expect(tagWithModel(image)).rejects.toThrow(/Requesty EU/)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('rejects truncated tagging output even when it contains valid JSON', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json({
        choices: [
          {
            finish_reason: 'length',
            message: { content: JSON.stringify(tags) },
          },
        ],
      }),
    )
    await expect(tagWithModel(image)).rejects.toThrow(/unvollständig/)
  })
})
