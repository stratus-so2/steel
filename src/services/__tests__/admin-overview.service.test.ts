import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/admin-overview.repository')
vi.mock('@/src/repositories/admin-metrics.repository')
vi.mock('@/src/repositories/admin-operation.repository')
vi.mock('@/src/repositories/status.repository')
vi.mock('@/src/repositories/backup.repository')
vi.mock('@/src/lib/queue/health', () => ({ getQueueHealth: vi.fn() }))

import { getQueueHealth } from '@/src/lib/queue/health'
import { AdminAuditLogRepository } from '@/src/repositories/admin-audit-log.repository'
import { AdminMetricsRepository } from '@/src/repositories/admin-metrics.repository'
import { AdminOperationRepository } from '@/src/repositories/admin-operation.repository'
import { AdminOverviewRepository } from '@/src/repositories/admin-overview.repository'
import { BackupRepository } from '@/src/repositories/backup.repository'
import { StatusRepository } from '@/src/repositories/status.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { AdminOverviewService } from '../admin-overview.service'

const admin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})

beforeEach(() => {
  vi.mocked(UserRepository.findById).mockResolvedValue(ok(admin))
  vi.mocked(AdminOverviewRepository.workspaceCounts).mockResolvedValue(
    ok({
      total: 10,
      active: 8,
      suspended: 1,
      deleting: 1,
      trial: 2,
      createdLast30d: 3,
      createdPrev30d: 1,
    }),
  )
  vi.mocked(AdminOverviewRepository.userCounts).mockResolvedValue(
    ok({ total: 40, createdLast7d: 5, createdPrev7d: 2 }),
  )
  vi.mocked(AdminOverviewRepository.recentSignups).mockResolvedValue(ok([]))
  vi.mocked(AdminMetricsRepository.listPayingSubscriptions).mockResolvedValue(
    ok([]),
  )
  vi.mocked(AdminOperationRepository.listRecent).mockResolvedValue(ok([]))
  vi.mocked(BackupRepository.list).mockResolvedValue(ok([]))
  vi.mocked(BackupRepository.existingWorkspaceIds).mockResolvedValue(
    ok(new Set()),
  )
  vi.mocked(StatusRepository.findLatestPerComponent).mockResolvedValue(
    ok([
      {
        id: 'h1',
        componentKey: 'database',
        status: 'OPERATIONAL',
        latencyMs: 4,
        error: null,
        checkedAt: new Date('2026-09-18T12:00:00Z'),
      },
      {
        id: 'h2',
        componentKey: 'legacy-probe',
        status: 'OPERATIONAL',
        latencyMs: 1,
        error: null,
        checkedAt: new Date('2026-09-18T12:00:00Z'),
      },
    ]),
  )
})

describe('AdminOverviewService.get()', () => {
  it('denies a non-platform-admin', async () => {
    vi.mocked(UserRepository.findById).mockResolvedValue(
      ok(createFakeUser({ email: 'x@cliente.com' })),
    )
    expectErr(await AdminOverviewService.get('u1'), 'FORBIDDEN')
  })

  it('assembles totals, status with component names and queue health', async () => {
    vi.mocked(getQueueHealth).mockResolvedValue([
      {
        name: 'database-backup',
        waiting: 0,
        active: 1,
        delayed: 0,
        failed: 2,
        completed: 9,
      },
    ])

    const dto = expectOk(await AdminOverviewService.get(admin.id))

    expect(dto.workspaces.suspended).toBe(1)
    expect(dto.users.createdLast7d).toBe(5)
    expect(dto.mrr).toEqual({ cents: 0, payingWorkspaces: 0 })
    expect(dto.status).toEqual([
      expect.objectContaining({
        componentKey: 'database',
        name: 'Banco de dados',
      }),
    ])
    expect(dto.queues?.[0]).toMatchObject({
      name: 'database-backup',
      failed: 2,
    })
  })

  it('degrades queue health to null when Redis does not answer', async () => {
    vi.mocked(getQueueHealth).mockRejectedValue(new Error('timeout'))
    const dto = expectOk(await AdminOverviewService.get(admin.id))
    expect(dto.queues).toBeNull()
  })
})

describe('AdminOverviewService.get() failures', () => {
  const DB_ERROR = { code: 'DATABASE_ERROR' as const, message: 'db down' }

  beforeEach(() => {
    vi.mocked(getQueueHealth).mockResolvedValue([])
    vi.mocked(AdminAuditLogRepository.listRecent).mockResolvedValue(ok([]))
  })

  it('degrades queue health on a non-Error rejection too', async () => {
    vi.mocked(getQueueHealth).mockRejectedValue('ECONNREFUSED')

    expect(expectOk(await AdminOverviewService.get(admin.id)).queues).toBeNull()
  })

  it.each([
    [
      'workspace counts',
      () =>
        vi
          .mocked(AdminOverviewRepository.workspaceCounts)
          .mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'user counts',
      () =>
        vi
          .mocked(AdminOverviewRepository.userCounts)
          .mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'paying subscriptions',
      () =>
        vi
          .mocked(AdminMetricsRepository.listPayingSubscriptions)
          .mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'recent signups',
      () =>
        vi
          .mocked(AdminOverviewRepository.recentSignups)
          .mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'recent admin actions',
      () =>
        vi
          .mocked(AdminAuditLogRepository.listRecent)
          .mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'status health',
      () =>
        vi
          .mocked(StatusRepository.findLatestPerComponent)
          .mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'recent backups',
      () => vi.mocked(BackupRepository.list).mockResolvedValue(err(DB_ERROR)),
    ],
    [
      'recent operations',
      () =>
        vi
          .mocked(AdminOperationRepository.listRecent)
          .mockResolvedValue(err(DB_ERROR)),
    ],
  ])('propagates a failure loading %s', async (_label, arrangeFailure) => {
    arrangeFailure()

    expectErr(await AdminOverviewService.get(admin.id), 'DATABASE_ERROR')
  })
})
