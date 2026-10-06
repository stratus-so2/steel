import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/src/services/sd-task-reminder.service', () => ({
  SdTaskReminderService: { runTick: vi.fn() },
}))

import { ServicedeskTaskRemindersJob } from '@/src/lib/queue/jobs'
import { processServicedeskTaskReminders } from '@/src/lib/queue/processors/servicedesk-task-reminders'
import { SdTaskReminderService } from '@/src/services/sd-task-reminder.service'

const service = vi.mocked(SdTaskReminderService)

const job = (name: string): Job => ({ id: 'j1', name, data: {} }) as Job

const tick = {
  workspaces: 1,
  candidates: 2,
  dueSoon: 1,
  overdue: 1,
  skipped: 0,
  errors: 0,
}

beforeEach(() => {
  service.runTick.mockResolvedValue(ok(tick))
})

describe('processServicedeskTaskReminders', () => {
  it('runs the tick', async () => {
    await expect(
      processServicedeskTaskReminders(job(ServicedeskTaskRemindersJob.RunTick)),
    ).resolves.toEqual(tick)
  })

  it('throws when the tick fails so the job is marked failed', async () => {
    service.runTick.mockResolvedValue(err(databaseError()))
    await expect(
      processServicedeskTaskReminders(job(ServicedeskTaskRemindersJob.RunTick)),
    ).rejects.toThrow('servicedesk-task-reminders tick failed')
  })

  it('rejects an unknown job', async () => {
    await expect(processServicedeskTaskReminders(job('nope'))).rejects.toThrow(
      'Unknown servicedesk-task-reminders job',
    )
  })
})
