import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeWorkspaceAiSettings } from '@/src/__tests__/factories/ai-settings.factory'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { AiUsageWeeklyWorkspace } from '@/src/repositories/ai-usage-weekly-email.repository'

vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))
vi.mock('@/lib/base-email-url', () => ({ baseEmailUrl: 'https://steel.test' }))
vi.mock('@/src/lib/mail/steel-ai/send-ai-usage-weekly', () => ({
  sendAiUsageWeeklyEmail: vi.fn(),
}))
vi.mock('@/src/cache/ai-usage-weekly-email.cache', () => ({
  AiUsageWeeklyEmailCache: { claim: vi.fn(), release: vi.fn() },
}))
vi.mock('@/src/repositories/ai-usage-weekly-email.repository')
vi.mock('@/src/repositories/ai-usage-analytics.repository')

import { logger } from '@/lib/axiom/logger'
import { AiUsageWeeklyEmailCache } from '@/src/cache/ai-usage-weekly-email.cache'
import { sendAiUsageWeeklyEmail } from '@/src/lib/mail/steel-ai/send-ai-usage-weekly'
import { AiUsageAnalyticsRepository } from '@/src/repositories/ai-usage-analytics.repository'
import { AiUsageWeeklyEmailRepository } from '@/src/repositories/ai-usage-weekly-email.repository'
import { AiUsageWeeklyEmailService } from '../ai-usage-weekly-email.service'

const repo = vi.mocked(AiUsageWeeklyEmailRepository)
const analytics = vi.mocked(AiUsageAnalyticsRepository)
const cache = vi.mocked(AiUsageWeeklyEmailCache)
const send = vi.mocked(sendAiUsageWeeklyEmail)

/** Monday 08:00 in São Paulo (11:00 UTC). */
const NOW = new Date('2026-10-05T11:00:00.000Z')
const WEEK_START = new Date('2026-09-28T00:00:00.000Z')
const DB_ERROR = err(databaseError())

function workspace(
  overrides: Partial<AiUsageWeeklyWorkspace> = {},
): AiUsageWeeklyWorkspace {
  return {
    id: 'ws1',
    name: 'Stratus',
    slug: 'stratus',
    status: 'ACTIVE',
    aiSettings: null,
    ...overrides,
  }
}

const OWNERS = [
  { id: 'o1', name: 'Ana', email: 'ana@example.com' },
  { id: 'o2', name: '', email: 'bia@example.com' },
]

beforeEach(() => {
  vi.clearAllMocks()
  repo.listWorkspaceIdsWithUsage.mockResolvedValue(ok(['ws1']))
  repo.findWorkspaces.mockResolvedValue(ok([workspace()]))
  repo.listOwners.mockResolvedValue(ok(OWNERS))
  repo.agentActivity.mockResolvedValue(
    ok({ runs: 2, actions: 1, pendingApprovals: 0 }),
  )
  analytics.dailyCosts.mockResolvedValue(
    ok([
      { day: '2026-09-22', mineUsd: 0, workspaceUsd: 4 },
      { day: '2026-09-30', mineUsd: 0, workspaceUsd: 6 },
    ]),
  )
  analytics.groupByDimensions.mockResolvedValue(
    ok([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        feature: 'STEEL_ASSISTANT',
        module: null,
        costUsd: 6,
        inputTokens: 10,
        outputTokens: 5,
        calls: 3,
      },
    ]),
  )
  analytics.groupByUser.mockResolvedValue(
    ok([
      { userId: 'o1', costUsd: 5, inputTokens: 1, outputTokens: 1, calls: 1 },
      { userId: null, costUsd: 1, inputTokens: 1, outputTokens: 1, calls: 1 },
    ]),
  )
  analytics.findUsers.mockResolvedValue(
    ok([{ id: 'o1', name: 'Ana', email: 'ana@example.com' }]),
  )
  cache.claim.mockResolvedValue('claimed')
  cache.release.mockResolvedValue(undefined)
  send.mockResolvedValue({ id: 'mail' } as never)
})

describe('AiUsageWeeklyEmailService.planWeek()', () => {
  it('plans the previous UTC week and keeps only eligible workspaces', async () => {
    repo.listWorkspaceIdsWithUsage.mockResolvedValue(
      ok(['ws1', 'ws2', 'ws3', 'ws4', 'ws5']),
    )
    repo.findWorkspaces.mockResolvedValue(
      ok([
        workspace(),
        workspace({ id: 'ws2', status: 'SUSPENDED' }),
        workspace({
          id: 'ws3',
          aiSettings: createFakeWorkspaceAiSettings({ aiEnabled: false }),
        }),
        workspace({
          id: 'ws4',
          aiSettings: createFakeWorkspaceAiSettings({
            usageWeeklyEmailEnabled: false,
          }),
        }),
        workspace({
          id: 'ws5',
          aiSettings: createFakeWorkspaceAiSettings(),
        }),
      ]),
    )

    const plan = await AiUsageWeeklyEmailService.planWeek(NOW)

    expect(plan).toEqual(
      ok({
        weekStart: WEEK_START,
        weekKey: '2026-09-28',
        candidates: 5,
        eligible: ['ws1', 'ws5'],
        skipped: { workspace_inactive: 1, ai_disabled: 1, email_disabled: 1 },
      }),
    )
    // Usage in the reported week or the one before.
    expect(repo.listWorkspaceIdsWithUsage).toHaveBeenCalledWith({
      from: new Date('2026-09-21T00:00:00.000Z'),
      to: new Date('2026-10-05T00:00:00.000Z'),
    })
  })

  it('counts repeated skip reasons', async () => {
    repo.findWorkspaces.mockResolvedValue(
      ok([
        workspace({ status: 'DELETING' }),
        workspace({ id: 'ws2', status: 'SUSPENDED' }),
      ]),
    )
    const plan = await AiUsageWeeklyEmailService.planWeek(NOW)
    expect(plan.ok && plan.value.skipped).toEqual({ workspace_inactive: 2 })
  })

  it('defaults to the current time', async () => {
    const plan = await AiUsageWeeklyEmailService.planWeek()
    expect(plan.ok).toBe(true)
  })

  it('propagates database failures', async () => {
    repo.listWorkspaceIdsWithUsage.mockResolvedValueOnce(DB_ERROR)
    expect(await AiUsageWeeklyEmailService.planWeek(NOW)).toEqual(DB_ERROR)

    repo.findWorkspaces.mockResolvedValueOnce(DB_ERROR)
    expect(await AiUsageWeeklyEmailService.planWeek(NOW)).toEqual(DB_ERROR)
  })
})

describe('AiUsageWeeklyEmailService.sendForWorkspace()', () => {
  it('mails every owner once with the week numbers and absolute links', async () => {
    const result = await AiUsageWeeklyEmailService.sendForWorkspace(
      'ws1',
      WEEK_START,
      NOW,
    )

    expect(result).toEqual(
      ok({
        workspaceId: 'ws1',
        weekKey: '2026-09-28',
        status: 'sent',
        reason: null,
        sent: 2,
        alreadySent: 0,
        failed: 0,
      }),
    )
    expect(send).toHaveBeenCalledTimes(2)
    const props = send.mock.calls[0][0]
    expect(props).toMatchObject({
      email: 'ana@example.com',
      username: 'Ana',
      workspaceName: 'Stratus',
      usageUrl: 'https://steel.test/stratus/ai/usage',
      analyticsUrl: 'https://steel.test/stratus/ai/analytics',
      settingsUrl: 'https://steel.test/stratus/settings/steel-intelligence',
    })
    expect(props.report).toMatchObject({
      weekUsd: 6,
      previousWeekUsd: 4,
      changePercent: 50,
      agents: { runs: 2, actions: 1, pendingApprovals: 0 },
    })
    expect(props.report.topMembers.map((m) => m.key)).toEqual(['o1'])
    expect(send.mock.calls[1][0].username).toBeUndefined()
    expect(cache.claim).toHaveBeenCalledWith('ws1', '2026-09-28', 'o1')
    expect(analytics.findUsers).toHaveBeenCalledWith(['o1'])
    expect(analytics.groupByDimensions).toHaveBeenCalledWith('ws1', {
      from: WEEK_START,
      to: new Date('2026-10-05T00:00:00.000Z'),
    })
    expect(repo.agentActivity).toHaveBeenCalledWith(
      'ws1',
      expect.anything(),
      NOW,
    )
  })

  it('never mails an owner twice for the same week (marker taken)', async () => {
    cache.claim.mockResolvedValueOnce('already_sent')

    const result = await AiUsageWeeklyEmailService.sendForWorkspace(
      'ws1',
      WEEK_START,
      NOW,
    )

    expect(result.ok && result.value).toMatchObject({
      sent: 1,
      alreadySent: 1,
      failed: 0,
    })
    expect(send).toHaveBeenCalledTimes(1)
    expect(send.mock.calls[0][0].email).toBe('bia@example.com')
  })

  it('does not send when the marker store is down', async () => {
    cache.claim.mockResolvedValue('unavailable')

    const result = await AiUsageWeeklyEmailService.sendForWorkspace(
      'ws1',
      WEEK_START,
      NOW,
    )

    expect(result.ok && result.value).toMatchObject({ sent: 0, failed: 2 })
    expect(send).not.toHaveBeenCalled()
  })

  it('releases the marker and counts the failure when a send throws', async () => {
    send.mockRejectedValueOnce(new Error('resend down'))
    send.mockRejectedValueOnce('plain failure')

    const result = await AiUsageWeeklyEmailService.sendForWorkspace(
      'ws1',
      WEEK_START,
      NOW,
    )

    expect(result.ok && result.value).toMatchObject({ sent: 0, failed: 2 })
    expect(cache.release).toHaveBeenCalledWith('ws1', '2026-09-28', 'o1')
    expect(cache.release).toHaveBeenCalledWith('ws1', '2026-09-28', 'o2')
    expect(logger.error).toHaveBeenCalledWith(
      'ai.usage_weekly_email.send_failed',
      expect.objectContaining({ message: 'resend down' }),
    )
    expect(logger.error).toHaveBeenCalledWith(
      'ai.usage_weekly_email.send_failed',
      expect.objectContaining({ message: 'plain failure' }),
    )
  })

  it.each([
    [
      'workspace_not_found',
      () => repo.findWorkspaces.mockResolvedValue(ok([])),
    ],
    [
      'workspace_inactive',
      () =>
        repo.findWorkspaces.mockResolvedValue(
          ok([workspace({ status: 'SUSPENDED' })]),
        ),
    ],
    [
      'ai_disabled',
      () =>
        repo.findWorkspaces.mockResolvedValue(
          ok([
            workspace({
              aiSettings: createFakeWorkspaceAiSettings({ aiEnabled: false }),
            }),
          ]),
        ),
    ],
    [
      'email_disabled',
      () =>
        repo.findWorkspaces.mockResolvedValue(
          ok([
            workspace({
              aiSettings: createFakeWorkspaceAiSettings({
                usageWeeklyEmailEnabled: false,
              }),
            }),
          ]),
        ),
    ],
    ['no_usage', () => analytics.dailyCosts.mockResolvedValue(ok([]))],
    ['no_owners', () => repo.listOwners.mockResolvedValue(ok([]))],
  ])('skips with reason %s', async (reason, arrange) => {
    arrange()

    const result = await AiUsageWeeklyEmailService.sendForWorkspace(
      'ws1',
      WEEK_START,
      NOW,
    )

    expect(result).toEqual(
      ok({
        workspaceId: 'ws1',
        weekKey: '2026-09-28',
        status: 'skipped',
        reason,
        sent: 0,
        alreadySent: 0,
        failed: 0,
      }),
    )
    expect(send).not.toHaveBeenCalled()
  })

  it('uses the quota of the saved settings', async () => {
    repo.findWorkspaces.mockResolvedValue(
      ok([
        workspace({
          aiSettings: createFakeWorkspaceAiSettings({
            monthlyQuotaUsd: { toNumber: () => 5 } as never,
          }),
        }),
      ]),
    )
    await AiUsageWeeklyEmailService.sendForWorkspace('ws1', WEEK_START, NOW)
    expect(send.mock.calls[0][0].report.month.quotaUsd).toBe(5)
  })

  it('defaults to the current time', async () => {
    const result = await AiUsageWeeklyEmailService.sendForWorkspace(
      'ws1',
      WEEK_START,
    )
    expect(result.ok).toBe(true)
  })

  it.each([
    ['findWorkspaces', () => repo.findWorkspaces.mockResolvedValue(DB_ERROR)],
    ['dailyCosts', () => analytics.dailyCosts.mockResolvedValue(DB_ERROR)],
    [
      'groupByDimensions',
      () => analytics.groupByDimensions.mockResolvedValue(DB_ERROR),
    ],
    ['groupByUser', () => analytics.groupByUser.mockResolvedValue(DB_ERROR)],
    ['agentActivity', () => repo.agentActivity.mockResolvedValue(DB_ERROR)],
    ['findUsers', () => analytics.findUsers.mockResolvedValue(DB_ERROR)],
    ['listOwners', () => repo.listOwners.mockResolvedValue(DB_ERROR)],
  ])('propagates a %s failure without sending', async (_name, arrange) => {
    arrange()
    expect(
      await AiUsageWeeklyEmailService.sendForWorkspace('ws1', WEEK_START, NOW),
    ).toEqual(DB_ERROR)
    expect(send).not.toHaveBeenCalled()
  })
})
