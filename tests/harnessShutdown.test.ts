import { existsSync, rmSync } from 'node:fs'
import { expect, it } from 'vitest'
import { Client, startServer } from './harness'

it('keeps server data until the child exits, then finishes cleanup before stop resolves', async () => {
  const server = await startServer()
  let exited = false
  const exit = server.stopped.then(() => {
    exited = true
  })
  const stopping = server.stop()
  try {
    // A kill signal cannot deliver the child exit event within this synchronous turn.
    expect(existsSync(server.dataDir)).toBe(true)
    await stopping
    expect(exited).toBe(true)
    expect(existsSync(server.dataDir)).toBe(false)
  } finally {
    await stopping
    await exit
  }
}, 30_000)

it('preserves data for an authenticated restart when keepData is requested', async () => {
  let server = await startServer()
  const dataDir = server.dataDir
  try {
    const client = await new Client(server).signUp('shutdown@test.dev', 'Shutdown')
    const canvas = await (await client.post('/api/canvases', { name: 'Keep me' })).json()
    await server.stop({ keepData: true })
    await server.stopped
    expect(existsSync(dataDir)).toBe(true)
    server = await startServer({}, dataDir)
    expect((await (await client.get(`/api/canvases/${canvas.id}`)).json()).name).toBe('Keep me')
  } finally {
    await server.stop()
    await server.stopped
    rmSync(dataDir, { recursive: true, force: true })
  }
}, 30_000)
