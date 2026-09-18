import { beforeEach, describe, expect, it, vi } from 'vitest'

const { exec, hIncrBy, expire, multi } = vi.hoisted(() => {
  const exec = vi.fn(async () => [])
  const chain = {
    hIncrBy: vi.fn(() => chain),
    expire: vi.fn(() => chain),
    exec,
  }
  return {
    exec,
    hIncrBy: chain.hIncrBy,
    expire: chain.expire,
    multi: vi.fn(() => chain),
  }
})

vi.mock('@/src/lib/redis', () => ({
  ensureRedisConnected: vi.fn(async () => ({ multi })),
}))

import { ensureRedisConnected } from '@/src/lib/redis'
import {
  isMutationMethod,
  parseModuleApiPath,
  parseUsageHash,
  recentUsageDays,
  recordModuleUsage,
  USAGE_KEY_TTL_SECONDS,
  usageDay,
} from '../usage/module-usage'

beforeEach(() => {
  exec.mockResolvedValue([])
})

describe('parseModuleApiPath()', () => {
  it('maps crm and whatsapp workspace routes to their module', () => {
    expect(parseModuleApiPath('/api/workspaces/ws1/crm/leads')).toEqual({
      workspaceId: 'ws1',
      module: 'CRM',
    })
    expect(
      parseModuleApiPath('/api/workspaces/ws1/whatsapp/conversations/c1'),
    ).toEqual({ workspaceId: 'ws1', module: 'COMMUNICATION' })
    expect(parseModuleApiPath('/api/workspaces/ws1/crm')).toEqual({
      workspaceId: 'ws1',
      module: 'CRM',
    })
  })

  it('ignores routes outside a workspace module', () => {
    expect(parseModuleApiPath('/api/workspaces/ws1/members')).toBeNull()
    expect(parseModuleApiPath('/api/workspaces/ws1/crmx/leads')).toBeNull()
    expect(parseModuleApiPath('/api/crm/forms/f1/submit')).toBeNull()
    expect(parseModuleApiPath('/api/whatsapp/webhook/meta')).toBeNull()
  })
})

describe('isMutationMethod()', () => {
  it('treats only non-read methods as mutations', () => {
    expect(isMutationMethod('GET')).toBe(false)
    expect(isMutationMethod('head')).toBe(false)
    expect(isMutationMethod('POST')).toBe(true)
    expect(isMutationMethod('DELETE')).toBe(true)
  })
})

describe('usageDay()', () => {
  it('uses the São Paulo calendar day', () => {
    // 02:00 UTC is still the previous day in São Paulo (UTC-3).
    expect(usageDay(new Date('2026-09-18T02:00:00Z'))).toBe('2026-09-17')
    expect(usageDay(new Date('2026-09-18T03:00:00Z'))).toBe('2026-09-18')
  })

  it('lists recent days oldest first', () => {
    expect(recentUsageDays(new Date('2026-09-18T15:00:00Z'), 3)).toEqual([
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
    ])
  })
})

describe('parseUsageHash()', () => {
  it('merges read and write counters per workspace and module', () => {
    const counters = parseUsageHash({
      'ws1|CRM|r': '10',
      'ws1|CRM|w': '3',
      'ws1|COMMUNICATION|r': '4',
      'ws2|CRM|r': '1',
    })
    expect(counters).toEqual(
      expect.arrayContaining([
        { workspaceId: 'ws1', module: 'CRM', requests: 10, mutations: 3 },
        {
          workspaceId: 'ws1',
          module: 'COMMUNICATION',
          requests: 4,
          mutations: 0,
        },
        { workspaceId: 'ws2', module: 'CRM', requests: 1, mutations: 0 },
      ]),
    )
    expect(counters).toHaveLength(3)
  })

  it('skips malformed fields', () => {
    expect(
      parseUsageHash({
        garbage: '1',
        'ws1|BILLING|r': '1',
        'ws1|CRM|x': '1',
        'ws1|CRM|r': 'NaN',
      }),
    ).toEqual([])
  })
})

describe('recordModuleUsage()', () => {
  const now = new Date('2026-09-18T15:00:00Z')

  it('increments the read counter and refreshes the TTL for a GET', async () => {
    await recordModuleUsage(
      { pathname: '/api/workspaces/ws1/crm/leads', method: 'GET', status: 200 },
      now,
    )

    expect(hIncrBy).toHaveBeenCalledTimes(1)
    expect(hIncrBy).toHaveBeenCalledWith(
      'usage:module:2026-09-18',
      'ws1|CRM|r',
      1,
    )
    expect(expire).toHaveBeenCalledWith(
      'usage:module:2026-09-18',
      USAGE_KEY_TTL_SECONDS,
    )
  })

  it('also increments the write counter for a mutation', async () => {
    await recordModuleUsage(
      {
        pathname: '/api/workspaces/ws1/whatsapp/broadcasts',
        method: 'POST',
        status: 201,
      },
      now,
    )
    expect(hIncrBy).toHaveBeenCalledWith(
      'usage:module:2026-09-18',
      'ws1|COMMUNICATION|w',
      1,
    )
  })

  it('does nothing for failed responses or non-module routes', async () => {
    await recordModuleUsage(
      { pathname: '/api/workspaces/ws1/crm/leads', method: 'GET', status: 403 },
      now,
    )
    await recordModuleUsage(
      { pathname: '/api/sticky-notes', method: 'POST', status: 201 },
      now,
    )
    expect(ensureRedisConnected).not.toHaveBeenCalled()
  })

  it('swallows Redis failures', async () => {
    exec.mockRejectedValueOnce(new Error('redis down'))
    await expect(
      recordModuleUsage(
        {
          pathname: '/api/workspaces/ws1/crm/leads',
          method: 'GET',
          status: 200,
        },
        now,
      ),
    ).resolves.toBeUndefined()
  })
})
