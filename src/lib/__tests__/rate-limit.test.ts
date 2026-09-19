import { RateLimiterRes } from 'rate-limiter-flexible'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  ensureRedisConnected: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/lib/redis', () => ({
  redis: {},
  ensureRedisConnected: mocks.ensureRedisConnected,
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.logger }))

import { apiLimiter, consume, type Limiter } from '@/src/lib/rate-limit'

// Unitários do `consume()` sem Redis: o comportamento contra o Redis real
// (contagem, bloqueio, isolamento) fica em `rate-limit.integration.test.ts`.
function fakeLimiter(consumeImpl: () => Promise<unknown>): Limiter {
  return { consume: vi.fn(consumeImpl) } as unknown as Limiter
}

describe('consume() — unit', () => {
  beforeEach(() => {
    mocks.ensureRedisConnected.mockResolvedValue(undefined)
  })

  it('returns ok and consumes the requested points', async () => {
    const limiter = fakeLimiter(async () => ({}))

    const result = await consume(limiter, 'user:1', 3)

    expect(result.ok).toBe(true)
    expect(limiter.consume).toHaveBeenCalledWith('user:1', 3)
  })

  it('maps a RateLimiterRes rejection to RATE_LIMITED with a rounded-up Retry-After', async () => {
    const spy = vi
      .spyOn(apiLimiter, 'consume')
      .mockRejectedValue(new RateLimiterRes(0, 1500, 101))

    const result = await consume(apiLimiter, 'user:1')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('RATE_LIMITED')
      expect(result.error.details).toEqual({ retryAfterSeconds: 2 })
    }
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'rate_limit_violation',
      expect.objectContaining({ limiter: 'api', consumedPoints: 101 }),
    )
    spy.mockRestore()
  })

  it('never reports a Retry-After below one second', async () => {
    const limiter = fakeLimiter(async () => {
      throw new RateLimiterRes(0, 0, 11)
    })

    const result = await consume(limiter, 'ip:1')

    expect(!result.ok && result.error.details).toEqual({
      retryAfterSeconds: 1,
    })
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'rate_limit_violation',
      expect.objectContaining({ limiter: 'unknown' }),
    )
  })

  it('fails open (ok) and logs when the store errors', async () => {
    const limiter = fakeLimiter(async () => {
      throw new Error('READONLY')
    })

    const result = await consume(limiter, 'ip:1')

    expect(result.ok).toBe(true)
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'rate_limit_store_error',
      expect.objectContaining({ key: 'ip:1', message: 'READONLY' }),
    )
  })

  it('stringifies non-Error store failures', async () => {
    const limiter = fakeLimiter(async () => {
      throw 'socket closed'
    })

    await consume(limiter, 'ip:2')

    expect(mocks.logger.error).toHaveBeenCalledWith(
      'rate_limit_store_error',
      expect.objectContaining({ message: 'socket closed' }),
    )
  })
})

describe('consume() — Redis connection bootstrap', () => {
  it('retries the connection on the next call after a failed connect', async () => {
    vi.resetModules()
    mocks.ensureRedisConnected
      .mockReset()
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockResolvedValue(undefined)
    const fresh = await import('@/src/lib/rate-limit')
    const limiter = fakeLimiter(async () => ({}))

    // 1ª chamada: conexão falha → fail-open, sem tocar o limiter.
    const first = await fresh.consume(limiter, 'ip:3')
    expect(first.ok).toBe(true)
    expect(limiter.consume).not.toHaveBeenCalled()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'rate_limit_store_error',
      expect.objectContaining({ message: 'ECONNREFUSED' }),
    )

    // 2ª e 3ª: reconecta uma única vez e reaproveita a conexão.
    await fresh.consume(limiter, 'ip:3')
    await fresh.consume(limiter, 'ip:3')
    expect(mocks.ensureRedisConnected).toHaveBeenCalledTimes(2)
    expect(limiter.consume).toHaveBeenCalledTimes(2)
  })
})
