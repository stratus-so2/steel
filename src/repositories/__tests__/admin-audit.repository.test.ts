import { afterEach, describe, expect, it, vi } from 'vitest'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AdminAuditLogRepository } from '../admin-audit-log.repository'
import { AdminOperationRepository } from '../admin-operation.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

const actor = { actorId: 'admin1', actorEmail: 'admin@stratustelecom.com.br' }

describe('AdminAuditLogRepository', () => {
  it('lists recent entries newest first and filters by target', async () => {
    expectOk(
      await AdminAuditLogRepository.create({
        ...actor,
        action: 'workspace.suspend',
        targetType: 'workspace',
        targetId: 'ws1',
        targetLabel: 'acme',
        reason: 'inadimplência',
        meta: { previousStatus: 'ACTIVE' },
      }),
    )
    await new Promise((r) => setTimeout(r, 5))
    expectOk(
      await AdminAuditLogRepository.create({
        ...actor,
        action: 'backup.full_requested',
        targetType: 'platform',
      }),
    )

    const recent = expectOk(await AdminAuditLogRepository.listRecent(10))
    expect(recent.map((e) => e.action)).toEqual([
      'backup.full_requested',
      'workspace.suspend',
    ])

    const byTarget = expectOk(
      await AdminAuditLogRepository.listByTarget('workspace', 'ws1', 10),
    )
    expect(byTarget).toHaveLength(1)
    expect(byTarget[0]).toMatchObject({ reason: 'inadimplência' })
  })
})

describe('AdminOperationRepository', () => {
  const base = {
    kind: 'WORKSPACE_DELETE' as const,
    workspaceId: 'ws1',
    workspaceSlug: 'acme',
    workspaceName: 'Acme',
    requestedById: 'admin1',
    requestedByEmail: 'admin@stratustelecom.com.br',
    reason: 'encerramento',
  }

  it('finds only QUEUED/RUNNING operations as active', async () => {
    const op = expectOk(await AdminOperationRepository.create(base))
    expect(op).toMatchObject({ status: 'QUEUED', step: 'queued' })

    const active = expectOk(
      await AdminOperationRepository.findActiveByWorkspace('ws1'),
    )
    expect(active?.id).toBe(op.id)

    expectOk(await AdminOperationRepository.markFailed(op.id, 'boom'))
    expect(
      expectOk(await AdminOperationRepository.findActiveByWorkspace('ws1')),
    ).toBeNull()

    const found = expectOk(await AdminOperationRepository.findById(op.id))
    expect(found).toMatchObject({ status: 'FAILED', error: 'boom' })
  })

  it('lists recent operations, optionally per workspace', async () => {
    expectOk(await AdminOperationRepository.create(base))
    expectOk(
      await AdminOperationRepository.create({ ...base, workspaceId: 'ws2' }),
    )

    expect(
      expectOk(await AdminOperationRepository.listRecent({ limit: 10 })),
    ).toHaveLength(2)
    expect(
      expectOk(
        await AdminOperationRepository.listRecent({
          workspaceId: 'ws2',
          limit: 10,
        }),
      ),
    ).toHaveLength(1)
  })
})

describe('admin repositories — database failures', () => {
  it('AdminAuditLogRepository returns DATABASE_ERROR when queries throw', async () => {
    vi.spyOn(prisma.adminAuditLog, 'create').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.adminAuditLog, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(
      await AdminAuditLogRepository.create({
        ...actor,
        action: 'workspace.suspend',
        targetType: 'workspace',
      }),
      'DATABASE_ERROR',
    )
    expectErr(await AdminAuditLogRepository.listRecent(5), 'DATABASE_ERROR')
    expectErr(
      await AdminAuditLogRepository.listByTarget('workspace', 'ws1', 5),
      'DATABASE_ERROR',
    )
  })

  it('AdminOperationRepository returns DATABASE_ERROR when queries throw', async () => {
    vi.spyOn(prisma.adminOperation, 'create').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.adminOperation, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.adminOperation, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.adminOperation, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(
      await AdminOperationRepository.create({
        kind: 'WORKSPACE_DELETE',
        workspaceId: 'ws1',
        workspaceSlug: 'acme',
        workspaceName: 'Acme',
        requestedById: 'admin1',
        requestedByEmail: 'admin@stratustelecom.com.br',
        reason: 'x',
      }),
      'DATABASE_ERROR',
    )
    expectErr(await AdminOperationRepository.findById('op'), 'DATABASE_ERROR')
    expectErr(
      await AdminOperationRepository.findActiveByWorkspace('ws1'),
      'DATABASE_ERROR',
    )
    expectErr(
      await AdminOperationRepository.listRecent({ limit: 5 }),
      'DATABASE_ERROR',
    )
  })

  it('markFailed() returns DATABASE_ERROR for an unknown operation', async () => {
    expectErr(
      await AdminOperationRepository.markFailed('missing', 'boom'),
      'DATABASE_ERROR',
    )
  })
})
