import { bool, cleanEnv, EnvMissingError, makeExactValidator, port, str } from 'envalid'
import type { ReporterOptions } from 'envalid'

/**
 * Every environment variable the server reads, declared once with its type
 * and default and parsed at boot. A bad value (a port that is not a number, a
 * boolean that is neither true nor false, a missing production secret) fails
 * the process on startup with a message naming the variable, instead of
 * surfacing later as odd behaviour on whichever request first touches it.
 *
 * Call sites read `env.X` and get a typed value. Keep reads where they are:
 * a module-level constant stays module-level, a read inside a function stays
 * inside the function — the second kind is what lets unit tests flip a
 * variable at runtime (see tests/envStub.ts).
 *
 * `.env.example` is the human-facing documentation; tests/env.test.ts checks
 * that every key declared here is listed there.
 */

/* ------------------------------------------------------------------ */
/* custom validators                                                   */
/* ------------------------------------------------------------------ */

/** An absolute http(s) URL with any trailing slash removed, so call sites
 *  can append paths without producing `//`. */
const origin = makeExactValidator<string>((input) => {
  let parsed: URL
  try {
    parsed = new URL(input)
  } catch {
    throw new TypeError(`Invalid URL: "${input}"`)
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new TypeError(`Invalid URL (expected http or https): "${input}"`)
  }
  return input.replace(/\/+$/, '')
})

/** Comma-separated values, trimmed, empties dropped. */
const list = makeExactValidator<string[]>((input) =>
  input
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const int = (minimum: number) =>
  makeExactValidator<number>((input) => {
    const n = Number(input)
    if (!Number.isInteger(n) || n < minimum) throw new TypeError(`Invalid integer (expected >= ${minimum}): "${input}"`)
    return n
  })

/** A per-minute cap: 0 would refuse every call, so the floor is 1. */
const perMinute = int(1)
const nonNegativeInt = int(0)

/* ------------------------------------------------------------------ */
/* schema                                                              */
/* ------------------------------------------------------------------ */

const schema = {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 4400 }),
  /* unset = embedded Postgres (PGlite) under ./data/pg */
  DATABASE_URL: str({ default: undefined }),

  /* ---------------------------------------------------------- auth */
  BETTER_AUTH_SECRET: str({
    devDefault: 'doop-dev-secret-not-for-production',
    desc: 'Signs sessions and OAuth tokens; must be set in production',
  }),
  BETTER_AUTH_URL: origin({
    devDefault: 'http://localhost:4300',
    desc: 'The public origin, e.g. https://doop.app; must be set in production',
  }),
  TRUSTED_ORIGINS: list({ default: [] }),
  SIGNUP_EMAIL_DOMAINS: list({ default: [] }),
  ADMIN_EMAILS: list({ default: [] }),
  REQUIRE_EMAIL_VERIFICATION: bool({ default: true }),
  GOOGLE_CLIENT_ID: str({ default: undefined }),
  GOOGLE_CLIENT_SECRET: str({ default: undefined }),
  APPLE_CLIENT_ID: str({ default: undefined }),
  APPLE_CLIENT_SECRET: str({ default: undefined }),
  APPLE_APP_BUNDLE_IDENTIFIER: str({ default: undefined }),
  APPLE_JWKS_URL: str({ default: 'https://appleid.apple.com/auth/keys' }),

  /* --------------------------------------------------------- email */
  SMTP_HOST: str({ default: undefined }),
  SMTP_PORT: port({ default: 587 }),
  SMTP_USER: str({ default: undefined }),
  SMTP_PASS: str({ default: undefined }),
  SMTP_SECURE: bool({ default: false }),
  EMAIL_FROM: str({ default: 'doop <no-reply@localhost>' }),

  /* ------------------------------------------------------ webhooks */
  WEBHOOK_ALLOW_PRIVATE_URLS: bool({ default: false }),

  /* ------------------------------------------------ resident agents */
  DOOP_AGENT_PROVIDER: str({ choices: ['anthropic', 'azure', 'requesty'], default: 'requesty' }),
  REQUESTY_API_KEY: str({ default: undefined }),
  /* Operator-only, pinned to the verified EU router. Never a user fetch target. */
  REQUESTY_CHAT_URL: str({
    choices: ['https://router.eu.requesty.ai/v1/chat/completions'],
    default: 'https://router.eu.requesty.ai/v1/chat/completions',
  }),
  ANTHROPIC_API_KEY: str({ default: undefined }),
  AZURE_OPENAI_ENDPOINT: str({ default: undefined }),
  AZURE_OPENAI_API_KEY: str({ default: undefined }),
  AZURE_OPENAI_DEPLOYMENT: str({ default: undefined }),
  AZURE_OPENAI_API_VERSION: str({ default: undefined }),
  AZURE_OPENAI_REASONING_EFFORT: str({ default: undefined }),
  RESIDENT_TASK_LIMIT: nonNegativeInt({ default: 0 }),
  DOOP_AGENT_MODEL: str({ default: 'policy/prowin-layout-gen' }),
  DOOP_DISTILL_MODEL: str({ default: 'policy/prowin-text-gen' }),
  OPENAI_RESPONSES_URL: str({ default: 'https://api.openai.com/v1/responses' }),
  /* ------------------------------------------------ image generation */
  OPENAI_API_KEY: str({ default: undefined }),
  GEMINI_API_KEY: str({ default: undefined }),
  ARK_API_KEY: str({ default: undefined }),
  ARK_IMAGES_URL: str({ default: 'https://ark.ap-southeast.bytepluses.com/api/v3/images/generations' }),
  GEMINI_MODELS_URL: str({ default: 'https://generativelanguage.googleapis.com/v1beta/models' }),
  DOOP_IMAGE_MODEL: str({ default: 'gpt-image-2' }),
  DOOP_IMAGE_ROUTER_MODEL: str({ default: 'gpt-5.6-terra' }),

  /* ------------------------------------------------------ integrations */
  META_APP_ID: str({ default: undefined }),
  META_APP_SECRET: str({ default: undefined }),
  PEXELS_API_KEY: str({ default: undefined }),
  BRANDFETCH_CLIENT_ID: str({ default: undefined }),

  /* ------------------------------------------------- object storage */
  BUCKET: str({ default: undefined }),
  ACCESS_KEY_ID: str({ default: undefined }),
  SECRET_ACCESS_KEY: str({ default: undefined }),
  ENDPOINT: str({ default: undefined }),
  REGION: str({ default: 'auto' }),

  /* -------------------------------------------------------- billing */
  STRIPE_SECRET_KEY: str({ default: undefined }),
  STRIPE_WEBHOOK_SECRET: str({ default: undefined }),
  STRIPE_PRICE_TEAM_MONTHLY: str({ default: undefined }),
  STRIPE_PRICE_TEAM_YEARLY: str({ default: undefined }),

  /* ---------------------------------------------------- screenshots */
  CHROME_PATH: str({ default: undefined }),
  CHROME_NO_SANDBOX: bool({ default: false }),

  /* ---------------------------------------------------- backgrounds */
  BACKGROUNDS_ORIGIN: origin({ default: undefined }),

  /* ---------------------------------------------------- rate limits */
  MCP_UPLOADS_PER_MIN: perMinute({ default: 15 }),
  MCP_SEARCHES_PER_MIN: perMinute({ default: 12 }),
  MCP_GENERATIONS_PER_MIN: perMinute({ default: 6 }),
  PREVIEW_RENDERS_PER_MIN: perMinute({ default: 12 }),

  /* ------------------------------------------------------- iOS push */
  DOOP_APNS_TEAM_ID: str({ default: undefined }),
  DOOP_APNS_KEY_ID: str({ default: undefined }),
  DOOP_APNS_PRIVATE_KEY: str({ default: undefined }),
  DOOP_APNS_BUNDLE_ID: str({ default: 'design.doop.ios' }),
}

/** Every declared variable name, for the .env.example coverage test. */
export const ENV_KEYS: readonly string[] = Object.keys(schema)

/* ------------------------------------------------------------------ */
/* parsing                                                             */
/* ------------------------------------------------------------------ */

/** A variable set to the empty string (`X=` in a .env file, an empty
 *  compose `environment:` entry) means unset, not "the empty string":
 *  it takes the default like a missing variable would. */
function presentVars(source: NodeJS.ProcessEnv): Record<string, string> {
  const present: Record<string, string> = {}
  for (const [key, value] of Object.entries(source)) {
    if (value !== undefined && value.trim() !== '') present[key] = value
  }
  return present
}

/** Throws one error naming every bad variable, instead of envalid's default
 *  of printing and calling process.exit — an exception carries the message
 *  through tests and through whatever supervises the server process. */
function reporter({ errors }: ReporterOptions<unknown>): void {
  const lines = Object.entries(errors).map(([key, error]) => {
    if (!(error instanceof Error)) return `  ${key}: invalid`
    if (error instanceof EnvMissingError) return `  ${key}: missing${error.message ? ` (${error.message})` : ''}`
    return `  ${key}: ${error.message}`
  })
  if (lines.length) throw new Error(`Invalid environment configuration:\n${lines.join('\n')}`)
}

function parse() {
  const source = presentVars(process.env)
  /* envalid applies devDefault only when NODE_ENV is explicitly set to
     something other than production; doop treats an unset NODE_ENV as
     development (bun run dev, the test harness), so say so */
  source.NODE_ENV ??= 'development'
  /* Keep the existing model default for explicitly selected legacy installs. */
  if (source.DOOP_AGENT_PROVIDER === 'anthropic') source.DOOP_AGENT_MODEL ??= 'claude-opus-5'
  return cleanEnv(source, schema, { reporter })
}

export type Env = ReturnType<typeof parse>

/* `let` so reloadEnv can swap the snapshot; ESM live bindings mean every
   importer sees the new one. Nothing outside this file assigns it. */
export let env: Env = parse()

/** Re-read process.env. For tests that change a variable after import;
 *  the server itself parses once at boot. */
export function reloadEnv(): void {
  env = parse()
}
