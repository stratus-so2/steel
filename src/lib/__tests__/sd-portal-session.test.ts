import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  hashSdPortalToken,
  isSdPortalToken,
  newSdPortalToken,
  SD_PORTAL_COOKIE,
  SD_PORTAL_LINK_TTL_MS,
  SD_PORTAL_SESSION_TTL_MS,
  sdPortalClearCookieOptions,
  sdPortalCookieOptions,
  sdPortalHashEquals,
  sdPortalHomeUrl,
  sdPortalLinkExpiry,
  sdPortalLinkUrl,
  sdPortalSessionExpiry,
} from '../servicedesk/portal-session'

describe('sd portal tokens', () => {
  it('uses its own cookie name and the documented validities', () => {
    expect(SD_PORTAL_COOKIE).toBe('sd.portal_session')
    expect(SD_PORTAL_COOKIE).not.toContain('better-auth')
    expect(SD_PORTAL_LINK_TTL_MS).toBe(7 * 24 * 60 * 60 * 1000)
    expect(SD_PORTAL_SESSION_TTL_MS).toBe(12 * 60 * 60 * 1000)
  })

  it('mints a 43-char base64url token and only stores its sha-256', () => {
    const { token, hash } = newSdPortalToken()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(hash).toBe(createHash('sha256').update(token).digest('hex'))
    expect(hash).toHaveLength(64)
    expect(hash).not.toContain(token)
  })

  it('never mints the same token twice', () => {
    const tokens = new Set(
      Array.from({ length: 50 }, () => newSdPortalToken().token),
    )
    expect(tokens.size).toBe(50)
  })

  it('validates the token shape before it reaches the database', () => {
    expect(isSdPortalToken(newSdPortalToken().token)).toBe(true)
    expect(isSdPortalToken('abc')).toBe(false)
    expect(isSdPortalToken('a'.repeat(44))).toBe(false)
    expect(isSdPortalToken(`${'a'.repeat(42)}+`)).toBe(false)
    expect(isSdPortalToken(null)).toBe(false)
    expect(isSdPortalToken(42)).toBe(false)
  })

  it('compares hashes without leaking length mismatches', () => {
    const hash = hashSdPortalToken('x')
    expect(sdPortalHashEquals(hash, hash)).toBe(true)
    expect(sdPortalHashEquals(hash, hashSdPortalToken('y'))).toBe(false)
    expect(sdPortalHashEquals(hash, 'short')).toBe(false)
  })
})

describe('sd portal urls', () => {
  it('points the magic link at the public /suporte routes', () => {
    const url = sdPortalLinkUrl('abc')
    expect(url.endsWith('/suporte/entrar/abc')).toBe(true)
    expect(sdPortalHomeUrl().endsWith('/suporte')).toBe(true)
  })
})

describe('sd portal cookie', () => {
  it('is httpOnly and sameSite=lax, scoped to the whole site', () => {
    const expires = new Date('2026-10-01T23:00:00.000Z')
    const options = sdPortalCookieOptions(expires)
    expect(options.httpOnly).toBe(true)
    expect(options.sameSite).toBe('lax')
    expect(options.path).toBe('/')
    expect(options.expires).toBe(expires)
    expect(typeof options.secure).toBe('boolean')
  })

  it('clears the cookie with maxAge 0 and an expired date', () => {
    const options = sdPortalClearCookieOptions()
    expect(options.maxAge).toBe(0)
    expect(options.expires.getTime()).toBe(0)
    expect(options.httpOnly).toBe(true)
  })
})

describe('sd portal expiries', () => {
  it('gives the link 7 days and the session 12 hours from `now`', () => {
    const now = new Date('2026-10-01T12:00:00.000Z')
    expect(sdPortalLinkExpiry(now).toISOString()).toBe(
      '2026-10-08T12:00:00.000Z',
    )
    expect(sdPortalSessionExpiry(now).toISOString()).toBe(
      '2026-10-02T00:00:00.000Z',
    )
  })

  it('defaults to the current instant', () => {
    const before = Date.now()
    const link = sdPortalLinkExpiry().getTime()
    const session = sdPortalSessionExpiry().getTime()
    expect(link).toBeGreaterThanOrEqual(before + SD_PORTAL_LINK_TTL_MS)
    expect(session).toBeGreaterThanOrEqual(before + SD_PORTAL_SESSION_TTL_MS)
  })
})
