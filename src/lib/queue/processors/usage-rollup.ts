import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  readModuleUsageDay,
  recentUsageDays,
} from '@/src/lib/usage/module-usage'
import { ModuleUsageRepository } from '@/src/repositories/module-usage.repository'
import { UsageRollupJob } from '../jobs'

/**
 * Quantos dias regravar a cada tick: hoje e ontem cobrem a virada do dia;
 * o resto recupera um worker que ficou parado (o hash vive 8 dias).
 */
export const USAGE_ROLLUP_DAYS = 7

/**
 * BullMQ calls a processor as `(job, lockToken)`, so the clock can't be an
 * optional second parameter of the registered function: it received the
 * token string and every tick died with `now.getTime is not a function`.
 */
export function processUsageRollup(
  job: Job,
): Promise<{ days: number; rows: number }> {
  return runUsageRollup(job, new Date())
}

export async function runUsageRollup(
  job: Job,
  now: Date,
): Promise<{ days: number; rows: number }> {
  switch (job.name) {
    case UsageRollupJob.RollupModuleUsage: {
      let rows = 0
      for (const day of recentUsageDays(now, USAGE_ROLLUP_DAYS)) {
        const counters = await readModuleUsageDay(day)
        if (counters.length === 0) continue

        const result = await ModuleUsageRepository.upsertDay(day, counters)
        if (!result.ok) {
          throw new Error(
            `usage rollup failed for ${day}: ${result.error.code}`,
          )
        }
        rows += result.value
      }

      logger.info('queue.usage_rollup.completed', {
        component: 'Worker',
        jobId: job.id,
        days: USAGE_ROLLUP_DAYS,
        rows,
      })
      return { days: USAGE_ROLLUP_DAYS, rows }
    }
    default:
      throw new Error(
        `Unknown usage-rollup job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
