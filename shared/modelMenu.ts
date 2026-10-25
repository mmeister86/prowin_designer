/**
 * The image-model registry. `provider` names the credential family that can
 * run it — imageGen resolves a generator per provider (server credentials only). Adding a model later is one entry here, plus a new
 * generator in server/imageGen.ts only if it introduces a new provider.
 */
export type ImageProvider = 'openai' | 'gemini' | 'ark'

export interface ImageModelOption {
  id: string
  name: string
  blurb: string
  provider: ImageProvider
}

export const IMAGE_MODELS: ImageModelOption[] = [
  {
    id: 'gpt-image-2',
    name: 'GPT Image 2',
    blurb: 'OpenAI’s image model — reliable text rendering and UI assets.',
    provider: 'openai',
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    blurb: 'Google’s image model — photoreal scenes, editing, 4K.',
    provider: 'gemini',
  },
  {
    id: 'seedream-5-0-pro',
    name: 'Seedream 5 Pro',
    blurb: 'ByteDance’s top image model — rich, painterly quality.',
    provider: 'ark',
  },
  { id: 'seedream-5-0-lite', name: 'Seedream 5 Lite', blurb: 'Faster, cheaper Seedream tier.', provider: 'ark' },
]
