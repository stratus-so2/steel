import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-opportunity.repository')
vi.mock('@/src/repositories/crm-quota.repository')

import { CrmOpportunityRepository } from '@/src/repositories/crm-opportunity.repository'
import { CrmQuotaRepository } from '@/src/repositories/crm-quota.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmForecastService } from '../crm-forecast.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedOppRepo = vi.mocked(CrmOpportunityRepository)
const mockedQuotaRepo = vi.mocked(CrmQuotaRepository)

function member(id: string, name: string) {
  return {
    id: `m-${id}`,
    userId: id,
    workspaceId: 'ws1',
    role: 'MEMBER' as const,
    profileId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    user: { id, name, email: `${id}@x.com`, image: null },
  }
}

function makeOpp(overrides: Record<string, unknown>) {
  return {
    id: 'o',
    ownerId: 'u_1',
    amount: new Prisma.Decimal('1000'),
    closeDate: new Date('2026-06-15T00:00:00.000Z'),
    workspaceId: 'ws1',
    deletedAt: null,
    stage: { category: 'OPEN', probability: 50 },
    ...overrides,
  } as never
}

beforeEach(() => {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
    ok([member('u_1', 'Ana'), member('u_2', 'Beto')] as never),
  )
  mockedQuotaRepo.listByWorkspace.mockResolvedValue(ok([]))
})

describe('CrmForecastService.getForecast', () => {
  it('should return FORBIDDEN for a non-member', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
      'FORBIDDEN',
    )
  })

  it('weights open opportunities and sums won ones in the same owner/period', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      ok([
        makeOpp({ stage: { category: 'OPEN', probability: 50 } }),
        makeOpp({
          amount: new Prisma.Decimal('2000'),
          stage: { category: 'WON', probability: 100 },
        }),
      ]),
    )

    const result = expectOk(
      await CrmForecastService.getForecast('u_1', 'ws1', 'MONTH'),
    )
    expect(result.rows).toHaveLength(1)
    const row = result.rows[0]
    expect(row.periodKey).toBe('2026-06')
    expect(row.weightedOpenAmount).toBe(500)
    expect(row.wonAmount).toBe(2000)
    expect(row.forecastAmount).toBe(2500)
    expect(row.openCount).toBe(1)
    expect(row.wonCount).toBe(1)
  })

  it('computes attainment against the quota', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      ok([
        makeOpp({
          amount: new Prisma.Decimal('5000'),
          stage: { category: 'WON', probability: 100 },
        }),
      ]),
    )
    mockedQuotaRepo.listByWorkspace.mockResolvedValue(
      ok([
        {
          ownerId: 'u_1',
          periodKey: '2026-06',
          targetAmount: new Prisma.Decimal('10000'),
        },
      ] as never),
    )

    const result = expectOk(
      await CrmForecastService.getForecast('u_1', 'ws1', 'MONTH'),
    )
    const row = result.rows[0]
    expect(row.quotaAmount).toBe(10000)
    expect(row.attainmentPct).toBe(50)
  })

  it('groups by quarter when period=QUARTER', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      ok([
        makeOpp({ closeDate: new Date('2026-04-10T00:00:00.000Z') }),
        makeOpp({ closeDate: new Date('2026-05-20T00:00:00.000Z') }),
      ]),
    )
    const result = expectOk(
      await CrmForecastService.getForecast('u_1', 'ws1', 'QUARTER'),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0].periodKey).toBe('2026-Q2')
  })

  it('creates a row from a quota alone, even without opportunities', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(ok([]))
    mockedQuotaRepo.listByWorkspace.mockResolvedValue(
      ok([
        {
          ownerId: 'u_2',
          periodKey: '2026-07',
          targetAmount: new Prisma.Decimal('3000'),
        },
      ] as never),
    )
    const result = expectOk(
      await CrmForecastService.getForecast('u_1', 'ws1', 'MONTH'),
    )
    const row = result.rows[0]
    expect(row.ownerName).toBe('Beto')
    expect(row.forecastAmount).toBe(0)
    expect(row.quotaAmount).toBe(3000)
    expect(row.attainmentPct).toBe(0)
  })
})

describe('CrmForecastService.getForecast — gates and edge cases', () => {
  it('should return MODULE_DISABLED when the CRM is off', async () => {
    vi.mocked(WorkspaceModuleAccessRepository.isEnabled).mockResolvedValueOnce(
      ok(false),
    )
    expectErr(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
      'MODULE_DISABLED',
    )
  })

  it('should allow a VIEWER (read-only on opportunities)', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'VIEWER' })),
    )
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(ok([]))
    const result = expectOk(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
    )
    expect(result).toEqual({ period: 'MONTH', rows: [] })
  })

  it('should deny a custom profile without VIEW on opportunities', async () => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(
        createFakeMembership({
          role: 'MEMBER',
          profile: {
            id: 'p1',
            workspaceId: 'ws1',
            name: 'Suporte',
            isSystem: false,
            systemKey: null,
            permissions: { opportunities: [] },
            createdAt: new Date(),
            updatedAt: new Date(),
          } as never,
        }),
      ),
    )
    expectErr(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
      'FORBIDDEN',
    )
  })

  it('should propagate a members repository error', async () => {
    mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
      err(databaseError()),
    )
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(ok([]))
    expectErr(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
      'DATABASE_ERROR',
    )
  })

  it('should propagate an opportunities repository error', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      err(databaseError()),
    )
    expectErr(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
      'DATABASE_ERROR',
    )
  })

  it('should propagate a quotas repository error', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(ok([]))
    mockedQuotaRepo.listByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
      'DATABASE_ERROR',
    )
    expect(mockedQuotaRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
      period: 'MONTH',
    })
  })

  it('should skip opportunities without a close date and treat a missing amount as zero', async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      ok([
        makeOpp({ closeDate: null }),
        makeOpp({ amount: null, stage: { category: 'WON', probability: 100 } }),
      ]),
    )
    const result = expectOk(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
    )
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]).toMatchObject({
      wonAmount: 0,
      wonCount: 1,
      openCount: 0,
      forecastAmount: 0,
      attainmentPct: null,
    })
  })

  it("should prefer the opportunity's own probability over the stage default", async () => {
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      ok([
        makeOpp({
          amount: new Prisma.Decimal('333'),
          probability: 10,
          stage: { category: 'OPEN', probability: 90 },
        }),
      ]),
    )
    const result = expectOk(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
    )
    // 333 × 10% = 33.3 → arredondado a 2 casas.
    expect(result.rows[0].weightedOpenAmount).toBe(33.3)
  })

  it('should label unowned, unknown and nameless owners, and sort by period then name', async () => {
    mockedMembershipRepo.listWithUserByWorkspace.mockResolvedValue(
      ok([member('u_1', 'Ana'), member('u_3', '')] as never),
    )
    mockedOppRepo.listOpenAndWonWithStage.mockResolvedValue(
      ok([
        makeOpp({
          ownerId: 'u_1',
          closeDate: new Date('2026-07-10T00:00:00.000Z'),
        }),
        makeOpp({ ownerId: null }),
        makeOpp({ ownerId: 'ghost' }),
        makeOpp({ ownerId: 'u_3' }),
        makeOpp({ ownerId: 'u_1' }),
      ]),
    )
    const result = expectOk(
      await CrmForecastService.getForecast('u1', 'ws1', 'MONTH'),
    )
    expect(result.rows.map((r) => [r.periodKey, r.ownerName])).toEqual([
      ['2026-06', 'Ana'],
      ['2026-06', 'Desconhecido'],
      ['2026-06', 'Sem responsável'],
      ['2026-06', 'u_3@x.com'],
      ['2026-07', 'Ana'],
    ])
    expect(result.rows.find((r) => r.ownerId === null)?.ownerName).toBe(
      'Sem responsável',
    )
  })
})
