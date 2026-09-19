import { describe, expect, it, vi } from 'vitest'

const getFailed = vi.fn()

vi.mock('bullmq', () => ({
  Queue: class {
    constructor(public name: string) {}
    getFailed(start: number, end: number) {
      return getFailed(this.name, start, end)
    }
  },
}))
vi.mock('@/src/lib/queue/connection', () => ({
  getQueueConnection: () => ({}),
}))

import { getRecentJobFailures } from '../queue/health'
import { QueueName } from '../queue/jobs'

describe('getRecentJobFailures()', () => {
  it('merges the latest failures of every queue, newest first and scrubbed', async () => {
    getFailed.mockImplementation(async (name: string) => {
      if (name === QueueName.DatabaseBackup) {
        return [
          {
            id: '7',
            name: 'run-full-backup',
            failedReason: 'pg_dump falhou para admin@acme.com',
            attemptsMade: 3,
            finishedOn: Date.parse('2026-09-19T10:00:00Z'),
          },
          undefined,
        ]
      }
      if (name === QueueName.DataRetention) {
        return [
          {
            id: undefined,
            name: 'cleanup',
            failedReason: undefined,
            attemptsMade: undefined,
            finishedOn: undefined,
          },
          {
            id: '9',
            name: 'cleanup',
            failedReason: 'timeout',
            attemptsMade: 1,
            finishedOn: Date.parse('2026-09-19T11:00:00Z'),
          },
        ]
      }
      return []
    })

    const failures = await getRecentJobFailures(5, 10)

    expect(getFailed).toHaveBeenCalledWith(QueueName.DatabaseBackup, 0, 4)
    expect(failures).toEqual([
      {
        queue: QueueName.DataRetention,
        jobId: '9',
        jobName: 'cleanup',
        reason: 'timeout',
        attempts: 1,
        failedAt: '2026-09-19T11:00:00.000Z',
      },
      {
        queue: QueueName.DatabaseBackup,
        jobId: '7',
        jobName: 'run-full-backup',
        reason: 'pg_dump falhou para [email]',
        attempts: 3,
        failedAt: '2026-09-19T10:00:00.000Z',
      },
      {
        queue: QueueName.DataRetention,
        jobId: null,
        jobName: 'cleanup',
        reason: null,
        attempts: 0,
        failedAt: null,
      },
    ])
  })

  it('caps the merged list', async () => {
    getFailed.mockResolvedValue([
      { id: '1', name: 'a', attemptsMade: 1, finishedOn: 1 },
    ])
    expect(await getRecentJobFailures(1, 2)).toHaveLength(2)
  })
})
