import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  CrmTaskReminderService,
  type CrmTaskReminderTickResult,
} from '@/src/services/crm-task-reminder.service'
import { CrmTaskRemindersJob } from '../jobs'

export async function processCrmTaskReminders(
  job: Job,
): Promise<CrmTaskReminderTickResult> {
  switch (job.name) {
    case CrmTaskRemindersJob.RunTick: {
      const result = await CrmTaskReminderService.runTick()
      if (!result.ok) {
        // Listing failed: throw so BullMQ retries (dedupe keeps it idempotent).
        throw new Error(
          `Failed to run CRM task reminders: ${result.error.code} (${result.error.message})`,
        )
      }
      logger.info('queue.crm_task_reminders.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown crm-task-reminders job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
