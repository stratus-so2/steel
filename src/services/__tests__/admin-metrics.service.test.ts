import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/admin-metrics.repository')
vi.mock('@/src/repositories/module-usage.repository')

import { AdminMetricsRepository } from '@/src/repositories/admin-metrics.repository'
import { ModuleUsageRepository } from '@/src/repositories/module-usage.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { AdminMetricsService } from '../admin-metrics.service'

const mockedUserRepo = vi.mocked(UserRepository)
const mockedMetricsRepo = vi.mocked(AdminMetricsRepository)
const mockedUsageRepo = vi.mocked(ModuleUsageRepository)

const NOW = new Date('2026-09-18T15:00:00Z')
const platformAdmin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})

beforeEach(() => {
  mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
  mockedMetricsRepo.countWorkspaces.mockResolvedValue(ok(5))
  mockedMetricsRepo.countWorkspacesWithLoginSince.mockResolvedValue(ok(3))
  mockedMetricsRepo.listPayingSubscriptions.mockResolvedValue(
    ok([{ workspaceId: 'ws1', amount: 4302, interval: 'MONTHLY' }]),
  )
  mockedMetricsRepo.listEndedSubscriptionsSince.mockResolvedValue(
    ok([
      {
        status: 'CANCELLED',
        amount: 8006,
        interval: 'MONTHLY',
        endedAt: new Date('2026-09-01T12:00:00Z'),
      },
    ]),
  )
  mockedUsageRepo.listSince.mockResolvedValue(
    ok([
      {
        day: '2026-09-17',
        workspaceId: 'ws1',
        workspaceName: 'Acme',
        workspaceSlug: 'acme',
        module: 'CRM',
        requests: 12,
        mutations: 4,
      },
    ]),
  )
  mockedUsageRepo.firstDay.mockResolvedValue(ok('2026-09-01'))
})

describe('AdminMetricsService.getOverview()', () => {
  it('should deny a non-platform-admin', async () => {
    mockedUserRepo.findById.mockResolvedValue(
      ok(createFakeUser({ email: 'x@example.com' })),
    )
    expectErr(await AdminMetricsService.getOverview('u1', NOW), 'FORBIDDEN')
    expect(mockedMetricsRepo.countWorkspaces).not.toHaveBeenCalled()
  })

  it('should assemble the platform overview', async () => {
    const overview = expectOk(
      await AdminMetricsService.getOverview(platformAdmin.id, NOW),
    )

    expect(overview).toMatchObject({
      generatedAt: NOW.toISOString(),
      windowDays: 30,
      totalWorkspaces: 5,
      activeClients: 1,
      workspacesWithLogin: 3,
      mrr: { cents: 4302, payingWorkspaces: 1 },
    })
    expect(overview.churnByMonth).toHaveLength(12)
    expect(overview.churnByMonth.at(-1)).toEqual({
      month: '2026-09',
      cancelled: 1,
      expired: 0,
      lostMrrCents: 8006,
    })
    expect(overview.usage.trackedSince).toBe('2026-09-01')
    expect(overview.usage.topWorkspaces[0].slug).toBe('acme')
    expect(mockedUsageRepo.listSince).toHaveBeenCalledWith('2026-08-20')
  })

  it('should propagate a repository error', async () => {
    mockedUsageRepo.listSince.mockResolvedValue(err(databaseError('boom')))
    expectErr(
      await AdminMetricsService.getOverview(platformAdmin.id, NOW),
      'DATABASE_ERROR',
    )
  })
})
