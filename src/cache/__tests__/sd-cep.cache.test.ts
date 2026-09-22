import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { SdCepCache } from '@/src/cache/sd-cep.cache'
import { ensureRedisConnected, redis } from '@/src/lib/redis'

const ADDRESS = {
  zipCode: '01001000',
  street: 'Praça da Sé',
  complement: null,
  district: 'Sé',
  city: 'São Paulo',
  state: 'SP',
  ibgeCode: '3550308',
}

beforeAll(async () => {
  await ensureRedisConnected()
})

afterEach(async () => {
  const keys = await redis.keys('sd:cep:*')
  if (keys.length > 0) await redis.del(keys)
})

afterAll(async () => {
  if (redis.isOpen) await redis.disconnect()
})

describe('SdCepCache', () => {
  it('stores the address under sd:cep:<cep> with a 30-day TTL', async () => {
    await SdCepCache.set('01001000', ADDRESS)

    expect(await SdCepCache.get('01001000')).toEqual(ADDRESS)
    const ttl = await redis.ttl('sd:cep:01001000')
    expect(ttl).toBeGreaterThan(29 * 24 * 60 * 60)
    expect(ttl).toBeLessThanOrEqual(30 * 24 * 60 * 60)
  })

  it('returns null for a miss and after invalidate', async () => {
    expect(await SdCepCache.get('99999999')).toBeNull()
    await SdCepCache.set('01001000', ADDRESS)
    await SdCepCache.invalidate('01001000')
    expect(await SdCepCache.get('01001000')).toBeNull()
  })
})
