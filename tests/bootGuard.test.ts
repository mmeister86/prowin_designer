import { execFile } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { startServer } from './harness.ts'

const forbidden = [
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'ARK_API_KEY',
  'POSTHOG_KEY',
  'VITE_POSTHOG_KEY',
] as const
const emptyKeys = Object.fromEntries(forbidden.map((key) => [key, '']))
const run = promisify(execFile)
const root = process.cwd()

async function rejectedBoot(keys: Record<string, string>) {
  const dir = mkdtempSync(path.join(tmpdir(), 'prowin-guard-'))
  try {
    const result = await run(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), path.join(root, 'server/index.ts')],
      {
        cwd: dir,
        env: {
          ...process.env,
          ...emptyKeys,
          DATABASE_URL: '',
          // A configuration error must not mask the guard: it runs before env.ts.
          PORT: 'invalid-port-sentinel',
          ...keys,
        },
        timeout: 15_000,
      },
    ).then(
      (output) => ({ ...output, code: 0, killed: false }),
      (error: Error & { stdout: string; stderr: string; code: number; killed: boolean }) => error,
    )
    expect(result.killed).toBe(false)
    expect(result.code).toBe(1)
    expect(existsSync(path.join(dir, 'data'))).toBe(false)
    return result.stdout + result.stderr
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

it.each(forbidden)('rejects %s before environment parsing or provider initialization', async (key) => {
  const secret = `synthetic-${key}-must-not-appear`
  const output = await rejectedBoot({ [key]: secret })
  expect(output).toContain('[prowin] non-EU model/analytics keys must stay unset: ' + key)
  expect(output).not.toContain(secret)
  expect(output).not.toContain('invalid-port-sentinel')
})

it('reports every forbidden variable without exposing any values', async () => {
  const keys = Object.fromEntries(forbidden.map((key) => [key, `synthetic-secret-${key}`]))
  const output = await rejectedBoot(keys)
  expect(output).toContain(forbidden.join(', '))
  for (const secret of Object.values(keys)) expect(output).not.toContain(secret)
})

it.each([' ', '0'])('rejects a nonempty forbidden value %j', async (value) => {
  expect(await rejectedBoot({ OPENAI_API_KEY: value })).toContain(
    '[prowin] non-EU model/analytics keys must stay unset: OPENAI_API_KEY',
  )
})

it.each(['azure', 'anthropic'])('rejects direct server provider %s before environment parsing', async (provider) => {
  const output = await rejectedBoot({
    DOOP_AGENT_PROVIDER: provider,
    AZURE_OPENAI_ENDPOINT: 'https://synthetic-azure-endpoint.openai.azure.com',
    AZURE_OPENAI_DEPLOYMENT: 'synthetic-deployment-secret',
    AZURE_OPENAI_API_KEY: 'synthetic-azure-secret',
  })
  expect(output).toContain('[prowin] DOOP_AGENT_PROVIDER must use requesty')
  expect(output).not.toContain('invalid-port-sentinel')
  expect(output).not.toMatch(/synthetic-azure|synthetic-deployment/)
})

it.each(['requesty', '', ' '])(
  'boots normally with provider %j and empty forbidden keys',
  async (provider) => {
    const server = await startServer({
      ...emptyKeys,
      DOOP_AGENT_PROVIDER: provider,
      REQUESTY_API_KEY: 'synthetic-requesty-allowed',
      RESIDENT_TASK_LIMIT: '0',
    })
    try {
      expect((await fetch(server.base + '/healthz')).status).toBe(200)
    } finally {
      server.stop()
      await server.stopped
    }
  },
  30_000,
)
