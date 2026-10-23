import { createServer, type Server as HttpServer } from 'node:http'
import { createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { exportJWK, generateKeyPair, SignJWT, type CryptoKey } from 'jose'
import { Client, freePort, startServer, type Server } from './harness.ts'

/**
 * The iOS app's native Sign in with Apple, end to end: the sheet's identity
 * token goes to POST /api/auth/sign-in/social and the server answers with a
 * session. Apple's part is played by a local JWKS server (APPLE_JWKS_URL)
 * and tokens signed with its key, shaped the way Apple shapes them: issuer
 * appleid.apple.com, the bundle id as audience, email_verified as the string
 * "true", and the SHA-256 of the app's nonce in the nonce claim.
 */

const BUNDLE_ID = 'design.doop.test'
const KID = 'test-key-1'

let privateKey: CryptoKey
let keys: HttpServer
let jwksUrl: string
let native: Server
let webOnly: Server
let restricted: Server

interface TokenShape {
  audience?: string
  nonce?: string
  email?: string
  subject?: string
  issuer?: string
  verified?: boolean | string
}

async function appleToken(shape: TokenShape = {}): Promise<string> {
  return new SignJWT({
    email: shape.email ?? 'ada@apple.test',
    email_verified: shape.verified ?? 'true',
    ...(shape.nonce !== undefined && { nonce: createHash('sha256').update(shape.nonce).digest('hex') }),
  })
    .setProtectedHeader({ alg: 'RS256', kid: KID })
    .setIssuer(shape.issuer ?? 'https://appleid.apple.com')
    .setAudience(shape.audience ?? BUNDLE_ID)
    .setSubject(shape.subject ?? 'apple-sub-ada')
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(privateKey)
}

function nativeSignIn(client: Client, token: string, nonce: string, name?: { firstName: string; lastName: string }) {
  return client.post('/api/auth/sign-in/social', {
    provider: 'apple',
    idToken: { token, nonce, ...(name && { user: { name } }) },
  })
}

beforeAll(async () => {
  const pair = await generateKeyPair('RS256')
  privateKey = pair.privateKey
  const jwk = { ...(await exportJWK(pair.publicKey)), kid: KID, alg: 'RS256', use: 'sig' }
  const port = await freePort()
  keys = createServer((req, res) => {
    if (req.url === '/keys') {
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ keys: [jwk] }))
    } else {
      res.statusCode = 404
      res.end()
    }
  })
  await new Promise<void>((resolve) => keys.listen(port, resolve))
  jwksUrl = `http://localhost:${port}/keys`
  ;[native, webOnly, restricted] = await Promise.all([
    startServer({ APPLE_APP_BUNDLE_IDENTIFIER: BUNDLE_ID, APPLE_JWKS_URL: jwksUrl }),
    startServer({ APPLE_CLIENT_ID: 'design.doop.web', APPLE_CLIENT_SECRET: 'web-secret', APPLE_JWKS_URL: jwksUrl }),
    startServer({
      APPLE_APP_BUNDLE_IDENTIFIER: BUNDLE_ID,
      APPLE_JWKS_URL: jwksUrl,
      SIGNUP_EMAIL_DOMAINS: 'apple.test',
    }),
  ])
}, 90_000)

afterAll(() => {
  native?.stop()
  webOnly?.stop()
  restricted?.stop()
  keys?.close()
})

describe('native Sign in with Apple', () => {
  it('advertises the native half and signs the app in with a verified token, keeping the first-sign-in name', async () => {
    const client = new Client(native)
    expect(await (await client.get('/api/login-providers')).json()).toMatchObject({ apple: false, appleNative: true })

    const res = await nativeSignIn(client, await appleToken({ nonce: 'raw-nonce-1' }), 'raw-nonce-1', {
      firstName: 'Ada',
      lastName: 'Lovelace',
    })
    expect(res.status, await res.text()).toBe(200)
    expect(client.cookies.size).toBeGreaterThan(0)

    const session = (await (await client.get('/api/auth/get-session')).json()) as {
      user: { email: string; name: string; emailVerified: boolean }
    }
    expect(session.user).toMatchObject({ email: 'ada@apple.test', name: 'Ada Lovelace', emailVerified: true })
  })

  it('signs the same account in again without a name and keeps the stored one', async () => {
    const client = new Client(native)
    const res = await nativeSignIn(client, await appleToken({ nonce: 'raw-nonce-2' }), 'raw-nonce-2')
    expect(res.status, await res.text()).toBe(200)
    const session = (await (await client.get('/api/auth/get-session')).json()) as { user: { name: string } }
    expect(session.user.name).toBe('Ada Lovelace')
  })

  it.each([
    { label: 'wrong audience', shape: { audience: 'com.example.other', nonce: 'n' }, nonce: 'n' },
    { label: 'wrong issuer', shape: { issuer: 'https://idp.example.com', nonce: 'n' }, nonce: 'n' },
    { label: 'nonce the app did not use', shape: { nonce: 'theirs' }, nonce: 'ours' },
    { label: 'token without the nonce the app claims', shape: {}, nonce: 'ours' },
  ])('refuses a token with a $label', async ({ shape, nonce }) => {
    const client = new Client(native)
    const res = await nativeSignIn(client, await appleToken({ ...shape, subject: 'apple-sub-mallory' }), nonce)
    expect(res.status).toBe(401)
    expect(client.cookies.has('better-auth.session_token')).toBe(false)
  })

  it('refuses a token signed by a key Apple does not publish', async () => {
    const pair = await generateKeyPair('RS256')
    const forged = await new SignJWT({ email: 'eve@apple.test', email_verified: 'true' })
      .setProtectedHeader({ alg: 'RS256', kid: KID })
      .setIssuer('https://appleid.apple.com')
      .setAudience(BUNDLE_ID)
      .setSubject('apple-sub-eve')
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(pair.privateKey)
    const client = new Client(native)
    const res = await client.post('/api/auth/sign-in/social', { provider: 'apple', idToken: { token: forged } })
    expect(res.status).toBe(401)
  })

  it('does not accept native tokens on a server that only has the web half', async () => {
    const client = new Client(webOnly)
    expect(await (await client.get('/api/login-providers')).json()).toMatchObject({ apple: true, appleNative: false })
    const res = await nativeSignIn(client, await appleToken({ nonce: 'n' }), 'n')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(client.cookies.has('better-auth.session_token')).toBe(false)
  })
})

describe('social account linking and signup restrictions', () => {
  it.each([true, 'true'])('links a password account when Apple verifies the email as %s', async (verified) => {
    const email = `linked-${typeof verified}@apple.test`
    const local = await new Client(native).signUp(email, 'Local')
    const before = await (await local.get('/api/me')).json()
    const client = new Client(native)
    const res = await nativeSignIn(client, await appleToken({ email, subject: email, verified, nonce: 'link' }), 'link')
    expect(res.status).toBe(200)
    const session = await (await client.get('/api/auth/get-session')).json()
    expect(session.user).toMatchObject({ id: before.id, email, emailVerified: true })
  })

  it('does not link an unverified provider email to an existing password account', async () => {
    const email = 'unverified@apple.test'
    const local = await new Client(native).signUp(email, 'Local')
    const client = new Client(native)
    const res = await nativeSignIn(
      client,
      await appleToken({ email, subject: email, verified: false, nonce: 'unverified' }),
      'unverified',
    )
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await (await client.get('/api/auth/get-session')).json()).toBeNull()
    expect((await (await local.get('/api/auth/get-session')).json()).user.emailVerified).toBe(false)
  })

  it('rejects a social signup from an unlisted domain without creating an account', async () => {
    const client = new Client(restricted)
    const email = 'outsider@example.com'
    const res = await nativeSignIn(client, await appleToken({ email, subject: email, nonce: 'domain' }), 'domain')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(await (await client.post('/api/account-exists', { email })).json()).toEqual({ exists: false })
  })

  it('admits a social signup from a listed domain', async () => {
    const client = new Client(restricted)
    const email = 'allowed@apple.test'
    const res = await nativeSignIn(client, await appleToken({ email, subject: email, nonce: 'allowed' }), 'allowed')
    expect(res.status).toBe(200)
    expect((await (await client.get('/api/me')).json()).email).toBe(email)
  })
})
