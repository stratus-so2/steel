import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeSdSettings } from '@/src/__tests__/factories/sd-ticket-context.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import { DEFAULT_SD_TICKET_PREFIXES } from '@/src/lib/servicedesk/ticket-code'
import type { SdTaskReminderRow } from '@/src/repositories/sd-ticket-task.repository'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/repositories/sd-ticket-context.repository')
vi.mock('@/src/repositories/sd-ticket-task.repository')
vi.mock('../sd-notification.service', () => ({ notifySdEvent: vi.fn() }))
vi.mock('../sd-ticket-engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../sd-ticket-engine')>()),
  SdTicketEngine: { loadConfig: vi.fn() },
}))

import { logger } from '@/lib/axiom/logger'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { SdTicketTaskRepository } from '@/src/repositories/sd-ticket-task.repository'
import { notifySdEvent } from '../sd-notification.service'
import {
  SD_TASK_DUE_SOON_MS,
  SD_TASK_OVERDUE_WINDOW_MS,
  SdTaskReminderService,
} from '../sd-task-reminder.service'
import { SdTicketEngine } from '../sd-ticket-engine'

const ctxRepo = vi.mocked(SdTicketContextRepository)
const tasks = vi.mocked(SdTicketTaskRepository)
const engine = vi.mocked(SdTicketEngine)
const notify = vi.mocked(notifySdEvent)

const NOW = new Date('2026-10-06T12:00:00.000Z')

function row(overrides: Partial<SdTaskReminderRow> = {}): SdTaskReminderRow {
  return {
    id: 'task1',
    workspaceId: 'ws1',
    ticketId: 't1',
    title: 'Trocar o cabo',
    description: null,
    status: 'TODO',
    assigneeId: 'agent',
    dueDate: new Date(NOW.getTime() + 30 * 60_000),
    completedAt: null,
    position: 0,
    createdById: 'u1',
    createdAt: NOW,
    updatedAt: NOW,
    dueSoonNotifiedAt: null,
    overdueNotifiedAt: null,
    ticket: {
      id: 't1',
      workspaceId: 'ws1',
      number: 7,
      type: 'INCIDENT',
      title: 'Rede caiu',
      assigneeId: 'lead',
      requesterId: 'req',
      departmentId: 'd1',
      participants: [],
      contact: null,
    },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  ctxRepo.listEnabledWorkspaceIds.mockResolvedValue(ok(['ws1', 'ws2']))
  tasks.listDueReminders.mockResolvedValue(ok([row()]))
  tasks.claimReminder.mockResolvedValue(ok(true))
  engine.loadConfig.mockResolvedValue(
    ok({
      settings: createFakeSdSettings(),
      prefixes: DEFAULT_SD_TICKET_PREFIXES,
    }),
  )
  notify.mockResolvedValue(
    ok({
      event: 'task.due',
      recipients: 1,
      inApp: 1,
      email: 0,
      whatsapp: 0,
      skipped: null,
    }),
  )
})

describe('SdTaskReminderService.runTick', () => {
  it('queries the enabled workspaces with the soon and overdue windows', async () => {
    expectOk(await SdTaskReminderService.runTick(NOW))
    expect(tasks.listDueReminders).toHaveBeenCalledWith({
      workspaceIds: ['ws1', 'ws2'],
      now: NOW,
      soonUntil: new Date(NOW.getTime() + SD_TASK_DUE_SOON_MS),
      overdueFrom: new Date(NOW.getTime() - SD_TASK_OVERDUE_WINDOW_MS),
      limit: 500,
    })
  })

  it('claims and sends the "due soon" notice to the task assignee only', async () => {
    const result = expectOk(await SdTaskReminderService.runTick(NOW))
    expect(result).toMatchObject({ candidates: 1, dueSoon: 1, overdue: 0 })
    expect(tasks.claimReminder).toHaveBeenCalledWith('task1', 'due_soon', NOW)
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws1',
        event: 'task.due',
        audience: 'payload',
        ticket: expect.objectContaining({ id: 't1', code: 'INC-000007' }),
        payload: expect.objectContaining({
          title: 'Tarefa vence em menos de 1 hora em INC-000007',
          body: 'Trocar o cabo',
          userIds: ['agent'],
        }),
      }),
    )
  })

  it('sends the overdue notice for a past deadline', async () => {
    tasks.listDueReminders.mockResolvedValue(
      ok([row({ dueDate: new Date(NOW.getTime() - 1) })]),
    )
    const result = expectOk(await SdTaskReminderService.runTick(NOW))
    expect(result).toMatchObject({ dueSoon: 0, overdue: 1 })
    expect(tasks.claimReminder).toHaveBeenCalledWith('task1', 'overdue', NOW)
    expect(notify.mock.calls[0][0].payload.title).toBe(
      'Tarefa vencida em INC-000007',
    )
  })

  it('is idempotent: a notice claimed by another tick is not sent again', async () => {
    tasks.claimReminder.mockResolvedValue(ok(false))
    const result = expectOk(await SdTaskReminderService.runTick(NOW))
    expect(result.skipped).toBe(1)
    expect(notify).not.toHaveBeenCalled()
  })

  it('counts a claim failure as an error and goes on', async () => {
    tasks.listDueReminders.mockResolvedValue(ok([row(), row({ id: 'task2' })]))
    tasks.claimReminder.mockResolvedValueOnce(err(databaseError()))
    const result = expectOk(await SdTaskReminderService.runTick(NOW))
    expect(result).toMatchObject({ errors: 1, dueSoon: 1 })
  })

  it('loads each workspace config once and skips workspaces without one', async () => {
    tasks.listDueReminders.mockResolvedValue(
      ok([
        row(),
        row({ id: 'task2' }),
        row({ id: 'task3', workspaceId: 'ws2' }),
      ]),
    )
    engine.loadConfig.mockImplementation(async (workspaceId) =>
      workspaceId === 'ws2'
        ? err(databaseError())
        : ok({
            settings: createFakeSdSettings(),
            prefixes: DEFAULT_SD_TICKET_PREFIXES,
          }),
    )
    const result = expectOk(await SdTaskReminderService.runTick(NOW))
    expect(engine.loadConfig).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ dueSoon: 2, errors: 1 })
  })

  it('logs a failed delivery without failing the tick', async () => {
    notify.mockResolvedValue(err(databaseError()))
    const result = expectOk(await SdTaskReminderService.runTick(NOW))
    expect(result).toMatchObject({ errors: 1, dueSoon: 0 })
    expect(logger.warn).toHaveBeenCalledWith(
      'servicedesk.task_reminder.notify_failed',
      expect.objectContaining({ taskId: 'task1' }),
    )
  })

  it('fails when the workspaces or the tasks cannot be listed', async () => {
    ctxRepo.listEnabledWorkspaceIds.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTaskReminderService.runTick(NOW), 'DATABASE_ERROR')
    tasks.listDueReminders.mockResolvedValueOnce(err(databaseError()))
    expectErr(await SdTaskReminderService.runTick(NOW), 'DATABASE_ERROR')
  })

  it('uses the current time by default', async () => {
    expectOk(await SdTaskReminderService.runTick())
    expect(tasks.listDueReminders.mock.calls[0][0].now).toBeInstanceOf(Date)
  })
})
