import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { BETTER_AUTH_URL, STATUS_APP_PROBE_URL } from '@/lib/env/server'
import type { ComponentTier } from '@/src/services/status/components'
import { StatusService } from '@/src/services/status/status.service'
import { StatusCollectJob } from '../jobs'

const TIER_BY_JOB: Record<string, ComponentTier> = {
  [StatusCollectJob.CollectCore]: 'core',
  [StatusCollectJob.CollectPeripheral]: 'peripheral',
}

export type StatusCollectResult = {
  tier: ComponentTier
  durationMs: number
}

/**
 * Roda os probes do status page direto (sem passar pela rota HTTP), agendado
 * pelo worker (`scheduleStatusCollectJobs`). O probe "app" usa
 * `STATUS_APP_PROBE_URL` (ou `BETTER_AUTH_URL`) pra checar o Next de fato, já
 * que aqui estamos num processo separado.
 */
export async function processStatusCollect(
  job: Job,
): Promise<StatusCollectResult> {
  const tier = TIER_BY_JOB[job.name]
  if (!tier) {
    throw new Error(
      `Unknown status-collect job: ${job.name} (id=${job.id ?? 'unknown'})`,
    )
  }

  const startedAt = Date.now()
  const result = await StatusService.collect(tier, {
    appUrl: STATUS_APP_PROBE_URL ?? BETTER_AUTH_URL,
  })
  const durationMs = Date.now() - startedAt

  if (!result.ok) {
    logger.error('queue.status_collect.failed', {
      component: 'Worker',
      jobId: job.id,
      tier,
      errorCode: result.error.code,
      message: result.error.message,
    })
    throw new Error(`Status collect (${tier}) failed: ${result.error.message}`)
  }

  logger.info('queue.status_collect.completed', {
    component: 'Worker',
    jobId: job.id,
    tier,
    durationMs,
  })

  return { tier, durationMs }
}
