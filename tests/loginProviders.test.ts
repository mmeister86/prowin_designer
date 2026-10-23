import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { Client, startServer, type Server } from './harness.ts'

let unconfigured: Server
let configured: Server

beforeAll(async () => {
  ;[unconfigured, configured] = await Promise.all([
    startServer(),
    startServer({
      GOOGLE_CLIENT_ID: 'google-client',
      GOOGLE_CLIENT_SECRET: 'google-secret',
      APPLE_CLIENT_ID: 'apple-client',
      APPLE_CLIENT_SECRET: 'apple-secret',
      OIDC_ISSUER: 'https://idp.invalid',
      OIDC_CLIENT_ID: 'old-client',
      OIDC_CLIENT_SECRET: 'old-secret',
      MICROSOFT_CLIENT_ID: 'old-microsoft-client',
      MICROSOFT_CLIENT_SECRET: 'old-microsoft-secret',
    }),
  ])
}, 70_000)

afterAll(() => {
  unconfigured?.stop()
  configured?.stop()
})

describe('login providers', () => {
  it('advertises only supported providers without exposing credentials', async () => {
    const disabled = await new Client(unconfigured).get('/api/login-providers')
    expect(disabled.status).toBe(200)
    expect(await disabled.json()).toEqual({ google: false, apple: false, appleNative: false })
    const enabled = await new Client(configured).get('/api/login-providers')
    expect(enabled.status).toBe(200)
    expect(await enabled.json()).toEqual({ google: true, apple: true, appleNative: false })
  })

  it('no longer serves the old discovery or generic OAuth login endpoints', async () => {
    const client = await new Client(configured).signUp('legacy@test.dev', 'Legacy')
    expect((await client.get('/api/oidc-config')).status).toBe(404)
    expect((await client.post('/api/auth/sign-in/oauth2', { providerId: 'oidc', callbackURL: '/' })).status).toBe(404)
    expect((await client.get('/api/auth/oauth2/callback/oidc?code=old&state=old')).status).toBe(404)
  })

  it('refuses Microsoft sign-in even with legacy credentials set', async () => {
    const res = await new Client(configured).post('/api/auth/sign-in/social', {
      provider: 'microsoft',
      callbackURL: '/',
    })
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: 'PROVIDER_NOT_FOUND' })
  })

  it.each(['google', 'apple'])('still starts %s sign-in with its callback', async (provider) => {
    const res = await new Client(configured).post('/api/auth/sign-in/social', { provider, callbackURL: '/' })
    expect(res.status).toBe(200)
    const url = new URL((await res.json()).url)
    expect(url.hostname).toBe(provider === 'google' ? 'accounts.google.com' : 'appleid.apple.com')
    expect(url.searchParams.get('redirect_uri')).toBe(`${configured.base}/api/auth/callback/${provider}`)
  })

  it('still registers and signs in with email/password', async () => {
    const client = await new Client(configured).signUp('alice@test.dev', 'Alice')
    await client.post('/api/auth/sign-out')
    const res = await client.post('/api/auth/sign-in/email', { email: 'alice@test.dev', password: 'password12345' })
    expect(res.status).toBe(200)
    expect((await (await client.get('/api/me')).json()).email).toBe('alice@test.dev')
  })
})
