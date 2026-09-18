import type { Job } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'

const { expireDueMock, loggerMock } = vi.hoisted(() => ({
  expireDueMock: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/crm-proposal.service', () => ({
  CrmProposalService: { expireDue: expireDueMock },
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { CrmProposalExpiryJob } from '@/src/lib/queue/jobs'
import { processCrmProposalExpiry } from '@/src/lib/queue/processors/crm-proposal-expiry'

function fakeJob(name: string, id = 'job-1'): Job {
  return { id, name, data: {} } as unknown as Job
}

describe('processCrmProposalExpiry', () => {
  it('expires the overdue proposals on the daily tick', async () => {
    expireDueMock.mockResolvedValue({
      ok: true,
      value: { candidates: 3, expired: 2, notified: 1 },
    })

    const result = await processCrmProposalExpiry(
      fakeJob(CrmProposalExpiryJob.RunTick),
    )

    expect(result).toEqual({ candidates: 3, expired: 2, notified: 1 })
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.crm_proposal_expiry.tick_completed',
      expect.objectContaining({ expired: 2, notified: 1 }),
    )
  })

  it('throws so BullMQ retries when the database read fails', async () => {
    expireDueMock.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })

    await expect(
      processCrmProposalExpiry(fakeJob(CrmProposalExpiryJob.RunTick)),
    ).rejects.toThrow('DATABASE_ERROR')
  })

  it('rejects unknown job names', async () => {
    await expect(processCrmProposalExpiry(fakeJob('nope'))).rejects.toThrow(
      'Unknown crm-proposal-expiry job',
    )
  })
})
