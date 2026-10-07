import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/inbox-ai-pending.service', () => ({
  InboxAiPendingService: { notifyExpiring: vi.fn() },
}))

import { NotificationsJob, QueueName } from '@/src/lib/queue/jobs'
import { processNotifications } from '@/src/lib/queue/processors/notifications'
import { InboxAiPendingService } from '@/src/services/inbox-ai-pending.service'

const job = (name: string) => ({ id: 'j1', name, data: {} }) as Job
const mockedNotify = vi.mocked(InboxAiPendingService.notifyExpiring)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processNotifications', () => {
  it('should name the queue and the job', () => {
    expect(QueueName.Notifications).toBe('notifications')
    expect(NotificationsJob.AiActionExpiryTick).toBe('ai-action-expiry-tick')
  })

  it('should run the expiry tick and report how many were sent', async () => {
    mockedNotify.mockResolvedValue(ok(3))

    await expect(
      processNotifications(job(NotificationsJob.AiActionExpiryTick)),
    ).resolves.toEqual({ sent: 3 })
    expect(mockedNotify).toHaveBeenCalledTimes(1)
  })

  it('should throw when the tick fails, so BullMQ retries it', async () => {
    mockedNotify.mockResolvedValue(err(databaseError('down')))

    await expect(
      processNotifications(job(NotificationsJob.AiActionExpiryTick)),
    ).rejects.toThrow(/notifications expiry tick failed: DATABASE_ERROR/)
  })

  it('should reject an unknown job', async () => {
    await expect(processNotifications(job('nope'))).rejects.toThrow(
      'Unknown notifications job: nope (id=j1)',
    )
  })

  it('should name a job without id', async () => {
    await expect(
      processNotifications({ name: 'nope', data: {} } as Job),
    ).rejects.toThrow('(id=unknown)')
  })
})
