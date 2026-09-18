import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/module-usage.repository')
vi.mock('@/src/lib/usage/module-usage', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/src/lib/usage/module-usage')>()
  return { ...actual, readModuleUsageDay: vi.fn() }
})

import { UsageRollupJob } from '@/src/lib/queue/jobs'
import {
  processUsageRollup,
  USAGE_ROLLUP_DAYS,
} from '@/src/lib/queue/processors/usage-rollup'
import { readModuleUsageDay } from '@/src/lib/usage/module-usage'
import { ModuleUsageRepository } from '@/src/repositories/module-usage.repository'

const mockedRead = vi.mocked(readModuleUsageDay)
const mockedRepo = vi.mocked(ModuleUsageRepository)
const NOW = new Date('2026-09-18T15:00:00Z')
const job = (name: string) => ({ id: 'j1', name }) as Job

const counter = {
  workspaceId: 'ws1',
  module: 'CRM' as const,
  requests: 3,
  mutations: 1,
}

describe('processUsageRollup()', () => {
  it('writes each recent day that has counters in Redis', async () => {
    mockedRead.mockImplementation(async (day) =>
      day === '2026-09-18' || day === '2026-09-17' ? [counter] : [],
    )
    mockedRepo.upsertDay.mockResolvedValue(ok(1))

    const result = await processUsageRollup(
      job(UsageRollupJob.RollupModuleUsage),
      NOW,
    )

    expect(mockedRead).toHaveBeenCalledTimes(USAGE_ROLLUP_DAYS)
    expect(mockedRepo.upsertDay).toHaveBeenCalledTimes(2)
    expect(mockedRepo.upsertDay).toHaveBeenCalledWith('2026-09-18', [counter])
    expect(result).toEqual({ days: USAGE_ROLLUP_DAYS, rows: 2 })
  })

  it('throws when the database write fails', async () => {
    mockedRead.mockResolvedValue([counter])
    mockedRepo.upsertDay.mockResolvedValue(err(databaseError('boom')))

    await expect(
      processUsageRollup(job(UsageRollupJob.RollupModuleUsage), NOW),
    ).rejects.toThrow(/usage rollup failed/)
  })

  it('rejects unknown job names', async () => {
    await expect(processUsageRollup(job('nope'), NOW)).rejects.toThrow(
      /Unknown usage-rollup job/,
    )
  })
})
