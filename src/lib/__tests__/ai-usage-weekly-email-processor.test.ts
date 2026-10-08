import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { planWeek, sendForWorkspace, addBulk, loggerMock } = vi.hoisted(() => ({
  planWeek: vi.fn(),
  sendForWorkspace: vi.fn(),
  addBulk: vi.fn(),
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/services/ai-usage-weekly-email.service', () => ({
  AiUsageWeeklyEmailService: { planWeek, sendForWorkspace },
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getAiUsageWeeklyEmailQueue: () => ({ addBulk }),
}))
vi.mock('@/lib/axiom/logger', () => ({ logger: loggerMock }))

import { AiUsageWeeklyEmailJob } from '@/src/lib/queue/jobs'
import {
  aiUsageWeeklyEmailJobId,
  processAiUsageWeeklyEmail,
} from '@/src/lib/queue/processors/ai-usage-weekly-email'

function fakeJob(
  name: string,
  data: unknown = {},
  id: string | null = 'job-1',
): Job {
  return { id: id ?? undefined, name, data } as unknown as Job
}

function sendResult(overrides: Record<string, unknown> = {}) {
  return {
    workspaceId: 'ws1',
    weekKey: '2026-09-28',
    status: 'sent',
    reason: null,
    sent: 1,
    alreadySent: 0,
    failed: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('processAiUsageWeeklyEmail — tick', () => {
  it('fans out one job per eligible workspace with a deterministic id', async () => {
    planWeek.mockResolvedValue({
      ok: true,
      value: {
        weekStart: new Date('2026-09-28T00:00:00.000Z'),
        weekKey: '2026-09-28',
        candidates: 3,
        eligible: ['ws1', 'ws2'],
        skipped: { email_disabled: 1 },
      },
    })

    const result = await processAiUsageWeeklyEmail(
      fakeJob(AiUsageWeeklyEmailJob.Tick),
    )

    expect(result).toEqual({
      weekKey: '2026-09-28',
      candidates: 3,
      enqueued: 2,
      skipped: { email_disabled: 1 },
    })
    expect(addBulk).toHaveBeenCalledWith([
      {
        name: AiUsageWeeklyEmailJob.SendWorkspace,
        data: { workspaceId: 'ws1', weekStart: '2026-09-28' },
        opts: { jobId: 'ai-usage-weekly-email-ws1-2026-09-28' },
      },
      {
        name: AiUsageWeeklyEmailJob.SendWorkspace,
        data: { workspaceId: 'ws2', weekStart: '2026-09-28' },
        opts: { jobId: 'ai-usage-weekly-email-ws2-2026-09-28' },
      },
    ])
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.ai_usage_weekly_email.tick_completed',
      expect.objectContaining({
        component: 'Worker',
        detail: expect.stringContaining('"enqueued":2'),
      }),
    )
  })

  it('enqueues nothing when no workspace is eligible', async () => {
    planWeek.mockResolvedValue({
      ok: true,
      value: {
        weekStart: new Date('2026-09-28T00:00:00.000Z'),
        weekKey: '2026-09-28',
        candidates: 0,
        eligible: [],
        skipped: {},
      },
    })

    const result = await processAiUsageWeeklyEmail(
      fakeJob(AiUsageWeeklyEmailJob.Tick, {}, null),
    )

    expect(result).toMatchObject({ enqueued: 0 })
    expect(addBulk).not.toHaveBeenCalled()
  })

  it('throws so BullMQ retries when planning fails', async () => {
    planWeek.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })
    await expect(
      processAiUsageWeeklyEmail(fakeJob(AiUsageWeeklyEmailJob.Tick)),
    ).rejects.toThrow('DATABASE_ERROR')
  })
})

describe('processAiUsageWeeklyEmail — send-workspace', () => {
  const payload = { workspaceId: 'ws1', weekStart: '2026-09-28' }

  it('sends the workspace e-mail for the week in the payload', async () => {
    sendForWorkspace.mockResolvedValue({ ok: true, value: sendResult() })

    const result = await processAiUsageWeeklyEmail(
      fakeJob(AiUsageWeeklyEmailJob.SendWorkspace, payload),
    )

    expect(result).toEqual(sendResult())
    expect(sendForWorkspace).toHaveBeenCalledWith(
      'ws1',
      new Date('2026-09-28T00:00:00.000Z'),
    )
    expect(loggerMock.info).toHaveBeenCalledWith(
      'queue.ai_usage_weekly_email.workspace_completed',
      expect.objectContaining({ workspaceId: 'ws1' }),
    )
  })

  it('logs a skipped workspace without failing', async () => {
    sendForWorkspace.mockResolvedValue({
      ok: true,
      value: sendResult({ status: 'skipped', reason: 'no_usage', sent: 0 }),
    })
    const result = await processAiUsageWeeklyEmail(
      fakeJob(AiUsageWeeklyEmailJob.SendWorkspace, payload, null),
    )
    expect(result).toMatchObject({ status: 'skipped', reason: 'no_usage' })
  })

  it('throws when some owner failed, so only those are retried', async () => {
    sendForWorkspace.mockResolvedValue({
      ok: true,
      value: sendResult({ failed: 1 }),
    })
    await expect(
      processAiUsageWeeklyEmail(
        fakeJob(AiUsageWeeklyEmailJob.SendWorkspace, payload),
      ),
    ).rejects.toThrow('failed for 1 owner(s) of ws1')
  })

  it('throws when the report cannot be built', async () => {
    sendForWorkspace.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    })
    await expect(
      processAiUsageWeeklyEmail(
        fakeJob(AiUsageWeeklyEmailJob.SendWorkspace, payload),
      ),
    ).rejects.toThrow('DATABASE_ERROR')
  })

  it.each([
    [{ workspaceId: 'ws1', weekStart: '2026-13-01' }],
    [{ workspaceId: '', weekStart: '2026-09-28' }],
    [{ workspaceId: 'ws1' }],
  ])('rejects an invalid payload %j', async (data) => {
    await expect(
      processAiUsageWeeklyEmail(
        fakeJob(AiUsageWeeklyEmailJob.SendWorkspace, data),
      ),
    ).rejects.toThrow('Invalid ai-usage-weekly-email payload (id=job-1)')
    await expect(
      processAiUsageWeeklyEmail(
        fakeJob(AiUsageWeeklyEmailJob.SendWorkspace, data, null),
      ),
    ).rejects.toThrow('(id=unknown)')
    expect(sendForWorkspace).not.toHaveBeenCalled()
  })
})

describe('processAiUsageWeeklyEmail — misc', () => {
  it('builds the job id from workspace and week', () => {
    expect(aiUsageWeeklyEmailJobId('ws9', '2026-10-05')).toBe(
      'ai-usage-weekly-email-ws9-2026-10-05',
    )
  })

  it('rejects unknown job names', async () => {
    await expect(processAiUsageWeeklyEmail(fakeJob('nope'))).rejects.toThrow(
      'Unknown ai-usage-weekly-email job: nope (id=job-1)',
    )
    await expect(
      processAiUsageWeeklyEmail(fakeJob('nope', {}, null)),
    ).rejects.toThrow('(id=unknown)')
  })
})
