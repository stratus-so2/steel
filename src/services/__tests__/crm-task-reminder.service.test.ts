import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-task.repository')
vi.mock('../crm-notifications', () => ({ notifyCrmTaskDue: vi.fn() }))

import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import { notifyCrmTaskDue } from '../crm-notifications'
import {
  CRM_TASK_DUE_SOON_MS,
  CRM_TASK_OVERDUE_LOOKBACK_MS,
  CrmTaskReminderService,
} from '../crm-task-reminder.service'

const mockedTaskRepo = vi.mocked(CrmTaskRepository)
const mockedNotify = vi.mocked(notifyCrmTaskDue)

const NOW = new Date('2026-10-06T12:00:00.000Z')
const at = (offsetMs: number) => new Date(NOW.getTime() + offsetMs)

beforeEach(() => {
  vi.clearAllMocks()
  mockedNotify.mockResolvedValue(1)
})

describe('CrmTaskReminderService.runTick', () => {
  it('should query the [now - lookback, now + 1h] window', async () => {
    mockedTaskRepo.listDueForReminder.mockResolvedValue(ok([]))

    expectOk(await CrmTaskReminderService.runTick(NOW))

    expect(mockedTaskRepo.listDueForReminder).toHaveBeenCalledWith(
      at(-CRM_TASK_OVERDUE_LOOKBACK_MS),
      at(CRM_TASK_DUE_SOON_MS),
      500,
    )
  })

  it('should remind due-soon and overdue tasks and count them', async () => {
    const soon = createFakeCrmTask({
      id: 't1',
      workspaceId: 'ws1',
      title: 'Ligar',
      assigneeId: 'u1',
      dueDate: at(30 * 60 * 1000),
    })
    const late = createFakeCrmTask({
      id: 't2',
      workspaceId: 'ws1',
      title: 'Enviar proposta',
      assigneeId: 'u2',
      dueDate: at(-60 * 1000),
    })
    const unassigned = createFakeCrmTask({ id: 't3', assigneeId: null })
    mockedTaskRepo.listDueForReminder.mockResolvedValue(
      ok([soon, late, unassigned]),
    )
    mockedNotify.mockResolvedValueOnce(1).mockResolvedValueOnce(0)

    const result = expectOk(await CrmTaskReminderService.runTick(NOW))

    expect(result).toEqual({
      candidates: 3,
      dueSoon: 1,
      overdue: 1,
      notified: 1,
    })
    expect(mockedNotify).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      task: {
        id: 't1',
        title: 'Ligar',
        assigneeId: 'u1',
        dueDate: soon.dueDate,
      },
      overdue: false,
    })
    expect(mockedNotify).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({ id: 't2' }),
        overdue: true,
      }),
    )
    expect(mockedNotify).toHaveBeenCalledTimes(2)
  })

  it('should treat a task due exactly now as overdue', async () => {
    mockedTaskRepo.listDueForReminder.mockResolvedValue(
      ok([createFakeCrmTask({ assigneeId: 'u1', dueDate: NOW })]),
    )

    const result = expectOk(await CrmTaskReminderService.runTick(NOW))

    expect(result.overdue).toBe(1)
  })

  it('should propagate a listing failure', async () => {
    mockedTaskRepo.listDueForReminder.mockResolvedValue(
      err({ code: 'DATABASE_ERROR', message: 'down' }),
    )

    expectErr(await CrmTaskReminderService.runTick(NOW), 'DATABASE_ERROR')
    expect(mockedNotify).not.toHaveBeenCalled()
  })

  it('should default to the current time', async () => {
    mockedTaskRepo.listDueForReminder.mockResolvedValue(ok([]))

    expectOk(await CrmTaskReminderService.runTick())

    expect(mockedTaskRepo.listDueForReminder).toHaveBeenCalledTimes(1)
  })
})
