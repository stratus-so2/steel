import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import {
  clientIpFrom,
  type GeoLookup,
  geolocateRequest,
  getGeoLookup,
  isPublicIp,
  resetGeoLookup,
  toGeoLocation,
} from '../analytics/geoip'

let existing: string

beforeAll(async () => {
  const dir = await mkdtemp(join(tmpdir(), 'geoip-'))
  existing = join(dir, 'fake.mmdb')
  await writeFile(existing, 'not really a database')
})

afterEach(() => resetGeoLookup())

const headers = (init: Record<string, string>) => new Headers(init)

describe('clientIpFrom()', () => {
  it('uses the first hop of X-Forwarded-For', () => {
    expect(
      clientIpFrom(headers({ 'x-forwarded-for': '200.1.2.3, 10.0.0.1' })),
    ).toBe('200.1.2.3')
  })

  it('falls back to X-Real-IP and unwraps IPv4-mapped addresses', () => {
    expect(clientIpFrom(headers({ 'x-real-ip': '::ffff:200.1.2.3' }))).toBe(
      '200.1.2.3',
    )
  })

  it('returns null when absent or invalid', () => {
    expect(clientIpFrom(headers({}))).toBeNull()
    expect(clientIpFrom(headers({ 'x-forwarded-for': 'unknown' }))).toBeNull()
  })
})

describe('isPublicIp()', () => {
  it.each([
    ['200.1.2.3', true],
    ['10.1.2.3', false],
    ['172.20.0.1', false],
    ['192.168.0.10', false],
    ['127.0.0.1', false],
    ['2804:14c::1', true],
    ['::1', false],
    ['fd00::1', false],
    ['fe80::1', false],
    ['nope', false],
  ])('%s → %s', (ip, expected) => {
    expect(isPublicIp(ip)).toBe(expected)
  })
})

describe('toGeoLocation()', () => {
  it('prefers pt-BR names and the ISO code', () => {
    expect(
      toGeoLocation({
        country: { iso_code: 'BR', names: { en: 'Brazil', 'pt-BR': 'Brasil' } },
        city: { names: { en: 'Sao Paulo', 'pt-BR': 'São Paulo' } },
      }),
    ).toEqual({ country: 'Brasil', countryCode: 'BR', city: 'São Paulo' })
  })

  it('falls back to English and to the registered country', () => {
    expect(
      toGeoLocation({
        registered_country: { iso_code: 'US', names: { en: 'United States' } },
      }),
    ).toEqual({ country: 'United States', countryCode: 'US', city: null })
  })

  it('returns null for empty records', () => {
    expect(toGeoLocation(null)).toBeNull()
    expect(toGeoLocation({})).toBeNull()
  })
})

describe('getGeoLookup()', () => {
  it('is null without a configured path', async () => {
    const opener = vi.fn()
    expect(await getGeoLookup(undefined, opener)).toBeNull()
    expect(opener).not.toHaveBeenCalled()
  })

  it('is null (silently) when the file is missing', async () => {
    const opener = vi.fn()
    expect(await getGeoLookup('/nope/GeoLite2-City.mmdb', opener)).toBeNull()
    expect(opener).not.toHaveBeenCalled()
    expect(logger.warn).not.toHaveBeenCalled()
  })

  it('opens the database once and reuses it', async () => {
    const lookup: GeoLookup = { lookup: vi.fn(() => null) }
    const opener = vi.fn(async () => lookup)
    expect(await getGeoLookup(existing, opener)).toBe(lookup)
    expect(await getGeoLookup(existing, opener)).toBe(lookup)
    expect(opener).toHaveBeenCalledTimes(1)
  })

  it('logs and degrades when the database cannot be opened', async () => {
    const opener = vi.fn(async () => {
      throw new Error('corrupt')
    })
    expect(await getGeoLookup(existing, opener)).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith('analytics.geoip.open_failed', {
      message: 'corrupt',
    })
  })

  it('stringifies non-Error failures', async () => {
    const opener = vi.fn(() => Promise.reject('boom'))
    expect(await getGeoLookup(existing, opener)).toBeNull()
    expect(logger.warn).toHaveBeenCalledWith('analytics.geoip.open_failed', {
      message: 'boom',
    })
  })

  it('really opens a file with maxmind by default (invalid file → null)', async () => {
    expect(await getGeoLookup(existing)).toBeNull()
    expect(logger.warn).toHaveBeenCalled()
  })
})

describe('geolocateRequest()', () => {
  const geo = { country: 'Brasil', countryCode: 'BR', city: 'Recife' }
  const db: GeoLookup = { lookup: vi.fn(() => geo) }

  it('looks up the public client IP', async () => {
    const out = await geolocateRequest(
      headers({ 'x-forwarded-for': '200.1.2.3' }),
      Promise.resolve(db),
    )
    expect(out).toEqual(geo)
    expect(db.lookup).toHaveBeenCalledWith('200.1.2.3')
  })

  it('skips private/missing IPs and a missing database', async () => {
    expect(
      await geolocateRequest(
        headers({ 'x-forwarded-for': '10.0.0.1' }),
        Promise.resolve(db),
      ),
    ).toBeNull()
    expect(await geolocateRequest(headers({}), Promise.resolve(db))).toBeNull()
    expect(
      await geolocateRequest(
        headers({ 'x-forwarded-for': '200.1.2.3' }),
        Promise.resolve(null),
      ),
    ).toBeNull()
  })

  it('never throws', async () => {
    const broken: GeoLookup = {
      lookup: () => {
        throw new Error('bad')
      },
    }
    expect(
      await geolocateRequest(
        headers({ 'x-forwarded-for': '200.1.2.3' }),
        Promise.resolve(broken),
      ),
    ).toBeNull()
  })

  it('uses the configured database by default', async () => {
    expect(
      await geolocateRequest(headers({ 'x-forwarded-for': '200.1.2.3' })),
    ).toBeNull()
  })
})
