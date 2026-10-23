import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { stubEnv, unstubAllEnvs } from './envStub.ts'
import { loadAppleConfig, loadGoogleConfig, loginProvidersConfig } from '../server/auth.ts'

const PROVIDER_VARS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'APPLE_CLIENT_ID',
  'APPLE_CLIENT_SECRET',
  'APPLE_APP_BUNDLE_IDENTIFIER',
] as const

beforeEach(() => {
  for (const key of PROVIDER_VARS) stubEnv(key, undefined)
})
afterEach(unstubAllEnvs)

describe('loadGoogleConfig', () => {
  it('returns null when neither var is set', () => {
    expect(loadGoogleConfig()).toBeNull()
  })

  it.each([{ GOOGLE_CLIENT_ID: 'g-client' }, { GOOGLE_CLIENT_SECRET: 'g-secret' }])(
    'throws when only one of the pair is set: %o',
    (partial) => {
      for (const [key, value] of Object.entries(partial)) stubEnv(key, value)
      expect(() => loadGoogleConfig()).toThrow(/GOOGLE_CLIENT_ID.*GOOGLE_CLIENT_SECRET/)
    },
  )

  it('returns the pair when both are set', () => {
    stubEnv('GOOGLE_CLIENT_ID', 'g-client')
    stubEnv('GOOGLE_CLIENT_SECRET', 'g-secret')
    expect(loadGoogleConfig()).toEqual({ clientId: 'g-client', clientSecret: 'g-secret' })
  })
})

describe('loginProvidersConfig', () => {
  it('reports all providers off when nothing is configured', () => {
    expect(loginProvidersConfig()).toEqual({ google: false, apple: false, appleNative: false })
  })

  it('reports google on without exposing credentials', () => {
    stubEnv('GOOGLE_CLIENT_ID', 'g-client')
    stubEnv('GOOGLE_CLIENT_SECRET', 'g-secret')
    expect(loginProvidersConfig()).toEqual({ google: true, apple: false, appleNative: false })
  })

  it('combines google and apple', () => {
    stubEnv('GOOGLE_CLIENT_ID', 'g-client')
    stubEnv('GOOGLE_CLIENT_SECRET', 'g-secret')
    stubEnv('APPLE_CLIENT_ID', 'a-client')
    stubEnv('APPLE_CLIENT_SECRET', 'a-secret')
    stubEnv('APPLE_APP_BUNDLE_IDENTIFIER', 'design.doop.ios')
    expect(loginProvidersConfig()).toEqual({ google: true, apple: true, appleNative: true })
  })
})

describe('loadAppleConfig', () => {
  it('returns null when nothing is set', () => {
    expect(loadAppleConfig()).toBeNull()
  })

  it.each([{ APPLE_CLIENT_ID: 'a-client' }, { APPLE_CLIENT_SECRET: 'a-secret' }])(
    'throws when only one of the web pair is set: %o',
    (partial) => {
      for (const [key, value] of Object.entries(partial)) stubEnv(key, value)
      expect(() => loadAppleConfig()).toThrow(/APPLE_CLIENT_ID.*APPLE_CLIENT_SECRET/)
    },
  )

  it('enables the native half on its own', () => {
    stubEnv('APPLE_APP_BUNDLE_IDENTIFIER', 'design.doop.ios')
    expect(loadAppleConfig()).toEqual({ web: null, appBundleIdentifier: 'design.doop.ios' })
    expect(loginProvidersConfig()).toEqual({ google: false, apple: false, appleNative: true })
  })

  it('enables the web half on its own without exposing credentials', () => {
    stubEnv('APPLE_CLIENT_ID', 'design.doop.web')
    stubEnv('APPLE_CLIENT_SECRET', 'a-secret')
    expect(loadAppleConfig()).toEqual({
      web: { clientId: 'design.doop.web', clientSecret: 'a-secret' },
      appBundleIdentifier: null,
    })
    expect(loginProvidersConfig()).toEqual({ google: false, apple: true, appleNative: false })
  })

  it('combines both halves', () => {
    stubEnv('APPLE_CLIENT_ID', 'design.doop.web')
    stubEnv('APPLE_CLIENT_SECRET', 'a-secret')
    stubEnv('APPLE_APP_BUNDLE_IDENTIFIER', 'design.doop.ios')
    expect(loginProvidersConfig()).toMatchObject({ apple: true, appleNative: true })
  })
})
