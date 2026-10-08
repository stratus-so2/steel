import type { Job } from 'bullmq'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { parseUtcDay } from '@/src/lib/ai/usage-period'
import {
  AiUsageWeeklyEmailService,
  type AiUsageWeeklyPlan,
  type AiUsageWeeklySendResult,
} from '@/src/services/ai-usage-weekly-email.service'
import {
  AiUsageWeeklyEmailJob,
  type AiUsageWeeklyEmailJobPayload,
} from '../jobs'
import { getAiUsageWeeklyEmailQueue } from '../queues'

export interface AiUsageWeeklyTickResult {
  weekKey: string
  candidates: number
  enqueued: number
  skipped: AiUsageWeeklyPlan['skipped']
}

/** Deterministic id: BullMQ drops a second job with the same id. */
export function aiUsageWeeklyEmailJobId(
  workspaceId: string,
  weekKey: string,
): string {
  return `ai-usage-weekly-email-${workspaceId}-${weekKey}`
}

async function runTick(job: Job): Promise<AiUsageWeeklyTickResult> {
  const plan = await AiUsageWeeklyEmailService.planWeek()
  if (!plan.ok) {
    // Batch read failed: throw so BullMQ retries the tick.
    throw new Error(
      `Failed to plan the weekly AI usage e-mail: ${plan.error.code} (${plan.error.message})`,
    )
  }
  const { weekKey, eligible, candidates, skipped } = plan.value
  const queue = getAiUsageWeeklyEmailQueue()
  if (eligible.length > 0) {
    await queue.addBulk(
      eligible.map((workspaceId) => ({
        name: AiUsageWeeklyEmailJob.SendWorkspace,
        data: { workspaceId, weekStart: weekKey },
        opts: { jobId: aiUsageWeeklyEmailJobId(workspaceId, weekKey) },
      })),
    )
  }
  const result = { weekKey, candidates, enqueued: eligible.length, skipped }
  logger.info(
    'queue.ai_usage_weekly_email.tick_completed',
    logFields({ component: 'Worker' }, { jobId: job.id ?? null, ...result }),
  )
  return result
}

async function sendWorkspace(job: Job): Promise<AiUsageWeeklySendResult> {
  const data =
    job.data as AiUsageWeeklyEmailJobPayload[typeof AiUsageWeeklyEmailJob.SendWorkspace]
  const weekStart = parseUtcDay(data.weekStart ?? '')
  if (!data.workspaceId || !weekStart) {
    throw new Error(
      `Invalid ai-usage-weekly-email payload (id=${job.id ?? 'unknown'})`,
    )
  }
  const result = await AiUsageWeeklyEmailService.sendForWorkspace(
    data.workspaceId,
    weekStart,
  )
  if (!result.ok) {
    throw new Error(
      `Failed to build the weekly AI usage e-mail: ${result.error.code} (${result.error.message})`,
    )
  }
  logger.info(
    'queue.ai_usage_weekly_email.workspace_completed',
    logFields(
      { component: 'Worker', workspaceId: data.workspaceId },
      {
        jobId: job.id ?? null,
        weekKey: result.value.weekKey,
        status: result.value.status,
        reason: result.value.reason,
        sent: result.value.sent,
        alreadySent: result.value.alreadySent,
        failed: result.value.failed,
      },
    ),
  )
  if (result.value.failed > 0) {
    // Owners already mailed keep their marker, so the retry only resends
    // to the ones that failed.
    throw new Error(
      `Weekly AI usage e-mail failed for ${result.value.failed} owner(s) of ${data.workspaceId}`,
    )
  }
  return result.value
}

/**
 * Queue `ai-usage-weekly-email`: `tick` (Mondays 08:00 America/Sao_Paulo)
 * fans out one `send-workspace` per eligible workspace; each one mails the
 * owners (`AiUsageWeeklyEmailService.sendForWorkspace`).
 */
export async function processAiUsageWeeklyEmail(
  job: Job,
): Promise<AiUsageWeeklyTickResult | AiUsageWeeklySendResult> {
  switch (job.name) {
    case AiUsageWeeklyEmailJob.Tick:
      return runTick(job)
    case AiUsageWeeklyEmailJob.SendWorkspace:
      return sendWorkspace(job)
    default:
      throw new Error(
        `Unknown ai-usage-weekly-email job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
