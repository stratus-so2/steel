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
import { SdIntegrationEventCache } from '@/src/cache/sd-integration-event.cache'
import * as redisModule from '@/src/lib/redis'
import { ensureRedisConnected, redis } from '@/src/lib/redis'

const used: string[] = []

function eventId() {
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
    const keys = await redis.keys(`sd:integration:event:*:${id}`)
    if (keys.length > 0) await redis.del(keys)
  }
})

afterAll(async () => {
  if (redis.isOpen) await redis.disconnect()
})

describe('SdIntegrationEventCache', () => {
  it('a primeira vez processa e a reentrega não', async () => {
    const id = eventId()
    expect(await SdIntegrationEventCache.claim('slack', id)).toBe(true)
    expect(await SdIntegrationEventCache.claim('slack', id)).toBe(false)
    expect(await SdIntegrationEventCache.claim('slack', id)).toBe(false)
  })

  it('a trava é por tipo de integração', async () => {
    const id = eventId()
    expect(await SdIntegrationEventCache.claim('slack', id)).toBe(true)
    expect(await SdIntegrationEventCache.claim('github', id)).toBe(true)
  })

  it('a trava expira sozinha (TTL de 2 h)', async () => {
    const id = eventId()
    await SdIntegrationEventCache.claim('slack', id)
    const ttl = await redis.ttl(`sd:integration:event:slack:${id}`)
    expect(ttl).toBeGreaterThan(0)
    expect(ttl).toBeLessThanOrEqual(2 * 60 * 60)
  })

  it('liberar permite reprocessar (o job falhou e vale tentar de novo)', async () => {
    const id = eventId()
    expect(await SdIntegrationEventCache.claim('github', id)).toBe(true)
    await SdIntegrationEventCache.release('github', id)
    expect(await SdIntegrationEventCache.claim('github', id)).toBe(true)
  })

  it('liberar o que não existe não faz nada', async () => {
    await expect(
      SdIntegrationEventCache.release('github', eventId()),
    ).resolves.toBeUndefined()
  })

  it('Redis fora do ar deixa processar (perder chamado é pior que duplicar)', async () => {
    vi.spyOn(redisModule, 'ensureRedisConnected').mockRejectedValue(
      new Error('down'),
    )
    expect(await SdIntegrationEventCache.claim('slack', 'ev-1')).toBe(true)
    await expect(
      SdIntegrationEventCache.release('slack', 'ev-1'),
    ).resolves.toBeUndefined()
  })

  it('também reporta rejeição que não é Error', async () => {
    vi.spyOn(redisModule, 'ensureRedisConnected').mockRejectedValue('down')
    expect(await SdIntegrationEventCache.claim('github', 'ev-2')).toBe(true)
    await expect(
      SdIntegrationEventCache.release('github', 'ev-2'),
    ).resolves.toBeUndefined()
  })
})
