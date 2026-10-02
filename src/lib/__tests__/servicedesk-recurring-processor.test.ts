import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { runTickMock, loggerMock } = vi.hoisted(() => ({
  runTickMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/sd-recurring-ticket-runner', () => ({
  SdRecurringTicketRunner: { runTick: runTickMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { processServicedeskRecurring } from '@/src/lib/queue/processors/servicedesk-recurring'

function fakeJob(name: string, id?: string): Job {
  return { id, name, data: {} } as unknown as Job
}

describe('processServicedeskRecurring', () => {
  it('roda o tick das rotinas e loga o desfecho', async () => {
    const result = {
      workspaces: 1,
      rules: 3,
      created: 2,
      skipped: 1,
      failed: 0,
      errors: 0,
    }
    runTickMock.mockResolvedValue(result)

    await expect(
      processServicedeskRecurring(fakeJob('run-tick', 'j1')),
    ).resolves.toBe(result)
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.servicedesk_recurring.tick_completed',
      expect.objectContaining({ jobId: 'j1', created: 2, skipped: 1 }),
    )
  })

  it('recusa um nome de job desconhecido', async () => {
    await expect(processServicedeskRecurring(fakeJob('nope'))).rejects.toThrow(
      'Unknown servicedesk-recurring job: nope (id=unknown)',
    )
    await expect(
      processServicedeskRecurring(fakeJob('nope', 'x')),
    ).rejects.toThrow('(id=x)')
  })
})
