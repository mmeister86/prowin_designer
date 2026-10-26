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
    blurb: 'Das Bildmodell von OpenAI – zuverlässige Textdarstellung und UI-Grafiken.',
    provider: 'openai',
  },
  {
    id: 'gemini-3.1-flash-image',
    name: 'Nano Banana 2',
    blurb: 'Das Bildmodell von Google – fotorealistische Szenen, Bearbeitung und 4K.',
    provider: 'gemini',
  },
  {
    id: 'seedream-5-0-pro',
    name: 'Seedream 5 Pro',
    blurb: 'Das Spitzenmodell von ByteDance – detailreiche, malerische Qualität.',
    provider: 'ark',
  },
  {
    id: 'seedream-5-0-lite',
    name: 'Seedream 5 Lite',
    blurb: 'Die schnellere, günstigere Seedream-Variante.',
    provider: 'ark',
  },
]
