import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { main, runProbe } from '../scripts/magnific-probe.ts'

const TASK_ID = '046b6c7f-0b8a-43b9-b35d-6489e6daee91'
const OTHER_ID = '11111111-1111-4111-8111-111111111111'
const KEY = 'synthetic-magnific-key-must-not-leak'
const RESULT_URL = 'https://example.invalid/generated-image.jpg'
const SERVER_BODY = 'raw-server-body-must-not-leak'
const POST_URL = 'https://api.magnific.com/v1/ai/magnific-one'
const POLL_URL = `https://api.magnific.com/v1/ai/magnific-one/${TASK_ID}`
const PROMPT =
  'Bright tidy kitchen, soft daylight, empty worktop and quiet left text area; no products; no text, no letters, no logos, no watermarks'

const run = promisify(execFile)
const root = process.cwd()
const noSleep = async () => {}

interface Call {
  url: string
  init: RequestInit
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function task(status: string, generated: string[] = [], id = TASK_ID) {
  return jsonResponse({ data: { task_id: id, status, generated } })
}

function fakeFetch(handler: (call: Call) => Response | Promise<Response>) {
  const calls: Call[] = []
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const call = { url: String(input), init: init ?? {} }
    calls.push(call)
    return handler(call)
  }) as unknown as typeof fetch
  return { impl, calls }
}

function options(overrides: Record<string, unknown> = {}) {
  return {
    live: true,
    ackCost: true,
    key: KEY,
    sleep: noSleep,
    ...overrides,
  }
}

async function expectCode(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ code })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('gates', () => {
  it('dry run returns local evidence without fetching or reading a key', async () => {
    const { impl, calls } = fakeFetch(() => task('CREATED'))
    const evidence = await runProbe({ fetchImpl: impl })

    expect(calls).toHaveLength(0)
    expect(evidence).toMatchObject({
      ok: true,
      mode: 'dry-run',
      classification: 'local-dry-run',
      httpStatuses: [],
      statuses: [],
      generatedCount: 0,
    })
    expect(evidence.request).toEqual({
      endpoint: POST_URL,
      prompt: PROMPT,
      mode: 'quality',
      quality: 'medium',
      resolution: '1k',
      aspect_ratio: '1:1',
    })
    expect(JSON.stringify(evidence)).not.toContain(KEY)
  })

  it('live run without cost acknowledgement does not fetch', async () => {
    const { impl, calls } = fakeFetch(() => task('CREATED'))
    await expectCode(runProbe(options({ ackCost: false, fetchImpl: impl })), 'cost-not-acknowledged')
    expect(calls).toHaveLength(0)
  })

  it('live run without a key does not fetch', async () => {
    const { impl, calls } = fakeFetch(() => task('CREATED'))
    await expectCode(runProbe(options({ key: '   ', fetchImpl: impl })), 'missing-key')
    expect(calls).toHaveLength(0)
  })
})

describe('happy path', () => {
  it('sends exactly one documented POST and polls only the created task', async () => {
    let polls = 0
    const { impl, calls } = fakeFetch((call) => {
      if (call.url === POST_URL) return task('CREATED')
      polls += 1
      return polls === 1 ? task('IN_PROGRESS') : task('COMPLETED', [RESULT_URL])
    })

    const evidence = await runProbe(options({ fetchImpl: impl, now: () => Date.parse('2026-11-06T12:00:00Z') }))

    expect(calls).toHaveLength(3)
    const [post, ...gets] = calls
    expect(post).toBeDefined()
    expect(post!.url).toBe(POST_URL)
    expect(post!.init.method).toBe('POST')
    expect(post!.init.redirect).toBe('error')
    expect(post!.init.headers).toEqual({
      accept: 'application/json',
      'content-type': 'application/json',
      'x-magnific-api-key': KEY,
    })
    expect(JSON.parse(String(post!.init.body))).toEqual({
      prompt: PROMPT,
      mode: 'quality',
      quality: 'medium',
      resolution: '1k',
      aspect_ratio: '1:1',
    })
    for (const get of gets) {
      expect(get.url).toBe(POLL_URL)
      expect(get.init.method).toBe('GET')
      expect(get.init.redirect).toBe('error')
      expect(get.init.headers).toMatchObject({ 'x-magnific-api-key': KEY })
      expect(get.init.body).toBeUndefined()
    }

    expect(evidence).toMatchObject({
      ok: true,
      mode: 'live',
      classification: 'local-mock',
      timestamp: '2026-11-06T12:00:00.000Z',
      taskId: TASK_ID,
      httpStatuses: [200, 200, 200],
      statuses: ['CREATED', 'IN_PROGRESS', 'COMPLETED'],
      generatedCount: 1,
    })
    const serialized = JSON.stringify(evidence)
    expect(serialized).not.toContain(KEY)
    expect(serialized).not.toContain(RESULT_URL)
    expect(serialized).not.toContain(SERVER_BODY)
  })
})

describe('failures', () => {
  it.each(['CREATED', 'COMPLETED'])('rejects a UUID-shaped key echoed as task_id in %s', async (status) => {
    const { impl, calls } = fakeFetch(() => task(status, status === 'COMPLETED' ? [RESULT_URL] : []))
    const error = await runProbe(options({ key: TASK_ID, fetchImpl: impl })).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'secret-in-task-id' })
    expect(JSON.stringify(error)).not.toContain(TASK_ID)
    expect(calls).toHaveLength(1)
  })

  it('retains sanitized job evidence after a poll HTTP failure', async () => {
    const { impl, calls } = fakeFetch((call) =>
      call.url === POST_URL ? task('CREATED') : new Response(`${SERVER_BODY} ${KEY}`, { status: 429 }),
    )
    const error = await runProbe(options({ fetchImpl: impl })).catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      code: 'http-429',
      evidence: {
        ok: false,
        taskId: TASK_ID,
        submission: 'created',
        classification: 'local-mock',
        httpStatuses: [200, 429],
        statuses: ['CREATED'],
        generatedCount: 0,
      },
    })
    expect(JSON.stringify(error)).not.toContain(KEY)
    expect(JSON.stringify(error)).not.toContain(SERVER_BODY)
    expect(calls).toHaveLength(2)
  })

  it('marks an ambiguous failed POST unconfirmed without retrying', async () => {
    const { impl, calls } = fakeFetch(() => {
      throw new Error(KEY)
    })
    const error = await runProbe(options({ fetchImpl: impl })).catch((caught: unknown) => caught)
    expect(error).toMatchObject({
      code: 'network',
      evidence: {
        ok: false,
        submission: 'unconfirmed',
        httpStatuses: [],
        statuses: [],
      },
    })
    expect(JSON.stringify(error)).not.toContain(KEY)
    expect(calls).toHaveLength(1)
  })

  it('rejects oversized upstream bodies without exposing their contents', async () => {
    const { impl, calls } = fakeFetch(() => new Response(SERVER_BODY.repeat(4_000)))
    const error = await runProbe(options({ fetchImpl: impl })).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'response-too-large' })
    expect(String(error)).not.toContain(SERVER_BODY)
    expect(calls).toHaveLength(1)
  })

  it('reports a terminal FAILED task without fetching a result', async () => {
    const { impl, calls } = fakeFetch((call) => (call.url === POST_URL ? task('CREATED') : task('FAILED')))
    await expect(runProbe(options({ fetchImpl: impl }))).rejects.toMatchObject({
      code: 'failed',
      evidence: { ok: false, taskId: TASK_ID, statuses: ['CREATED', 'FAILED'] },
    })
    expect(calls).toHaveLength(2)
  })

  it.each([400, 401, 403, 429, 500, 503])('maps a POST HTTP %i to a fixed code', async (status) => {
    const { impl, calls } = fakeFetch(() => new Response(SERVER_BODY, { status }))
    const error = await runProbe(options({ fetchImpl: impl })).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: `http-${status}` })
    expect(String(error)).not.toContain(SERVER_BODY)
    expect(String(error)).not.toContain(KEY)
    expect(calls).toHaveLength(1)
  })

  it('fails a poll HTTP error after the successful POST', async () => {
    const { impl, calls } = fakeFetch((call) =>
      call.url === POST_URL ? task('CREATED') : new Response(SERVER_BODY, { status: 429 }),
    )
    await expectCode(runProbe(options({ fetchImpl: impl })), 'http-429')
    expect(calls).toHaveLength(2)
  })

  it('rejects a non-JSON body with a fixed code', async () => {
    const { impl } = fakeFetch(() => new Response(SERVER_BODY, { status: 200 }))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'invalid-json')
  })

  it.each([
    { name: 'missing data', body: {} },
    { name: 'generated is not an array', body: { data: { task_id: TASK_ID, status: 'CREATED', generated: 'x' } } },
    { name: 'missing status', body: { data: { task_id: TASK_ID, generated: [] } } },
  ])('rejects schema violation: $name', async ({ body }) => {
    const { impl } = fakeFetch(() => jsonResponse(body))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'invalid-schema')
  })

  it('rejects a malformed task id before constructing a poll URL', async () => {
    const { impl, calls } = fakeFetch(() => task('CREATED', [], 'not-a-uuid'))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'invalid-task-id')
    expect(calls).toHaveLength(1)
  })

  it('rejects a poll response for a different task', async () => {
    const { impl } = fakeFetch((call) => (call.url === POST_URL ? task('CREATED') : task('IN_PROGRESS', [], OTHER_ID)))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'task-mismatch')
  })

  it('rejects an unknown task status', async () => {
    const { impl } = fakeFetch(() => task('QUEUED'))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'unknown-status')
  })

  it('rejects completion without a result URL', async () => {
    const { impl } = fakeFetch((call) => (call.url === POST_URL ? task('CREATED') : task('COMPLETED')))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'missing-result')
  })

  it.each(['http://example.invalid/image.jpg', 'not a url', ''])(
    'rejects a non-HTTPS completed result %j',
    async (url) => {
      const { impl } = fakeFetch((call) => (call.url === POST_URL ? task('CREATED') : task('COMPLETED', [url])))
      await expectCode(runProbe(options({ fetchImpl: impl })), 'invalid-result')
    },
  )

  it('fails safely on a network error without leaking the key', async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError(`fetch failed for ${KEY}`)
    })
    const error = await runProbe(options({ fetchImpl: impl })).catch((caught: unknown) => caught)
    expect(error).toMatchObject({ code: 'network' })
    expect(String(error)).not.toContain(KEY)
  })

  it('fails safely when a redirect is rejected by fetch', async () => {
    const { impl } = fakeFetch(() => {
      throw new TypeError('redirect mode is error')
    })
    await expectCode(runProbe(options({ fetchImpl: impl })), 'network')
  })
})

describe('time bounds', () => {
  it('caps the poll pause at the remaining overall deadline', async () => {
    let clock = 0
    const waits: number[] = []
    const { impl, calls } = fakeFetch(() => {
      clock = 179_000
      return task('CREATED')
    })
    await expectCode(
      runProbe(
        options({
          fetchImpl: impl,
          now: () => clock,
          sleep: async (ms: number) => {
            waits.push(ms)
            clock += ms
          },
        }),
      ),
      'deadline',
    )
    expect(waits).toEqual([1_000])
    expect(clock).toBe(180_000)
    expect(calls).toHaveLength(1)
  })

  it('bounds a stalled poll pause by the remaining deadline', async () => {
    vi.useFakeTimers()
    let clock = 0
    const { impl, calls } = fakeFetch(() => {
      clock = 179_000
      return task('CREATED')
    })
    const pending = expectCode(
      runProbe(options({ fetchImpl: impl, now: () => clock, sleep: () => new Promise<void>(() => {}) })),
      'deadline',
    )
    await vi.advanceTimersByTimeAsync(1_000)
    await pending
    expect(calls).toHaveLength(1)
  })

  it('stops after 30 GET polls', async () => {
    const { impl, calls } = fakeFetch((call) => (call.url === POST_URL ? task('CREATED') : task('IN_PROGRESS')))
    await expectCode(runProbe(options({ fetchImpl: impl })), 'poll-limit')
    expect(calls).toHaveLength(31)
    expect(calls.filter((call) => call.url === POLL_URL)).toHaveLength(30)
  })

  it('stops at the overall deadline even when the poll cap is not reached', async () => {
    let clock = 0
    const { impl, calls } = fakeFetch((call) => (call.url === POST_URL ? task('CREATED') : task('IN_PROGRESS')))
    await expectCode(
      runProbe(
        options({
          fetchImpl: impl,
          now: () => clock,
          sleep: async (ms: number) => {
            clock += ms * 2
          },
        }),
      ),
      'deadline',
    )
    expect(calls.length).toBeLessThan(31)
  })

  it('bounds a stalled request body with the per-request timeout', async () => {
    vi.useFakeTimers()
    const { impl } = fakeFetch(() => new Response(new ReadableStream()))
    const pending = expectCode(runProbe(options({ fetchImpl: impl })), 'timeout')
    await vi.advanceTimersByTimeAsync(30_000)
    await pending
  })

  it('does not extend the deadline for a stalled request body', async () => {
    vi.useFakeTimers()
    let clockCalls = 0
    const { impl } = fakeFetch(() => new Response(new ReadableStream()))
    const pending = expectCode(
      runProbe(options({ fetchImpl: impl, now: () => (clockCalls++ === 0 ? 0 : 170_000) })),
      'deadline',
    )
    await vi.advanceTimersByTimeAsync(10_000)
    await pending
  })
})

describe('CLI', () => {
  it('prints partial job evidence with a nonzero exit after a poll failure', async () => {
    const directory = await mkdtemp('/tmp/opencode/magnific-probe-')
    const keyFile = path.join(directory, 'synthetic-key')
    const output: string[] = []
    const { impl, calls } = fakeFetch((call) =>
      call.url === POST_URL ? task('CREATED') : new Response(SERVER_BODY, { status: 503 }),
    )
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output.push(String(chunk))
      return true
    })
    try {
      await writeFile(keyFile, KEY)
      vi.stubGlobal('fetch', impl)
      expect(await main(['--live', '--ack-cost', '--key-file', keyFile])).toBe(1)
    } finally {
      spy.mockRestore()
      await rm(directory, { recursive: true, force: true })
    }
    expect(JSON.parse(output.join(''))).toMatchObject({
      ok: false,
      error: 'http-503',
      evidence: {
        ok: false,
        submission: 'created',
        taskId: TASK_ID,
        httpStatuses: [200, 503],
        statuses: ['CREATED'],
      },
    })
    expect(output.join('')).not.toContain(KEY)
    expect(output.join('')).not.toContain(SERVER_BODY)
    expect(calls).toHaveLength(2)
  }, 15_000)

  async function cli(args: string[]) {
    return run(
      process.execPath,
      ['--import', import.meta.resolve('tsx'), path.join(root, 'scripts/magnific-probe.ts'), ...args],
      {
        cwd: root,
        timeout: 20_000,
      },
    ).then(
      (output) => ({ ...output, code: 0 }),
      (error: Error & { stdout: string; stderr: string; code: number }) => error,
    )
  }

  it('runs a dry-run by default and prints whitelisted JSON', async () => {
    const result = await cli([])
    expect(result.code).toBe(0)
    const evidence = JSON.parse(result.stdout)
    expect(evidence).toMatchObject({ ok: true, mode: 'dry-run', httpStatuses: [], generatedCount: 0 })
    expect(result.stdout).not.toContain('api-key')
  })

  it.each([['--bogus'], ['--ack-cost'], ['--key-file', '/nonexistent/key']])(
    'rejects unknown or partial flags %j before any live action',
    async (...args) => {
      const result = await cli(args)
      expect(result.code).not.toBe(0)
      expect(JSON.parse(result.stdout)).toEqual({ ok: false, error: 'invalid-arguments' })
    },
  )

  it('rejects a live run without cost acknowledgement before reading the key file', async () => {
    const result = await cli(['--live', '--key-file', '/nonexistent/key'])
    expect(result.code).not.toBe(0)
    expect(JSON.parse(result.stdout)).toEqual({ ok: false, error: 'invalid-arguments' })
  })

  it('main writes evidence through the same contract', async () => {
    const output: string[] = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      output.push(String(chunk))
      return true
    })
    try {
      expect(await main([])).toBe(0)
    } finally {
      spy.mockRestore()
    }
    expect(JSON.parse(output.join(''))).toMatchObject({ ok: true, mode: 'dry-run' })
  })
})
