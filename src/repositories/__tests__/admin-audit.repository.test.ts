import { describe, expect, it } from 'vitest'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { AdminAuditLogRepository } from '../admin-audit-log.repository'
import { AdminOperationRepository } from '../admin-operation.repository'

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
