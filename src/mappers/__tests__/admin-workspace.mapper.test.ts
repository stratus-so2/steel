import type { AdminAuditLog, AdminOperation, Backup } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import {
  toAdminAuditEntryDTO,
  toAdminBackupDTO,
  toAdminOperationDTO,
  toAdminWorkspaceDetailDTO,
  toAdminWorkspaceSummaryDTO,
} from '../admin-workspace.mapper'

const now = new Date('2026-09-18T12:00:00.000Z')

describe('toAdminWorkspaceSummaryDTO()', () => {
  it('should map all fields correctly, including memberCount and status', () => {
    const workspace = {
      ...createFakeWorkspace({
        id: 'ws-1',
        name: 'Acme',
        slug: 'acme',
        activePlan: 'BUSINESS',
        status: 'SUSPENDED',
      }),
      memberCount: 5,
    }

    const dto = toAdminWorkspaceSummaryDTO(workspace)

    expect(dto).toEqual({
      id: 'ws-1',
      name: 'Acme',
      slug: 'acme',
      activePlan: 'BUSINESS',
      status: 'SUSPENDED',
      memberCount: 5,
      createdAt: workspace.createdAt.toISOString(),
    })
  })
})

describe('toAdminWorkspaceDetailDTO()', () => {
  it('adds trial and suspension fields as ISO strings', () => {
    const dto = toAdminWorkspaceDetailDTO({
      ...createFakeWorkspace({
        suspendedAt: now,
        suspendedReason: 'inadimplência',
        trialEndsAt: null,
      }),
      memberCount: 1,
    })
    expect(dto).toMatchObject({
      suspendedAt: now.toISOString(),
      suspendedReason: 'inadimplência',
      trialEndsAt: null,
    })
  })
})

describe('toAdminOperationDTO()', () => {
  const base: AdminOperation = {
    id: 'op1',
    kind: 'WORKSPACE_DELETE',
    status: 'COMPLETED',
    step: 'done',
    workspaceId: 'ws1',
    workspaceSlug: 'acme',
    workspaceName: 'Acme',
    backupId: 'b1',
    requestedById: 'admin1',
    requestedByEmail: 'admin@stratustelecom.com.br',
    reason: 'encerramento',
    error: null,
    meta: null,
    createdAt: now,
    updatedAt: now,
    completedAt: now,
  }

  it('reads files and subscriptions from meta, ignoring malformed entries', () => {
    const dto = toAdminOperationDTO({
      ...base,
      meta: {
        filesDeleted: 3,
        filesError: null,
        subscriptionsCancelled: [{ billId: 'bill_0', plan: 'PRO' }],
        subscriptionsToCancel: [
          { billId: 'bill_1', plan: 'PRO', status: 'PAID' },
          { nope: true },
        ],
      },
    })
    expect(dto).toMatchObject({
      filesDeleted: 3,
      filesError: null,
      subscriptionsCancelled: [{ billId: 'bill_0', plan: 'PRO' }],
      subscriptionsToCancel: [{ billId: 'bill_1', plan: 'PRO' }],
      completedAt: now.toISOString(),
    })
  })

  it('defaults meta-derived fields when meta is empty', () => {
    expect(toAdminOperationDTO(base)).toMatchObject({
      filesDeleted: null,
      safetyBackupId: null,
      subscriptionsCancelled: [],
      subscriptionsToCancel: [],
    })
  })
})

describe('toAdminBackupDTO()', () => {
  const backup: Backup = {
    id: 'b1',
    scope: 'WORKSPACE',
    workspaceId: 'ws1',
    workspaceSlug: 'acme',
    triggeredById: 'admin1',
    status: 'COMPLETED',
    storageKey: 'workspace/ws1/b1.json.enc',
    sizeBytes: 10,
    checksum: 'x',
    errorMessage: null,
    offsiteKey: null,
    offsiteCopiedAt: null,
    startedAt: now,
    completedAt: now,
    expiresAt: null,
  }

  it('derives locations, provenance and workspace existence', () => {
    expect(toAdminBackupDTO(backup, new Set(['ws1']))).toMatchObject({
      workspaceExists: true,
      locations: { local: true, offsite: false },
      triggeredBy: 'admin',
    })
    expect(
      toAdminBackupDTO(
        { ...backup, status: 'FAILED', storageKey: null, triggeredById: null },
        new Set(),
      ),
    ).toMatchObject({
      workspaceExists: false,
      locations: { local: false, offsite: false },
      triggeredBy: 'system',
    })
  })
})

describe('toAdminAuditEntryDTO()', () => {
  it('flags failures recorded in meta', () => {
    const entry: AdminAuditLog = {
      id: 'a1',
      actorId: 'admin1',
      actorEmail: 'admin@stratustelecom.com.br',
      action: 'workspace.delete_failed',
      targetType: 'workspace',
      targetId: 'ws1',
      targetLabel: 'acme',
      reason: 'x',
      meta: { outcome: 'failure' },
      createdAt: now,
    }
    expect(toAdminAuditEntryDTO(entry)).toMatchObject({
      failed: true,
      createdAt: now.toISOString(),
    })
  })
})
