import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import { sdNotifyTicketOf } from '@/src/lib/servicedesk/notify'
import type { SdTicketPrefixes } from '@/src/lib/servicedesk/ticket-code'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  type SdTaskReminderKind,
  type SdTaskReminderRow,
  SdTicketTaskRepository,
} from '@/src/repositories/sd-ticket-task.repository'
import { notifySdEvent } from './sd-notification.service'
import { SdTicketEngine, sdTicketCode } from './sd-ticket-engine'

/**
 * Due-date notices of ticket tasks (`servicedesk-task-reminders`, every 15
 * minutes): the assignee hears once when the task is due within the next
 * hour and once when it is past due, through the catalog event `task.due`.
 *
 * Idempotent: every notice is claimed first with a conditional stamp
 * (`dueSoonNotifiedAt` / `overdueNotifiedAt`), so a retry or two overlapping
 * ticks never repeat it. Changing the due date re-arms both notices.
 */

const HOUR_MS = 60 * 60 * 1000
/** "Due soon" = within the next hour. */
export const SD_TASK_DUE_SOON_MS = HOUR_MS
/** Deadlines older than this are never announced (no flood on first run). */
export const SD_TASK_OVERDUE_WINDOW_MS = 24 * HOUR_MS
const BATCH = 500

export interface SdTaskReminderTickResult {
  workspaces: number
  candidates: number
  dueSoon: number
  overdue: number
  /** Already claimed by another tick. */
  skipped: number
  errors: number
}

function kindOf(row: SdTaskReminderRow, now: Date): SdTaskReminderKind {
  return row.dueDate && row.dueDate.getTime() <= now.getTime()
    ? 'overdue'
    : 'due_soon'
}

export const SdTaskReminderService = {
  async runTick(now = new Date()): Promise<Result<SdTaskReminderTickResult>> {
    const result: SdTaskReminderTickResult = {
      workspaces: 0,
      candidates: 0,
      dueSoon: 0,
      overdue: 0,
      skipped: 0,
      errors: 0,
    }

    const enabled = await SdTicketContextRepository.listEnabledWorkspaceIds()
    if (!enabled.ok) return enabled
    result.workspaces = enabled.value.length

    const rows = await SdTicketTaskRepository.listDueReminders({
      workspaceIds: enabled.value,
      now,
      soonUntil: new Date(now.getTime() + SD_TASK_DUE_SOON_MS),
      overdueFrom: new Date(now.getTime() - SD_TASK_OVERDUE_WINDOW_MS),
      limit: BATCH,
    })
    if (!rows.ok) return rows
    result.candidates = rows.value.length

    const prefixes = new Map<string, SdTicketPrefixes | null>()
    const prefixesOf = async (workspaceId: string) => {
      if (!prefixes.has(workspaceId)) {
        const config = await SdTicketEngine.loadConfig(workspaceId)
        prefixes.set(workspaceId, config.ok ? config.value.prefixes : null)
      }
      return prefixes.get(workspaceId) ?? null
    }

    for (const row of rows.value) {
      const kind = kindOf(row, now)
      const claimed = await SdTicketTaskRepository.claimReminder(
        row.id,
        kind,
        now,
      )
      if (!claimed.ok) {
        result.errors += 1
        continue
      }
      if (!claimed.value) {
        result.skipped += 1
        continue
      }

      const workspacePrefixes = await prefixesOf(row.workspaceId)
      if (!workspacePrefixes) {
        result.errors += 1
        continue
      }
      const code = sdTicketCode(row.ticket, workspacePrefixes)
      const sent = await notifySdEvent({
        workspaceId: row.workspaceId,
        event: 'task.due',
        ticket: sdNotifyTicketOf(row.ticket, code),
        audience: 'payload',
        payload: {
          title:
            kind === 'overdue'
              ? `Tarefa vencida em ${code}`
              : `Tarefa vence em menos de 1 hora em ${code}`,
          body: row.title,
          userIds: [row.assigneeId],
          meta: { taskId: row.id, reminder: kind },
        },
      })
      if (!sent.ok) {
        result.errors += 1
        logger.warn('servicedesk.task_reminder.notify_failed', {
          workspaceId: row.workspaceId,
          taskId: row.id,
          reason: sent.error.code,
        })
        continue
      }
      if (kind === 'overdue') result.overdue += 1
      else result.dueSoon += 1
    }

    logger.info('servicedesk.task_reminder.tick', { ...result })
    return ok(result)
  },
}
