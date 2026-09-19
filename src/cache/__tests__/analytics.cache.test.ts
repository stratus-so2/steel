import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  ANALYTICS_CACHE_TTL_SECONDS,
  AnalyticsCache,
  analyticsCacheKey,
} from '@/src/cache/analytics.cache'
import { ensureRedisConnected, redis } from '@/src/lib/redis'
import type { AnalyticsResultDTO } from '@/src/schemas/admin-analytics.schema'

const result: AnalyticsResultDTO = {
  view: 'routes',
  meta: {
    source: 'axiom',
    range: '1h',
    bin: '1m',
    binSeconds: 60,
    from: '2026-09-19T11:00:00.000Z',
    to: '2026-09-19T12:00:00.000Z',
    generatedAt: '2026-09-19T12:00:00.000Z',
    cached: false,
  },
  routes: { ok: true, data: [] },
}

beforeAll(async () => {
  await ensureRedisConnected()
})

afterEach(async () => {
  const keys = await redis.keys('analytics:v1:*')
  if (keys.length > 0) await redis.del(keys)
})

afterAll(async () => {
  if (redis.isOpen) await redis.disconnect()
})

describe('AnalyticsCache', () => {
  it('stores a view result with a short TTL', async () => {
    const key = analyticsCacheKey({ view: 'routes', range: '1h' })
    await AnalyticsCache.set(key, result)
    expect(await AnalyticsCache.get(key)).toEqual(result)
    const ttl = await redis.ttl(`analytics:v1:${key}`)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(ANALYTICS_CACHE_TTL_SECONDS)
  })
})

describe('analyticsCacheKey()', () => {
  it('ignores key order and treats undefined as empty', () => {
    expect(analyticsCacheKey({ a: '1', b: undefined })).toBe(
      analyticsCacheKey({ b: '', a: '1' }),
    )
    expect(analyticsCacheKey({ a: '1' })).not.toBe(
      analyticsCacheKey({ a: '2' }),
    )
  })
})
