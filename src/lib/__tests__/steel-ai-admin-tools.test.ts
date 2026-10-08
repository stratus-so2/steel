import { describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { forbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { AiUsageBreakdownItemDTO } from '@/types/ai-usage'
import type { InvitationDTO } from '@/types/invitation'

vi.mock('@/src/services/ai-usage-analytics.service')
vi.mock('@/src/services/invitation.service')

import { AiUsageAnalyticsService } from '@/src/services/ai-usage-analytics.service'
import { InvitationService } from '@/src/services/invitation.service'
import { wsAiUsageTool, wsInvitationsTool } from '../ai/tools/platform'

const ctx = { workspaceId: 'ws1', actorId: 'u1', source: 'agent' as const }
const usage = vi.mocked(AiUsageAnalyticsService)
const invitations = vi.mocked(InvitationService)

const item = (label: string, costUsd: number, share: number) =>
  ({
    key: label,
    label,
    detail: null,
    costUsd,
    share,
    inputTokens: 1,
    outputTokens: 1,
    calls: 1,
  }) as AiUsageBreakdownItemDTO

const period = (workspaceUsd: number, projected: number) => ({
  start: '2026-10-01T00:00:00.000Z',
  elapsedDays: 8,
  days: 31,
  workspaceUsd,
  projectedWorkspaceUsd: projected,
  workspaceChangePercent: 12.5,
})

function overview(quota: number) {
  return {
    monthlyQuotaUsd: quota,
    weeklyShareUsd: 11.2903,
    month: period(40.126, 155.49),
    week: period(9.5, 14),
  } as never
}

function analytics(byUser: AiUsageBreakdownItemDTO[] | null) {
  return {
    period: 'this_month',
    from: '2026-10-01T00:00:00.000Z',
    to: '2026-11-01T00:00:00.000Z',
    totals: { costUsd: 40.126, calls: 321, inputTokens: 0, outputTokens: 0 },
    byModel: [1, 2, 3, 4, 5, 6].map((n) => item(`modelo ${n}`, n, 0.1)),
    byFeature: [item('Steel AI', 30, 0.75)],
    byModule: [item('CRM', 10.555, 0.263)],
    byUser,
  } as never
}

describe('ws_ai_usage', () => {
  it('should default to this month and refuse unknown args', () => {
    expect(expectOk(wsAiUsageTool.parse({}))).toEqual({ period: 'this_month' })
    expect(expectOk(wsAiUsageTool.parse({ period: 'last_7_days' }))).toEqual({
      period: 'last_7_days',
    })
    expectErr(wsAiUsageTool.parse({ period: 'custom' }), 'VALIDATION_ERROR')
    expectErr(wsAiUsageTool.parse({ scope: 'personal' }), 'VALIDATION_ERROR')
    expect(wsAiUsageTool.permission).toEqual({
      resource: 'settings',
      action: 'VIEW',
    })
  })

  it('should summarize the workspace spend against the quota', async () => {
    usage.overview.mockResolvedValue(ok(overview(150)))
    usage.analytics.mockResolvedValue(ok(analytics([item('Ana', 20, 0.5)])))

    const result = expectOk(
      await wsAiUsageTool.execute(ctx, { period: 'last_30_days' }),
    )

    expect(usage.overview).toHaveBeenCalledWith('u1', 'ws1')
    expect(usage.analytics).toHaveBeenCalledWith('u1', 'ws1', {
      scope: 'workspace',
      period: 'last_30_days',
    })
    const data = result.data as {
      monthlyQuotaUsd: number
      weeklyShareUsd: number
      month: { spentUsd: number; projectedQuotaPercent: number | null }
      week: { spentUsd: number }
      period: {
        costUsd: number
        byModel: unknown[]
        byModule: { costUsd: number; share: number }[]
        byUser: { label: string }[]
      }
    }
    expect(data.monthlyQuotaUsd).toBe(150)
    expect(data.weeklyShareUsd).toBe(11.29)
    expect(data.month.spentUsd).toBe(40.13)
    expect(data.month.projectedQuotaPercent).toBe(104)
    expect(data.week.spentUsd).toBe(9.5)
    expect(data.period.costUsd).toBe(40.13)
    expect(data.period.byModel).toHaveLength(5)
    expect(data.period.byModule).toEqual([
      { label: 'CRM', detail: null, costUsd: 10.56, share: 26 },
    ])
    expect(data.period.byUser).toEqual([
      { label: 'Ana', detail: null, costUsd: 20, share: 50 },
    ])
    expect(result.summary).toBe(
      'IA: US$ 40.13 no mês, projeção US$ 155.49 de US$ 150',
    )
  })

  it('should cope with no quota and no per-user breakdown', async () => {
    usage.overview.mockResolvedValue(ok(overview(0)))
    usage.analytics.mockResolvedValue(ok(analytics(null)))
    const result = expectOk(
      await wsAiUsageTool.execute(ctx, { period: 'this_month' }),
    )
    const data = result.data as {
      month: { projectedQuotaPercent: number | null }
      period: { byUser: unknown[] }
    }
    expect(data.month.projectedQuotaPercent).toBeNull()
    expect(data.period.byUser).toEqual([])
  })

  it('should propagate service errors', async () => {
    usage.overview.mockResolvedValue(err(forbidden()))
    expectErr(
      await wsAiUsageTool.execute(ctx, { period: 'this_month' }),
      'FORBIDDEN',
    )

    usage.overview.mockResolvedValue(ok(overview(150)))
    usage.analytics.mockResolvedValue(err(forbidden()))
    expectErr(
      await wsAiUsageTool.execute(ctx, { period: 'this_month' }),
      'FORBIDDEN',
    )
  })
})

const invitation = (
  id: string,
  status: string,
  expiresAt: string,
): InvitationDTO => ({
  id,
  email: `${id}@acme.com`,
  role: 'MEMBER',
  status,
  expiresAt,
  workspaceId: 'ws1',
  projectId: null,
  invitedById: 'u1',
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
})

describe('ws_invitations', () => {
  it('should parse the limit', () => {
    expect(expectOk(wsInvitationsTool.parse({}))).toEqual({ limit: 20 })
    expectErr(wsInvitationsTool.parse({ limit: 99 }), 'VALIDATION_ERROR')
    expect(wsInvitationsTool.permission).toEqual({
      resource: 'members',
      action: 'VIEW',
    })
  })

  it('should list only pending invitations and flag the expired ones', async () => {
    invitations.list.mockResolvedValue(
      ok([
        invitation('a', 'PENDING', '2999-01-01T00:00:00.000Z'),
        invitation('b', 'ACCEPTED', '2999-01-01T00:00:00.000Z'),
        invitation('c', 'PENDING', '2020-01-01T00:00:00.000Z'),
        invitation('d', 'PENDING', '2999-01-01T00:00:00.000Z'),
      ]),
    )

    const result = expectOk(await wsInvitationsTool.execute(ctx, { limit: 2 }))

    expect(invitations.list).toHaveBeenCalledWith('u1', 'ws1')
    expect(result.data).toEqual({
      total: 3,
      items: [
        {
          email: 'a@acme.com',
          role: 'MEMBER',
          invitedAt: '2026-10-01T12:00:00.000Z',
          expiresAt: '2999-01-01T00:00:00.000Z',
          expired: false,
        },
        {
          email: 'c@acme.com',
          role: 'MEMBER',
          invitedAt: '2026-10-01T12:00:00.000Z',
          expiresAt: '2020-01-01T00:00:00.000Z',
          expired: true,
        },
      ],
    })
    expect(result.summary).toBe('3 convite(s) pendente(s)')
  })

  it('should propagate the service error (non-admin)', async () => {
    invitations.list.mockResolvedValue(err(forbidden()))
    expectErr(await wsInvitationsTool.execute(ctx, { limit: 20 }), 'FORBIDDEN')
  })
})
