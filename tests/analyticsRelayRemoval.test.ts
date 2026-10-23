import { createServer } from 'node:http'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { startServer, type Server } from './harness'

let server: Server
const forwarded: string[] = []
const upstream = createServer((req, res) => {
  forwarded.push(req.url ?? '')
  res.end('unexpected analytics relay')
})

beforeAll(async () => {
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const address = upstream.address()
  if (!address || typeof address === 'string') throw new Error('Expected TCP listener')
  const host = `http://127.0.0.1:${address.port}`
  server = await startServer({ POSTHOG_INGEST_HOST: host, POSTHOG_ASSETS_HOST: host })
})

afterAll(async () => {
  server?.stop()
  await new Promise<void>((resolve, reject) => upstream.close((error) => (error ? reject(error) : resolve())))
})

it('does not forward ingestion or recorder requests to a legacy analytics host', async () => {
  await fetch(`${server.base}/relay/e`, { method: 'POST', body: 'private-event' })
  await fetch(`${server.base}/relay/static/recorder.js`)
  expect(forwarded).toEqual([])
  expect((await fetch(`${server.base}/healthz`)).ok).toBe(true)
})
