import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import {
  SdTaskReminderService,
  type SdTaskReminderTickResult,
} from '@/src/services/sd-task-reminder.service'
import { ServicedeskTaskRemindersJob } from '../jobs'

/**
 * Queue `servicedesk-task-reminders` (`ServicedeskTaskRemindersCron`, every
 * 15 min): `SdTaskReminderService.runTick` tells task assignees about
 * deadlines within the hour and past due. Idempotent — every notice is
 * claimed with a stamp on the task before it is sent.
 */
export async function processServicedeskTaskReminders(
  job: Job,
): Promise<SdTaskReminderTickResult> {
  switch (job.name) {
    case ServicedeskTaskRemindersJob.RunTick: {
      const result = await SdTaskReminderService.runTick()
      if (!result.ok) {
        throw new Error(
          `servicedesk-task-reminders tick failed: ${result.error.code} ${result.error.message}`,
        )
      }
      logger.info('queue.servicedesk_task_reminders.tick_completed', {
        component: 'Worker',
        jobId: job.id,
        ...result.value,
      })
      return result.value
    }
    default:
      throw new Error(
        `Unknown servicedesk-task-reminders job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
