import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-opportunity.repository')
vi.mock('@/src/repositories/crm-quota.repository')

import { CrmOpportunityRepository } from '@/src/repositories/crm-opportunity.repository'
import { CrmQuotaRepository } from '@/src/repositories/crm-quota.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
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
