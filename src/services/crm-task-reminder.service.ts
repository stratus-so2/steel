import { ok, type Result } from '@/src/lib/result'
import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import { notifyCrmTaskDue } from './crm-notifications'

/** Tasks due within this window get the "vence em breve" reminder. */
export const CRM_TASK_DUE_SOON_MS = 60 * 60 * 1000

/**
 * How far back an overdue task is still reminded. Bounds the first run (and
 * any long worker outage) so years-old overdue tasks do not flood the inbox.
 */
export const CRM_TASK_OVERDUE_LOOKBACK_MS = 24 * 60 * 60 * 1000

/** Rows per tick — the next tick (15 min) picks up whatever is left. */
const BATCH_LIMIT = 500

export interface CrmTaskReminderTickResult {
  candidates: number
  dueSoon: number
  overdue: number
  notified: number
}

export const CrmTaskReminderService = {
  /**
   * Reminder tick: every open, assigned task due in the next hour gets a
   * "due soon" notice and every one that is overdue (within the lookback)
   * gets an "overdue" notice — once each, via the notification dedupe key,
   * so a re-run or overlapping tick never duplicates. Delivery failures are
   * swallowed by the emitter; only the listing failure is an error.
   */
  async runTick(
    now: Date = new Date(),
  ): Promise<Result<CrmTaskReminderTickResult>> {
    const tasks = await CrmTaskRepository.listDueForReminder(
      new Date(now.getTime() - CRM_TASK_OVERDUE_LOOKBACK_MS),
      new Date(now.getTime() + CRM_TASK_DUE_SOON_MS),
      BATCH_LIMIT,
    )
    if (!tasks.ok) return tasks

    let dueSoon = 0
    let overdue = 0
    let notified = 0
    for (const task of tasks.value) {
      if (!task.assigneeId || !task.dueDate) continue
      const isOverdue = task.dueDate.getTime() <= now.getTime()
      if (isOverdue) overdue += 1
      else dueSoon += 1
      notified += await notifyCrmTaskDue({
        workspaceId: task.workspaceId,
        task: {
          id: task.id,
          title: task.title,
          assigneeId: task.assigneeId,
          dueDate: task.dueDate,
        },
        overdue: isOverdue,
      })
    }

    return ok({ candidates: tasks.value.length, dueSoon, overdue, notified })
  },
}
