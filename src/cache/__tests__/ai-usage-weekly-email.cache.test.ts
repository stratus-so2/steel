import { createId } from '@paralleldrive/cuid2'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  AiUsageWeeklyEmailCache,
  aiUsageWeeklyEmailMarkerKey,
} from '@/src/cache/ai-usage-weekly-email.cache'
import * as redisModule from '@/src/lib/redis'
import { ensureRedisConnected, redis } from '@/src/lib/redis'

const WEEK = '2026-09-28'
const used: string[] = []

function workspaceId() {
  const id = createId()
  used.push(id)
  return id
}

beforeAll(async () => {
  await ensureRedisConnected()
})

afterEach(async () => {
  vi.restoreAllMocks()
  for (const id of used.splice(0)) {
    const keys = await redis.keys(`ai:usage-weekly-email:${id}:*`)
    if (keys.length > 0) await redis.del(keys)
  }
})

afterAll(async () => {
  if (redis.isOpen) await redis.disconnect()
})

describe('AiUsageWeeklyEmailCache', () => {
  it('claims once per workspace, week and owner', async () => {
    const ws = workspaceId()
    expect(await AiUsageWeeklyEmailCache.claim(ws, WEEK, 'u1')).toBe('claimed')
    expect(await AiUsageWeeklyEmailCache.claim(ws, WEEK, 'u1')).toBe(
      'already_sent',
    )
    expect(await AiUsageWeeklyEmailCache.claim(ws, WEEK, 'u2')).toBe('claimed')
    expect(await AiUsageWeeklyEmailCache.claim(ws, '2026-10-05', 'u1')).toBe(
      'claimed',
    )
  })

  it('expires the marker after two weeks', async () => {
    const ws = workspaceId()
    await AiUsageWeeklyEmailCache.claim(ws, WEEK, 'u1')
    const ttl = await redis.ttl(aiUsageWeeklyEmailMarkerKey(ws, WEEK, 'u1'))
    expect(ttl).toBeGreaterThan(13 * 24 * 60 * 60)
    expect(ttl).toBeLessThanOrEqual(14 * 24 * 60 * 60)
  })

  it('release lets a failed send be retried', async () => {
    const ws = workspaceId()
    await AiUsageWeeklyEmailCache.claim(ws, WEEK, 'u1')
    await AiUsageWeeklyEmailCache.release(ws, WEEK, 'u1')
    expect(await AiUsageWeeklyEmailCache.claim(ws, WEEK, 'u1')).toBe('claimed')
  })

  it('reports Redis down as unavailable (the caller does not send)', async () => {
    vi.spyOn(redisModule, 'ensureRedisConnected').mockRejectedValue(
      new Error('down'),
    )
    expect(await AiUsageWeeklyEmailCache.claim('ws', WEEK, 'u1')).toBe(
      'unavailable',
    )
    await expect(
      AiUsageWeeklyEmailCache.release('ws', WEEK, 'u1'),
    ).resolves.toBeUndefined()
  })

  it('also handles a rejection that is not an Error', async () => {
    vi.spyOn(redisModule, 'ensureRedisConnected').mockRejectedValue('down')
    expect(await AiUsageWeeklyEmailCache.claim('ws', WEEK, 'u1')).toBe(
      'unavailable',
    )
    await expect(
      AiUsageWeeklyEmailCache.release('ws', WEEK, 'u1'),
    ).resolves.toBeUndefined()
  })
})
