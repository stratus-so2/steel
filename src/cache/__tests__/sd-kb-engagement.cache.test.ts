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
import { SdKbEngagementCache } from '@/src/cache/sd-kb-engagement.cache'
import * as redisModule from '@/src/lib/redis'
import { ensureRedisConnected, redis } from '@/src/lib/redis'

const used: string[] = []

function articleId() {
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
    const keys = await redis.keys(`sd:kb:*:${id}*`)
    if (keys.length > 0) await redis.del(keys)
  }
})

afterAll(async () => {
  if (redis.isOpen) await redis.disconnect()
})

describe('SdKbEngagementCache', () => {
  describe('markViewed()', () => {
    it('counts the first view of the user per UTC day only', async () => {
      const id = articleId()
      const day = new Date('2026-09-21T12:00:00Z')
      expect(await SdKbEngagementCache.markViewed(id, 'u1', day)).toBe(true)
      expect(await SdKbEngagementCache.markViewed(id, 'u1', day)).toBe(false)
      expect(await SdKbEngagementCache.markViewed(id, 'u2', day)).toBe(true)
      expect(
        await SdKbEngagementCache.markViewed(
          id,
          'u1',
          new Date('2026-09-22T00:30:00Z'),
        ),
      ).toBe(true)
      const ttl = await redis.ttl(`sd:kb:view:${id}:u1:2026-09-21`)
      expect(ttl).toBeGreaterThan(0)
    })

    it('uses the current date by default', async () => {
      const id = articleId()
      expect(await SdKbEngagementCache.markViewed(id, 'u1')).toBe(true)
    })
  })

  describe('votes', () => {
    it('stores, swaps and removes a vote, returning the previous one', async () => {
      const id = articleId()
      expect(await SdKbEngagementCache.getVote(id, 'u1')).toBeNull()
      expect(await SdKbEngagementCache.swapVote(id, 'u1', 'up')).toBeNull()
      expect(await SdKbEngagementCache.getVote(id, 'u1')).toBe('up')
      expect(await SdKbEngagementCache.swapVote(id, 'u1', 'down')).toBe('up')
      expect(await SdKbEngagementCache.getVote(id, 'u1')).toBe('down')
      expect(await SdKbEngagementCache.swapVote(id, 'u1', null)).toBe('down')
      expect(await SdKbEngagementCache.getVote(id, 'u1')).toBeNull()
    })

    it('ignores unexpected stored values', async () => {
      const id = articleId()
      await redis.hSet(`sd:kb:votes:${id}`, 'u1', 'maybe')
      expect(await SdKbEngagementCache.getVote(id, 'u1')).toBeNull()
      expect(await SdKbEngagementCache.swapVote(id, 'u1', 'up')).toBeNull()
    })

    it('forgets every vote of a deleted article', async () => {
      const id = articleId()
      await SdKbEngagementCache.swapVote(id, 'u1', 'up')
      await SdKbEngagementCache.forgetArticle(id)
      expect(await redis.exists(`sd:kb:votes:${id}`)).toBe(0)
    })
  })

  describe('when Redis fails', () => {
    it('degrades without throwing', async () => {
      vi.spyOn(redisModule, 'ensureRedisConnected').mockRejectedValue(
        new Error('down'),
      )
      expect(await SdKbEngagementCache.markViewed('a', 'u')).toBe(false)
      expect(await SdKbEngagementCache.getVote('a', 'u')).toBeNull()
      expect(await SdKbEngagementCache.swapVote('a', 'u', 'up')).toBeUndefined()
      await expect(
        SdKbEngagementCache.forgetArticle('a'),
      ).resolves.toBeUndefined()
    })

    it('reports non-Error rejections too', async () => {
      vi.spyOn(redisModule, 'ensureRedisConnected').mockRejectedValue('down')
      expect(await SdKbEngagementCache.getVote('a', 'u')).toBeNull()
    })
  })
})
