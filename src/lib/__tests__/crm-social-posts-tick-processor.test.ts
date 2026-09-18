import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  findDue: vi.fn(),
  claim: vi.fn(),
  setStatus: vi.fn(),
  publishScheduledPost: vi.fn(),
}))

vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.loggerMock }))
vi.mock('@/src/repositories/crm-social.repository', () => ({
  CrmScheduledPostRepository: {
    findDue: mocks.findDue,
    claim: mocks.claim,
    setStatus: mocks.setStatus,
  },
}))
vi.mock('@/src/services/crm-social-scheduler', () => ({
  publishScheduledPost: mocks.publishScheduledPost,
}))

import { CrmSocialPostsTickJob } from '@/src/lib/queue/jobs'
import { processCrmSocialPostsTick } from '@/src/lib/queue/processors/crm-social-posts-tick'

function tickJob(name: string = CrmSocialPostsTickJob.RunTick): Job {
  return { id: 'tick-1', name, data: {} } as unknown as Job
}

const post = (id: string) => ({ id, status: 'SCHEDULED', workspaceId: 'ws-1' })

beforeEach(() => {
  vi.clearAllMocks()
  mocks.setStatus.mockResolvedValue({ ok: true, value: {} })
})

describe('processCrmSocialPostsTick', () => {
  it('claims and publishes each due post, tallying outcomes', async () => {
    mocks.findDue.mockResolvedValue({
      ok: true,
      value: [post('p1'), post('p2'), post('p3'), post('p4'), post('p5')],
    })
    mocks.claim
      .mockResolvedValueOnce({ ok: true, value: true }) // p1 publica
      .mockResolvedValueOnce({ ok: true, value: false }) // p2 já reivindicado
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'DATABASE_ERROR', message: 'x' },
      }) // p3 erro no claim
      .mockResolvedValueOnce({ ok: true, value: true }) // p4 publish lança Error
      .mockResolvedValueOnce({ ok: true, value: true }) // p5 publish lança string
    mocks.publishScheduledPost
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('graph down'))
      .mockRejectedValueOnce('weird')

    const result = await processCrmSocialPostsTick(tickJob())

    expect(result).toEqual({ considered: 5, dispatched: 1, errors: 3 })
    expect(mocks.publishScheduledPost).toHaveBeenCalledWith({
      ...post('p1'),
      status: 'PUBLISHING',
    })
    expect(mocks.publishScheduledPost).toHaveBeenCalledTimes(3)
    expect(mocks.setStatus).toHaveBeenCalledWith('p4', 'FAILED', {
      lastError: 'Erro inesperado ao publicar',
    })
    expect(mocks.setStatus).toHaveBeenCalledWith('p5', 'FAILED', {
      lastError: 'Erro inesperado ao publicar',
    })
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_posts_tick.publish_failed',
      expect.objectContaining({ postId: 'p4', message: 'graph down' }),
    )
    expect(mocks.loggerMock.error).toHaveBeenCalledWith(
      'queue.crm_social_posts_tick.publish_failed',
      expect.objectContaining({ postId: 'p5', message: 'weird' }),
    )
    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      'queue.crm_social_posts_tick.tick_completed',
      expect.objectContaining({ considered: 5, dispatched: 1, errors: 3 }),
    )
  })

  it('throws when listing due posts fails', async () => {
    mocks.findDue.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    await expect(processCrmSocialPostsTick(tickJob())).rejects.toThrow(
      'Failed to list due CRM scheduled posts: DATABASE_ERROR',
    )
    expect(mocks.claim).not.toHaveBeenCalled()
  })

  it('throws on an unknown job name', async () => {
    await expect(processCrmSocialPostsTick(tickJob('other'))).rejects.toThrow(
      'Unknown crm-social-posts-tick job: other (id=tick-1)',
    )
  })
})
