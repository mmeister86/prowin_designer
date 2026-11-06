/**
 * Opt-in verification probe for the official Magnific One API.
 *
 * Defaults to a dry run: no network, no key file. A live run needs all three
 * flags (`--live --ack-cost --key-file <path>`) and sends exactly one
 * generation POST. It polls only that task, never retries, never follows
 * redirects and never downloads the generated image.
 *
 * Usage: bunx tsx scripts/magnific-probe.ts [--live --ack-cost --key-file <path>]
 *
 * Source: https://docs.magnific.com/api-reference/text-to-image/magnific-one/generate
 * and the OpenAPI document linked there (fetched 2026-11-06).
 */

import { readFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'

const BASE_URL = 'https://api.magnific.com'
const GENERATE_URL = `${BASE_URL}/v1/ai/magnific-one`
const PROMPT =
  'Bright tidy kitchen, soft daylight, empty worktop and quiet left text area; no products; no text, no letters, no logos, no watermarks'

const POLL_INTERVAL_MS = 5_000
const REQUEST_TIMEOUT_MS = 30_000
const OVERALL_DEADLINE_MS = 180_000
const MAX_POLLS = 30
const MAX_RESPONSE_BYTES = 64 * 1024

const KNOWN_STATUSES = new Set(['CREATED', 'IN_PROGRESS', 'COMPLETED', 'FAILED'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface ProbeOptions {
  live?: boolean
  ackCost?: boolean
  key?: string
  fetchImpl?: typeof fetch
  now?: () => number
  sleep?: (ms: number) => Promise<void>
}

export interface ProbeEvidence {
  ok: true
  mode: 'dry-run' | 'live'
  classification: 'local-dry-run' | 'local-mock' | 'live-observation'
  timestamp: string
  request: {
    endpoint: string
    prompt: string
    mode: 'quality'
    quality: 'medium'
    resolution: '1k'
    aspect_ratio: '1:1'
  }
  httpStatuses: number[]
  statuses: string[]
  generatedCount: number
  taskId?: string
}

export class ProbeError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'ProbeError'
    this.code = code
  }
}

const REQUEST: ProbeEvidence['request'] = {
  endpoint: GENERATE_URL,
  prompt: PROMPT,
  mode: 'quality',
  quality: 'medium',
  resolution: '1k',
  aspect_ratio: '1:1',
}

interface HttpResponse {
  status: number
  ok: boolean
  text: string
}

interface TaskSnapshot {
  taskId: string
  status: string
  generated: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

function parseTask(text: string): TaskSnapshot {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new ProbeError('invalid-json')
  }
  if (!isRecord(value) || !isRecord(value.data)) throw new ProbeError('invalid-schema')

  const { task_id: taskId, status, generated } = value.data
  if (
    typeof taskId !== 'string' ||
    typeof status !== 'string' ||
    !Array.isArray(generated) ||
    !generated.every((item): item is string => typeof item === 'string')
  ) {
    throw new ProbeError('invalid-schema')
  }
  if (!UUID.test(taskId)) throw new ProbeError('invalid-task-id')
  if (!KNOWN_STATUSES.has(status)) throw new ProbeError('unknown-status')
  if (!generated.every(isHttpsUrl)) throw new ProbeError('invalid-result')
  if (status === 'COMPLETED' && generated.length === 0) throw new ProbeError('missing-result')

  return { taskId, status, generated }
}

async function requestText(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutCode: 'timeout' | 'deadline',
): Promise<HttpResponse> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const expired = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      reject(new ProbeError(timeoutCode))
      controller.abort()
    }, timeoutMs)
  })
  const work = (async () => {
    const response = await fetchImpl(url, { ...init, signal: controller.signal })
    const chunks: Uint8Array[] = []
    let bytes = 0
    const reader = response.body?.getReader()
    if (reader) {
      try {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          bytes += value.byteLength
          if (bytes > MAX_RESPONSE_BYTES) {
            controller.abort()
            void reader.cancel().catch(() => {})
            throw new ProbeError('response-too-large')
          }
          chunks.push(value)
        }
      } finally {
        reader.releaseLock()
      }
    }
    return { status: response.status, ok: response.ok, text: Buffer.concat(chunks).toString('utf8') }
  })()
  try {
    return await Promise.race([work, expired])
  } catch (error) {
    if (error instanceof ProbeError) throw error
    throw new ProbeError(controller.signal.aborted ? timeoutCode : 'network')
  } finally {
    clearTimeout(timer)
  }
}

function requestTimeout(deadline: number, now: number): { ms: number; code: 'timeout' | 'deadline' } {
  const remaining = deadline - now
  if (remaining <= 0) throw new ProbeError('deadline')
  return { ms: Math.min(REQUEST_TIMEOUT_MS, remaining), code: remaining <= REQUEST_TIMEOUT_MS ? 'deadline' : 'timeout' }
}

function dryRunEvidence(now: number): ProbeEvidence {
  return {
    ok: true,
    mode: 'dry-run',
    classification: 'local-dry-run',
    timestamp: new Date(now).toISOString(),
    request: REQUEST,
    httpStatuses: [],
    statuses: [],
    generatedCount: 0,
  }
}

export async function runProbe(options: ProbeOptions = {}): Promise<ProbeEvidence> {
  const now = options.now ?? (() => performance.timeOrigin + performance.now())
  if (!options.live) return dryRunEvidence(now())

  if (!options.ackCost) throw new ProbeError('cost-not-acknowledged')
  const key = options.key?.trim()
  if (!key) throw new ProbeError('missing-key')

  const fetchImpl = options.fetchImpl ?? fetch
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const startedAt = now()
  const deadline = startedAt + OVERALL_DEADLINE_MS

  const headers = { accept: 'application/json', 'content-type': 'application/json', 'x-magnific-api-key': key }
  const postTimeout = requestTimeout(deadline, now())
  const post = await requestText(
    fetchImpl,
    GENERATE_URL,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        prompt: PROMPT,
        mode: 'quality',
        quality: 'medium',
        resolution: '1k',
        aspect_ratio: '1:1',
      }),
      redirect: 'error',
    },
    postTimeout.ms,
    postTimeout.code,
  )
  if (!post.ok) throw new ProbeError(`http-${post.status}`)

  const created = parseTask(post.text)
  const evidence: ProbeEvidence = {
    ok: true,
    mode: 'live',
    classification: options.fetchImpl ? 'local-mock' : 'live-observation',
    timestamp: new Date(startedAt).toISOString(),
    request: REQUEST,
    httpStatuses: [post.status],
    statuses: [created.status],
    generatedCount: created.generated.length,
    taskId: created.taskId,
  }
  if (created.status === 'FAILED') throw new ProbeError('failed')
  if (created.status === 'COMPLETED') return evidence

  const pollUrl = `${BASE_URL}/v1/ai/magnific-one/${created.taskId}`
  for (let polls = 0; ; polls += 1) {
    if (polls >= MAX_POLLS) throw new ProbeError('poll-limit')
    const remaining = deadline - now()
    if (remaining <= 0) throw new ProbeError('deadline')
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([
        sleep(Math.min(POLL_INTERVAL_MS, remaining)),
        new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => reject(new ProbeError('deadline')), remaining)
        }),
      ])
    } finally {
      clearTimeout(timer)
    }
    if (now() >= deadline) throw new ProbeError('deadline')

    const timeout = requestTimeout(deadline, now())
    const poll = await requestText(
      fetchImpl,
      pollUrl,
      { method: 'GET', headers: { accept: 'application/json', 'x-magnific-api-key': key }, redirect: 'error' },
      timeout.ms,
      timeout.code,
    )
    if (!poll.ok) throw new ProbeError(`http-${poll.status}`)

    const snapshot = parseTask(poll.text)
    if (snapshot.taskId !== created.taskId) throw new ProbeError('task-mismatch')
    evidence.httpStatuses.push(poll.status)
    evidence.statuses.push(snapshot.status)
    if (snapshot.status === 'FAILED') throw new ProbeError('failed')
    if (snapshot.status === 'COMPLETED') {
      evidence.generatedCount = snapshot.generated.length
      return evidence
    }
  }
}

type CliOptions = { live: false } | { live: true; keyFile: string }

function parseArgs(args: string[]): CliOptions {
  if (args.length === 0) return { live: false }

  const allowed = new Set(['--live', '--ack-cost', '--key-file'])
  const seen = new Set<string>()
  let keyFile: string | undefined
  let live = false
  let ackCost = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]!
    if (!allowed.has(arg) || seen.has(arg)) throw new ProbeError('invalid-arguments')
    seen.add(arg)
    if (arg === '--live') live = true
    if (arg === '--ack-cost') ackCost = true
    if (arg === '--key-file') {
      const value = args[index + 1]
      if (value === undefined || value.startsWith('--')) throw new ProbeError('invalid-arguments')
      keyFile = value
      index += 1
    }
  }

  if (!live) {
    if (ackCost || keyFile !== undefined) throw new ProbeError('invalid-arguments')
    return { live: false }
  }
  if (!ackCost || keyFile === undefined) throw new ProbeError('invalid-arguments')
  return { live: true, keyFile }
}

function writeEvidence(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

export async function main(args: string[]): Promise<number> {
  let options: CliOptions
  try {
    options = parseArgs(args)
  } catch {
    writeEvidence({ ok: false, error: 'invalid-arguments' })
    return 2
  }

  try {
    let key: string | undefined
    if (options.live) {
      try {
        key = (await readFile(options.keyFile, 'utf8')).trim()
      } catch {
        throw new ProbeError('missing-key')
      }
    }
    const evidence = await runProbe({ live: options.live, ackCost: options.live, key })
    writeEvidence(evidence)
    return 0
  } catch (error) {
    writeEvidence({ ok: false, error: error instanceof ProbeError ? error.code : 'error' })
    return 1
  }
}

const entry = process.argv[1]
if (entry && import.meta.url === pathToFileURL(entry).href) {
  process.exitCode = await main(process.argv.slice(2))
}
