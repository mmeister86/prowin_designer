import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'

it('keeps human Memory decisions, reference controls and their persistence intact', async () => {
  let server: Server = await startServer({ RESIDENT_TASK_LIMIT: '0' })
  try {
    let owner = await new Client(server).signUp('memory-owner@test.dev', 'Memory Owner')
    await new Client(server).signUp('memory-stranger@test.dev', 'Memory Stranger')
    const canvas = await (await owner.post('/api/canvases', { name: 'M1 Memory' })).json()
    const frame = await (await owner.post(`/api/canvases/${canvas.id}/frames`, { name: 'Reference' })).json()
    expect((await owner.patch(`/api/frames/${frame.id}`, { html: '<p>Preserved Memory reference</p>' })).status).toBe(
      200,
    )
    const base = `/api/canvases/${canvas.id}`
    const dataDir = server.dataDir

    // Seed synthetic distiller output only while this temporary server is stopped.
    // No model call or access to the developer's database is needed.
    server.stop({ keepData: true })
    await server.stopped
    const database = new PGlite(path.join(dataDir, 'data/pg'))
    try {
      for (const [id, rule] of [
        ['accept-me', '- Use blue accents.'],
        ['dismiss-me', '- Use red accents.'],
      ]) {
        await database.query(
          `INSERT INTO memory_proposals
            (id, canvas_id, guide_name, guide_title, rule, rationale, based_on, at, status)
            VALUES ($1, $2, 'style-notes', 'Style Notes', $3, 'Synthetic M1 evidence', 'decision-1', 1, 'pending')`,
          [id, canvas.id, rule],
        )
      }
    } finally {
      await database.close()
    }
    server = await startServer({ RESIDENT_TASK_LIMIT: '0' }, dataDir)
    owner = new Client(server)
    expect(
      (await owner.post('/api/auth/sign-in/email', { email: 'memory-owner@test.dev', password: 'password12345' }))
        .status,
    ).toBe(200)
    const stranger = new Client(server)
    expect(
      (
        await stranger.post('/api/auth/sign-in/email', {
          email: 'memory-stranger@test.dev',
          password: 'password12345',
        })
      ).status,
    ).toBe(200)

    expect((await stranger.post(`${base}/proposals/accept-me`, { accept: true })).status).toBe(403)
    expect((await stranger.post(`${base}/references`, { frameId: frame.id })).status).toBe(403)
    const pinned = await owner.post(`${base}/references`, { frameId: frame.id })
    expect(pinned.status).toBe(200)
    const reference = await pinned.json()
    expect((await stranger.delete(`${base}/references/${reference.id}`)).status).toBe(403)
    expect((await owner.delete(`${base}/references/${reference.id}`)).status).toBe(200)
    const keepResponse = await owner.post(`${base}/references`, { frameId: frame.id })
    expect(keepResponse.status).toBe(200)
    const keptReference = await keepResponse.json()
    expect(keptReference).toMatchObject({ frameId: frame.id, html: '<p>Preserved Memory reference</p>' })

    const accepted = await owner.post(`${base}/proposals/accept-me`, { accept: true })
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({ status: 'accepted', resolvedBy: 'Memory Owner' })
    const dismissed = await owner.post(`${base}/proposals/dismiss-me`, { accept: false })
    expect(dismissed.status).toBe(200)
    expect(await dismissed.json()).toMatchObject({ status: 'dismissed', resolvedBy: 'Memory Owner' })
    expect((await owner.post(`${base}/proposals/missing`, { accept: true })).status).toBe(404)
    // Repeated resolution must not append the rule a second time.
    expect((await owner.post(`${base}/proposals/accept-me`, { accept: true })).status).toBe(200)
    const versions = await (await owner.get(`${base}/guidelines/style-notes/history`)).json()
    expect(versions).toHaveLength(1)
    expect(versions[0].markdown).toBe('# Style Notes\n\n- Use blue accents.')

    server.stop({ keepData: true })
    await server.stopped
    server = await startServer({ RESIDENT_TASK_LIMIT: '0' }, dataDir)
    owner = new Client(server)
    expect(
      (await owner.post('/api/auth/sign-in/email', { email: 'memory-owner@test.dev', password: 'password12345' }))
        .status,
    ).toBe(200)
    const restored = await (await owner.get(base)).json()
    expect(restored.references).toEqual([keptReference])
    expect(keptReference.id).not.toBe(reference.id)
    expect(restored.guidelines).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'style-notes', markdown: versions[0].markdown })]),
    )
    for (const [id, status] of [
      ['accept-me', 'accepted'],
      ['dismiss-me', 'dismissed'],
    ]) {
      const response = await owner.post(`${base}/proposals/${id}`, { accept: true })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status, resolvedBy: 'Memory Owner' })
    }
    expect(await (await owner.get(`${base}/guidelines/style-notes/history`)).json()).toHaveLength(1)
  } finally {
    server.stop()
    await server.stopped
  }
}, 60_000)
