import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  type WorkspaceFeatureSnapshot,
  WorkspaceFeaturesCache,
} from '@/src/cache/workspace-features.cache'
import { ensureRedisConnected, redis } from '@/src/lib/redis'

const snapshot: WorkspaceFeatureSnapshot = {
  plan: 'PRO',
  overrides: [
    {
      key: 'communication.broadcasts',
      enabled: false,
      expiresAt: '2026-12-31T00:00:00.000Z',
    },
  ],
}

beforeAll(async () => {
  await ensureRedisConnected()
})

afterEach(async () => {
  const keys = await redis.keys('workspace-features:*')
  if (keys.length > 0) await redis.del(keys)
})

afterAll(async () => {
  if (redis.isOpen) await redis.disconnect()
})

describe('WorkspaceFeaturesCache', () => {
  it('should store and retrieve a feature snapshot', async () => {
    await WorkspaceFeaturesCache.set('ws-feat-1', snapshot)
    expect(await WorkspaceFeaturesCache.get('ws-feat-1')).toEqual(snapshot)
  })

  it('should drop the snapshot on invalidate', async () => {
    await WorkspaceFeaturesCache.set('ws-feat-2', snapshot)
    await WorkspaceFeaturesCache.invalidate('ws-feat-2')
    expect(await WorkspaceFeaturesCache.get('ws-feat-2')).toBeNull()
  })

  it('should expire within 5 minutes so plan changes propagate', async () => {
    await WorkspaceFeaturesCache.set('ws-feat-ttl', snapshot)
    const ttl = await redis.ttl('workspace-features:ws-feat-ttl')
    expect(ttl).toBeGreaterThan(295)
    expect(ttl).toBeLessThanOrEqual(300)
  })
})
