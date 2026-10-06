import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  runTick: vi.fn(),
}))

vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.loggerMock }))
vi.mock('@/src/services/crm-task-reminder.service', () => ({
  CrmTaskReminderService: { runTick: mocks.runTick },
}))

import { CrmTaskRemindersJob, QueueName } from '@/src/lib/queue/jobs'
import { processCrmTaskReminders } from '@/src/lib/queue/processors/crm-task-reminders'

function job(name: string, id: string | null = 'job-1'): Job {
  return { id: id ?? undefined, name, data: {} } as unknown as Job
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processCrmTaskReminders', () => {
  it('should register its own queue name', () => {
    expect(QueueName.CrmTaskReminders).toBe('crm-task-reminders')
  })

  it('should run the tick and log the tallies', async () => {
    const tally = { candidates: 2, dueSoon: 1, overdue: 1, notified: 2 }
    mocks.runTick.mockResolvedValue({ ok: true, value: tally })

    expect(
      await processCrmTaskReminders(job(CrmTaskRemindersJob.RunTick)),
    ).toEqual(tally)
    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      'queue.crm_task_reminders.tick_completed',
      expect.objectContaining({ jobId: 'job-1', notified: 2 }),
    )
  })

  it('should throw so BullMQ retries when the listing fails', async () => {
    mocks.runTick.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    await expect(
      processCrmTaskReminders(job(CrmTaskRemindersJob.RunTick)),
    ).rejects.toThrow('Failed to run CRM task reminders: DATABASE_ERROR (down)')
  })

  it('should reject an unknown job name', async () => {
    await expect(processCrmTaskReminders(job('nope', null))).rejects.toThrow(
      'Unknown crm-task-reminders job: nope (id=unknown)',
    )
  })
})
