import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/services/crm-campaign-send.service', () => ({
  CrmCampaignSendService: {
    dispatch: vi.fn(),
    send: vi.fn(),
    tick: vi.fn(),
  },
}))

import { CrmCampaignSendService } from '@/src/services/crm-campaign-send.service'
import {
  processCrmCampaigns,
  runCrmCampaignsJob,
} from '../queue/processors/crm-campaigns'

const service = vi.mocked(CrmCampaignSendService)
const NOW = new Date('2026-10-09T13:00:00.000Z')

function job(name: string, data: unknown = {}): Job {
  return { id: 'j1', name, data } as Job
}

beforeEach(() => {
  service.dispatch.mockResolvedValue(ok({ status: 'queued', count: 2 }))
  service.send.mockResolvedValue(ok({ status: 'sent', providerMessageId: 'p' }))
  service.tick.mockResolvedValue(ok({ campaigns: 1, released: 0 }))
})

describe('crm-campaigns processor', () => {
  it('should dispatch a channel with the injected clock', async () => {
    const data = { campaignId: 'c1', channel: 'EMAIL' }
    expect(await runCrmCampaignsJob(job('dispatch', data), NOW)).toEqual({
      status: 'queued',
      count: 2,
    })
    expect(service.dispatch).toHaveBeenCalledWith('c1', 'EMAIL', NOW)
  })

  it('should send one message', async () => {
    const data = { campaignId: 'c1', recipientId: 'r1', channel: 'WHATSAPP' }
    expect(await runCrmCampaignsJob(job('send', data), NOW)).toEqual({
      status: 'sent',
      providerMessageId: 'p',
    })
    expect(service.send).toHaveBeenCalledWith('c1', 'r1', 'WHATSAPP', NOW)
  })

  it('should throw to retry a rate-limited send', async () => {
    service.send.mockResolvedValue(ok({ status: 'retry', reason: 'slow down' }))
    await expect(
      runCrmCampaignsJob(
        job('send', { campaignId: 'c', recipientId: 'r', channel: 'EMAIL' }),
        NOW,
      ),
    ).rejects.toThrow('CRM campaign send deferred: slow down')
  })

  it('should run the tick', async () => {
    expect(await runCrmCampaignsJob(job('tick'), NOW)).toEqual({
      campaigns: 1,
      released: 0,
    })
    expect(service.tick).toHaveBeenCalledWith(NOW)
  })

  it('should throw on service errors and unknown jobs', async () => {
    service.dispatch.mockResolvedValue(err(databaseError('x')))
    service.send.mockResolvedValue(err(databaseError('x')))
    service.tick.mockResolvedValue(err(databaseError('x')))
    await expect(runCrmCampaignsJob(job('dispatch', {}), NOW)).rejects.toThrow(
      'DATABASE_ERROR',
    )
    await expect(runCrmCampaignsJob(job('send', {}), NOW)).rejects.toThrow(
      'DATABASE_ERROR',
    )
    await expect(runCrmCampaignsJob(job('tick'), NOW)).rejects.toThrow(
      'DATABASE_ERROR',
    )
    await expect(runCrmCampaignsJob(job('nope'), NOW)).rejects.toThrow(
      'Unknown crm-campaigns job: nope (id=j1)',
    )
    await expect(
      runCrmCampaignsJob({ name: 'nope', data: {} } as Job, NOW),
    ).rejects.toThrow('(id=unknown)')
  })

  it('should take only the job and use the real clock', async () => {
    await processCrmCampaigns(job('tick'))
    expect(service.tick.mock.calls[0][0]).toBeInstanceOf(Date)
  })
})
