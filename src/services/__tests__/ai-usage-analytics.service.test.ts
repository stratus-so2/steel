import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeWorkspaceAiSettings } from '@/src/__tests__/factories/ai-settings.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/ai-settings.repository')
vi.mock('@/src/repositories/ai-usage-analytics.repository')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))

import { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { WorkspaceAiSettingsRepository } from '@/src/repositories/ai-settings.repository'
import {
  AiUsageAnalyticsRepository,
  type AiUsageExportRow,
} from '@/src/repositories/ai-usage-analytics.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  AI_USAGE_EXPORT_PAGE_SIZE,
  AiUsageAnalyticsService,
} from '../ai-usage-analytics.service'

const membershipRepo = vi.mocked(MembershipRepository)
const settingsRepo = vi.mocked(WorkspaceAiSettingsRepository)
const usageRepo = vi.mocked(AiUsageAnalyticsRepository)
const audit = vi.mocked(auditMutation)

const ACTOR = 'user_1'
const WS = 'ws_1'
const NOW = new Date('2026-10-07T12:00:00.000Z')

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  membershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role, userId: ACTOR, workspaceId: WS })),
  )
}

function row(id: string): AiUsageExportRow {
  return {
    id,
    createdAt: new Date('2026-10-02T10:00:00.000Z'),
    userId: ACTOR,
    userName: 'Ana',
    userEmail: 'ana@x.com',
    feature: 'STEEL_ASSISTANT',
    provider: 'openai',
    model: 'gpt-4o-mini',
    module: 'CRM',
    inputTokens: 10,
    outputTokens: 5,
    costUsd: 0.01,
  }
}

async function collect(chunks: AsyncGenerator<string>): Promise<string> {
  let out = ''
  for await (const chunk of chunks) out += chunk
  return out
}

beforeEach(() => {
  vi.clearAllMocks()
  asRole('MEMBER')
  settingsRepo.findByWorkspace.mockResolvedValue(ok(null))
  usageRepo.dailyCosts.mockResolvedValue(
    ok([{ day: '2026-10-02', mineUsd: 1, workspaceUsd: 3 }]),
  )
  usageRepo.groupByDimensions.mockResolvedValue(
    ok([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        feature: 'STEEL_ASSISTANT',
        module: null,
        costUsd: 1,
        inputTokens: 100,
        outputTokens: 10,
        calls: 2,
      },
    ]),
  )
  usageRepo.groupByUser.mockResolvedValue(
    ok([
      { userId: ACTOR, costUsd: 1, inputTokens: 1, outputTokens: 1, calls: 1 },
      { userId: null, costUsd: 2, inputTokens: 1, outputTokens: 1, calls: 1 },
    ]),
  )
  usageRepo.findUsers.mockResolvedValue(
    ok([{ id: ACTOR, name: 'Ana', email: 'ana@x.com' }]),
  )
  usageRepo.exportPage.mockResolvedValue(ok([]))
})

describe('AiUsageAnalyticsService.overview()', () => {
  it('returns FORBIDDEN to a non-member', async () => {
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await AiUsageAnalyticsService.overview(ACTOR, WS, NOW),
      'FORBIDDEN',
    )
    expect(usageRepo.dailyCosts).not.toHaveBeenCalled()
  })

  it('reads the actor share since the previous month with the workspace quota', async () => {
    settingsRepo.findByWorkspace.mockResolvedValue(
      ok(
        createFakeWorkspaceAiSettings({
          workspaceId: WS,
          monthlyQuotaUsd: new Prisma.Decimal(124),
        }),
      ),
    )
    const dto = expectOk(await AiUsageAnalyticsService.overview(ACTOR, WS, NOW))

    expect(usageRepo.dailyCosts).toHaveBeenCalledWith(
      WS,
      {
        from: new Date('2026-09-01T00:00:00.000Z'),
        to: new Date('2026-10-08T00:00:00.000Z'),
      },
      ACTOR,
    )
    expect(dto.monthlyQuotaUsd).toBe(124)
    expect(dto.weeklyShareUsd).toBe(28)
    expect(dto.month.mineUsd).toBe(1)
    expect(dto.canViewWorkspace).toBe(false)
  })

  it('uses the platform default quota and flags admins', async () => {
    asRole('ADMIN')
    const dto = expectOk(await AiUsageAnalyticsService.overview(ACTOR, WS))
    expect(dto.monthlyQuotaUsd).toBe(50)
    expect(dto.canViewWorkspace).toBe(true)
  })

  it('propagates repository errors', async () => {
    settingsRepo.findByWorkspace.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await AiUsageAnalyticsService.overview(ACTOR, WS, NOW),
      'DATABASE_ERROR',
    )
    usageRepo.dailyCosts.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await AiUsageAnalyticsService.overview(ACTOR, WS, NOW),
      'DATABASE_ERROR',
    )
  })
})

describe('AiUsageAnalyticsService.analytics()', () => {
  it('scopes the personal view to the actor and skips the user breakdown', async () => {
    const dto = expectOk(
      await AiUsageAnalyticsService.analytics(
        ACTOR,
        WS,
        { scope: 'personal', period: 'last_7_days' },
        NOW,
      ),
    )
    const range = {
      from: new Date('2026-10-01T00:00:00.000Z'),
      to: new Date('2026-10-08T00:00:00.000Z'),
    }
    expect(usageRepo.groupByDimensions).toHaveBeenCalledWith(WS, range, ACTOR)
    expect(usageRepo.dailyCosts).toHaveBeenCalledWith(WS, range, ACTOR)
    expect(usageRepo.groupByUser).not.toHaveBeenCalled()
    expect(usageRepo.findUsers).toHaveBeenCalledWith([])
    expect(dto.byUser).toBeNull()
    expect(dto.byModel[0].label).toBe('GPT-4o mini')
    expect(dto.canViewWorkspace).toBe(false)
  })

  it.each(['MEMBER', 'VIEWER'] as const)(
    'forbids the workspace view to a %s',
    async (role) => {
      asRole(role)
      expectErr(
        await AiUsageAnalyticsService.analytics(ACTOR, WS, {
          scope: 'workspace',
          period: 'this_month',
        }),
        'FORBIDDEN',
      )
      expect(usageRepo.groupByDimensions).not.toHaveBeenCalled()
    },
  )

  it('returns FORBIDDEN to a non-member even for the personal view', async () => {
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await AiUsageAnalyticsService.analytics(ACTOR, WS, {
        scope: 'personal',
        period: 'this_month',
      }),
      'FORBIDDEN',
    )
  })

  it('gives an admin the whole workspace with names per user', async () => {
    asRole('OWNER')
    const dto = expectOk(
      await AiUsageAnalyticsService.analytics(
        ACTOR,
        WS,
        { scope: 'workspace', period: 'this_month' },
        NOW,
      ),
    )
    expect(usageRepo.groupByDimensions).toHaveBeenCalledWith(
      WS,
      expect.any(Object),
      undefined,
    )
    expect(usageRepo.findUsers).toHaveBeenCalledWith([ACTOR])
    expect(dto.byUser?.map((u) => u.label)).toEqual([
      'Automações (sem usuário)',
      'Ana',
    ])
    expect(dto.canViewWorkspace).toBe(true)
  })

  it.each([
    'groupByDimensions',
    'groupByUser',
    'dailyCosts',
    'findUsers',
  ] as const)('propagates a %s failure', async (method) => {
    asRole('ADMIN')
    usageRepo[method].mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await AiUsageAnalyticsService.analytics(ACTOR, WS, {
        scope: 'workspace',
        period: 'this_month',
      }),
      'DATABASE_ERROR',
    )
  })
})

describe('AiUsageAnalyticsService.exportCsv()', () => {
  it('rejects the per-user view outside the workspace scope', async () => {
    expectErr(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'personal',
        period: 'this_month',
        view: 'user',
      }),
      'VALIDATION_ERROR',
    )
    expect(membershipRepo.findByUserAndWorkspace).not.toHaveBeenCalled()
  })

  it('forbids the workspace export to a member', async () => {
    expectErr(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'workspace',
        period: 'this_month',
        view: 'rows',
      }),
      'FORBIDDEN',
    )
    expect(audit).not.toHaveBeenCalled()
  })

  it('streams the actor rows page by page with a BOM and a header, and audits', async () => {
    const full = Array.from({ length: AI_USAGE_EXPORT_PAGE_SIZE }, (_, i) =>
      row(`r${i}`),
    )
    usageRepo.exportPage
      .mockResolvedValueOnce(ok(full))
      .mockResolvedValueOnce(ok([row('last')]))

    const result = expectOk(
      await AiUsageAnalyticsService.exportCsv(
        ACTOR,
        WS,
        {
          scope: 'personal',
          period: 'custom',
          from: '2026-09-01',
          to: '2026-09-30',
          view: 'rows',
        },
        NOW,
      ),
    )
    expect(result.filename).toBe(
      'steel-ai-uso-pessoal-rows-2026-09-01_2026-09-30.csv',
    )
    const csv = await collect(result.chunks)

    expect(csv.startsWith('﻿data_utc,usuario,email,')).toBe(true)
    expect(csv.split('\r\n')).toHaveLength(AI_USAGE_EXPORT_PAGE_SIZE + 3)
    expect(usageRepo.exportPage).toHaveBeenNthCalledWith(
      2,
      WS,
      expect.any(Object),
      {
        userId: ACTOR,
        cursor: `r${AI_USAGE_EXPORT_PAGE_SIZE - 1}`,
        take: AI_USAGE_EXPORT_PAGE_SIZE,
      },
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'ai_usage',
        action: 'download',
        targetId: WS,
        meta: expect.objectContaining({ scope: 'personal', view: 'rows' }),
      }),
    )
  })

  it('stops after an exactly full last page and an empty one', async () => {
    asRole('ADMIN')
    const result = expectOk(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'workspace',
        period: 'this_month',
        view: 'rows',
      }),
    )
    const csv = await collect(result.chunks)
    expect(csv.split('\r\n')).toHaveLength(2)
    expect(usageRepo.exportPage).toHaveBeenCalledWith(
      WS,
      expect.any(Object),
      expect.objectContaining({ userId: undefined }),
    )
  })

  it('aborts the stream when a page fails', async () => {
    usageRepo.exportPage.mockResolvedValueOnce(err(databaseError('boom')))
    const result = expectOk(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'personal',
        period: 'this_month',
        view: 'rows',
      }),
    )
    await expect(collect(result.chunks)).rejects.toThrow('boom')
  })

  it.each([
    ['model', 'openai:gpt-4o-mini,GPT-4o mini,openai,2,100,10,1,100'],
    ['feature', 'STEEL_ASSISTANT,Steel AI (assistente),,2,100,10,1,100'],
    ['module', 'PLATFORM,Plataforma,,2,100,10,1,100'],
  ] as const)('exports the %s aggregate', async (view, line) => {
    const result = expectOk(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'personal',
        period: 'this_month',
        view,
      }),
    )
    const csv = await collect(result.chunks)
    expect(csv).toContain('﻿chave,nome,detalhe,chamadas')
    expect(csv).toContain(`${line}\r\n`)
  })

  it('exports the per-user aggregate to an admin', async () => {
    asRole('ADMIN')
    const result = expectOk(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'workspace',
        period: 'last_month',
        view: 'user',
      }),
    )
    expect(result.filename).toMatch(/^steel-ai-uso-workspace-user-/)
    const csv = await collect(result.chunks)
    expect(csv).toContain(`${ACTOR},Ana,ana@x.com,1,`)
    expect(csv).toContain('none,Automações (sem usuário),,1,')
  })

  it('writes only the header for an empty aggregate', async () => {
    usageRepo.groupByDimensions.mockResolvedValueOnce(ok([]))
    const result = expectOk(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'personal',
        period: 'this_month',
        view: 'model',
      }),
    )
    expect((await collect(result.chunks)).split('\r\n')).toHaveLength(2)
  })

  it('propagates an aggregate failure before streaming', async () => {
    usageRepo.groupByDimensions.mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await AiUsageAnalyticsService.exportCsv(ACTOR, WS, {
        scope: 'personal',
        period: 'this_month',
        view: 'module',
      }),
      'DATABASE_ERROR',
    )
    expect(audit).not.toHaveBeenCalled()
  })
})
