/* Keep this module dependency-free and import it first in server/index.ts:
   forbidden credentials must fail before any provider can initialize. */
const FORBIDDEN = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'ARK_API_KEY',
  'POSTHOG_KEY',
  'VITE_POSTHOG_KEY',
] as const

// eslint-disable-next-line no-restricted-syntax -- Must inspect raw keys before env.ts can initialize.
const configured = FORBIDDEN.filter((key) => process.env[key])
if (configured.length) {
  throw new Error(`[prowin] non-EU model/analytics keys must stay unset: ${configured.join(', ')}`)
}

// eslint-disable-next-line no-restricted-syntax -- Provider selection must fail before env.ts initializes.
const provider = process.env.DOOP_AGENT_PROVIDER
if (provider === 'azure' || provider === 'anthropic') {
  throw new Error('[prowin] DOOP_AGENT_PROVIDER must use requesty; direct server model providers are disabled')
}
