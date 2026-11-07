import { expect, it } from 'vitest'
import sharp from 'sharp'
import { findBrowserPath } from '../server/screenshot.ts'
import type { Canvas, Frame } from '../shared/types.ts'
import { Client, startServer } from './harness.ts'

const SAFE_ZONE = { top: 210, right: 20, bottom: 260, left: 20 }
const TEMPLATE = `<!doctype html><html><head><style>:root{--prowin-ci-blau:#005ca9;--prowin-ci-orange:#ef7d00}body{margin:0}</style></head><body><div data-od-id="logo" data-od-role="logo" data-od-locked="true">proWIN</div><h1 data-od-id="headline" data-od-role="headline" data-od-max-length="24" data-od-allowed-colors="prowin-ci-blau,prowin-ci-orange" style="color:var(--prowin-ci-blau)">Hallo</h1></body></html>`
const ENV = { SMTP_HOST: '', SIGNUP_EMAIL_DOMAINS: '', ADMIN_EMAILS: '', REQUIRE_EMAIL_VERIFICATION: 'false' }

// Each run owns its server, including the replacement process after restart.
async function acceptanceChain(download: boolean) {
  let server = await startServer(ENV)
  try {
    const creator = await new Client(server).signUp('m4-creator@test.dev', 'Creator')
    let advisor = await new Client(server).signUp('m4-advisor@test.dev', 'Advisor')
    async function ok(response: Promise<Response>) {
      const res = await response
      expect(res.status).toBe(200)
      return res.json()
    }
    await ok(creator.post('/api/prowin/creator'))
    const workspace = await ok(creator.post('/api/workspaces', { name: 'M4 acceptance' }))
    const membership = await ok(
      creator.post(`/api/workspaces/${workspace.id}/members`, { email: 'm4-advisor@test.dev', role: 'member' }),
    )
    expect(membership.member.role).toBe('member')
    const canvas = await ok(creator.post('/api/canvases', { name: 'M4 template', workspaceId: workspace.id }))
    const frame: Frame = await ok(
      creator.post(`/api/canvases/${canvas.id}/frames`, {
        name: 'Story',
        html: TEMPLATE,
        preset: 'ig-story',
        safeZoneOverride: SAFE_ZONE,
      }),
    )
    async function snapshot(): Promise<Frame> {
      const loaded: Canvas = await ok(advisor.get(`/api/canvases/${canvas.id}`))
      const saved = loaded.frames.find((f) => f.id === frame.id)
      expect(saved).toBeDefined()
      return saved!
    }
    const versions = () => ok(advisor.get(`/api/frames/${frame.id}/versions`))
    async function unchanged(action: () => Promise<void>) {
      const before = await snapshot()
      const history = await versions()
      await action()
      expect(await snapshot()).toEqual(before)
      expect(await versions()).toEqual(history)
    }
    let html = (await snapshot()).html
    for (const [oldValue, newValue] of [
      ['>Hallo<', '>Hallo Welt<'],
      ['color:var(--prowin-ci-blau)', 'color:var(--prowin-ci-orange)'],
    ]) {
      const next = html.replace(oldValue!, newValue!)
      expect(next).not.toBe(html)
      await ok(advisor.patch(`/api/frames/${frame.id}`, { html: next }))
      expect((await snapshot()).html).toBe(next)
      html = next
    }
    const key = await ok(advisor.post('/api/agent-keys', { name: 'M4 advisor' }))
    async function mcp(old_str: string, new_str: string) {
      return ok(
        fetch(`${server.base}/mcp`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.secret}` },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'tools/call',
            params: {
              name: 'edit_frame_html',
              arguments: { frame_id: frame.id, old_str, new_str, agent_name: 'Creator' },
            },
          }),
        }),
      )
    }
    // Positive control proves this key reaches the guarded tool as the member.
    expect((await mcp('>Hallo Welt<', '>Hallo MCP<')).result.isError).not.toBe(true)
    expect((await snapshot()).html).toBe(html.replace('>Hallo Welt<', '>Hallo MCP<'))
    expect((await mcp('>Hallo MCP<', '>Hallo Welt<')).result.isError).not.toBe(true)
    expect((await snapshot()).html).toBe(html)
    const mutations = [
      ['>proWIN<', '>Changed logo<'],
      [' data-od-locked="true"', ''],
      [' data-od-max-length="24"', ''],
      ['>Hallo Welt<', '>1234567890123456789012345<'],
      ['color:var(--prowin-ci-orange)', 'color:red'],
    ] as const
    for (const [oldValue, newValue] of mutations) {
      const current = (await snapshot()).html
      expect(current.split(oldValue)).toHaveLength(2)
      const candidate = current.replace(oldValue, newValue)
      expect(candidate).not.toBe(current)
      await unchanged(async () => {
        expect((await advisor.patch(`/api/frames/${frame.id}`, { html: candidate })).status).toBe(403)
      })
      await unchanged(async () => {
        expect((await mcp(oldValue, newValue)).result.isError).toBe(true)
      })
    }
    for (const patch of [
      { width: 1200 },
      { preset: 'ig-post' },
      { safeZoneOverride: { top: 0, right: 0, bottom: 0, left: 0 } },
    ]) {
      await unchanged(async () => {
        expect((await advisor.patch(`/api/frames/${frame.id}`, patch)).status).toBe(403)
      })
    }
    await unchanged(async () => {
      expect((await advisor.delete(`/api/frames/${frame.id}`)).status).toBe(403)
    })
    await ok(advisor.post('/api/prowin/creator'))
    expect((await ok(advisor.get(`/api/workspaces/${workspace.id}`))).role).toBe('member')
    for (const [oldValue, newValue] of mutations.slice(1, 3)) {
      await unchanged(async () => {
        expect(
          (await advisor.patch(`/api/frames/${frame.id}`, { html: html.replace(oldValue, newValue) })).status,
        ).toBe(403)
      })
    }
    const beforeRestart = await snapshot()
    const history = await versions()
    const dataDir = server.dataDir
    await server.stop({ keepData: true })
    server = await startServer(ENV, dataDir)
    advisor = new Client(server)
    await ok(advisor.post('/api/auth/sign-in/email', { email: 'm4-advisor@test.dev', password: 'password12345' }))
    expect(await snapshot()).toEqual(beforeRestart)
    expect(await snapshot()).toMatchObject({
      html,
      width: 1080,
      height: 1920,
      preset: 'ig-story',
      safeZoneOverride: SAFE_ZONE,
    })
    expect(html).toContain('data-od-locked="true"')
    expect(html).toContain('data-od-max-length="24"')
    expect(html).toContain('data-od-allowed-colors="prowin-ci-blau,prowin-ci-orange"')
    expect(html).toContain('>Hallo Welt<')
    expect(html).toContain('color:var(--prowin-ci-orange)')
    expect(await versions()).toEqual(history)
    await unchanged(async () => {
      expect(
        (await advisor.patch(`/api/frames/${frame.id}`, { html: html.replace('>proWIN<', '>Changed logo<') })).status,
      ).toBe(403)
    })
    if (download) {
      for (const [ext, mime] of [
        ['png', 'image/png'],
        ['jpg', 'image/jpeg'],
      ] as const) {
        const res = await advisor.get(`/i/${frame.id}.${ext}?download`)
        expect(res.status).toBe(200)
        expect(res.headers.get('content-type')).toBe(mime)
        expect(res.headers.get('content-disposition')).toContain('attachment')
        const metadata = await sharp(Buffer.from(await res.arrayBuffer())).metadata()
        expect(metadata.format).toBe(ext === 'jpg' ? 'jpeg' : 'png')
        expect({ width: metadata.width, height: metadata.height }).toEqual({ width: 1080, height: 1920 })
      }
    }
  } finally {
    await server.stop()
  }
}

it('preserves M4 member personalization and rejects REST/MCP template bypasses across restart', async () => {
  await acceptanceChain(false)
}, 120_000)

it.skipIf(!findBrowserPath())(
  'downloads the persisted M4 story as 1080×1920 PNG and JPG in real Chromium',
  async () => {
    await acceptanceChain(true)
  },
  180_000,
)
