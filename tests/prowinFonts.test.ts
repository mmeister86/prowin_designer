import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { startServer, type Server } from './harness.ts'

const ROOT = process.cwd()
const CORE_FONTS = [
  { package: 'sofia-sans', weights: [300, 500] },
  { package: 'sofia-sans-condensed', weights: [700] },
  { package: 'roboto', weights: [300, 500, 900] },
] as const
const SUBSETS = ['latin', 'latin-ext'] as const
const fontFiles = CORE_FONTS.flatMap(({ package: family, weights }) =>
  weights.flatMap((weight) =>
    SUBSETS.map((subset) => ({ family, file: `${family}-${subset}-${weight}-normal.woff2` })),
  ),
)

describe('proWIN core font assets', () => {
  it('ships the exact pinned Latin and Latin-Ext WOFF2 sources with their licenses', () => {
    expect(fontFiles).toHaveLength(12)
    for (const { family, file } of fontFiles) {
      const publicBytes = readFileSync(path.join(ROOT, 'public', 'fonts', file))
      const sourceBytes = readFileSync(path.join(ROOT, 'node_modules', '@fontsource', family, 'files', file))
      expect(publicBytes.subarray(0, 4).toString('ascii'), file).toBe('wOF2')
      expect(publicBytes.equals(sourceBytes), file).toBe(true)
    }
    for (const { package: family } of CORE_FONTS) {
      const license = readFileSync(path.join(ROOT, 'public', 'fonts', `${family}-LICENSE`), 'utf8')
      expect(license).toContain('SIL OPEN FONT LICENSE')
    }
  })

  it('ships the user-supplied LT Kai WOFF2 next to its OFL license', () => {
    const bytes = readFileSync(path.join(ROOT, 'public', 'fonts', 'lt-kai-latin-400-normal.woff2'))
    expect(bytes.subarray(0, 4).toString('ascii')).toBe('wOF2')
    expect(readFileSync(path.join(ROOT, 'public', 'fonts', 'lt-kai-LICENSE'), 'utf8')).toContain(
      'SIL OPEN FONT LICENSE',
    )
  })

  it('ships the Kaushan Script placeholder with byte-identical Fontsource files', () => {
    for (const subset of ['latin', 'latin-ext']) {
      const file = `kaushan-script-${subset}-400-normal.woff2`
      const publicBytes = readFileSync(path.join(ROOT, 'public', 'fonts', file))
      expect(publicBytes.subarray(0, 4).toString('ascii'), file).toBe('wOF2')
      expect(
        publicBytes.equals(
          readFileSync(path.join(ROOT, 'node_modules', '@fontsource', 'kaushan-script', 'files', file)),
        ),
        file,
      ).toBe(true)
    }
    expect(readFileSync(path.join(ROOT, 'public', 'fonts', 'kaushan-script-LICENSE'), 'utf8')).toContain(
      'SIL OPEN FONT LICENSE',
    )
  })
})

describe('proWIN font delivery', () => {
  let server: Server
  let vite: ViteDevServer
  let previousPort: string | undefined

  beforeAll(async () => {
    server = await startServer()
    previousPort = process.env.PORT
    process.env.PORT = String(server.port)
    vite = await createServer({
      cacheDir: path.join(server.dataDir, 'vite-cache'),
      server: { port: 0 },
      logLevel: 'error',
    })
    await vite.listen()
  }, 60_000)

  afterAll(async () => {
    await vite?.close()
    server?.stop()
    await server?.stopped
    if (previousPort === undefined) delete process.env.PORT
    else process.env.PORT = previousPort
  })

  it('serves an unchanged WOFF2 through the real Vite proxy with CORS', async () => {
    const file = 'roboto-latin-ext-900-normal.woff2'
    const origin = vite.resolvedUrls!.local[0]!
    const response = await fetch(`${origin}fonts/${file}`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('font/woff2')
    expect(response.headers.get('access-control-allow-origin')).toBe('*')
    expect(
      Buffer.from(await response.arrayBuffer()).equals(readFileSync(path.join(ROOT, 'public', 'fonts', file))),
    ).toBe(true)
  })
})
