import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspaceExport } from '@/src/__tests__/factories/workspace-export.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/workspace-export.repository', async (orig) => {
  const actual =
    await orig<
      typeof import('@/src/repositories/workspace-export.repository')
    >()
  return {
    ...actual,
    WorkspaceExportRepository: {
      create: vi.fn(),
      findById: vi.fn(),
      listByWorkspace: vi.fn(),
      takenKinds: vi.fn(),
      markFailed: vi.fn(),
    },
  }
})
vi.mock('@/src/lib/queue/workspace-export', () => ({
  enqueueWorkspaceExport: vi.fn(),
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import { auditMutation } from '@/lib/axiom/audit'
import { enqueueWorkspaceExport } from '@/src/lib/queue/workspace-export'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  DAILY_SLOT_TAKEN,
  WorkspaceExportRepository,
} from '@/src/repositories/workspace-export.repository'
import { WorkspaceExportService } from '../workspace-export.service'

const membershipRepo = vi.mocked(MembershipRepository)
const repo = vi.mocked(WorkspaceExportRepository)
const enqueue = vi.mocked(enqueueWorkspaceExport)
const audit = vi.mocked(auditMutation)

const ACTOR = 'user_1'
const WS = 'ws_1'
// 21:00 in São Paulo on Oct 8 (00:00 UTC on the 9th).
const NOW = new Date('2026-10-09T00:00:00.000Z')
const LOGS_ON = {
  configured: true,
  token: 'xaat-1',
  url: 'https://api.axiom.co',
  dataset: 'steel',
}
const LOGS_OFF = { configured: false, url: 'https://api.axiom.co', dataset: '' }

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  membershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role, userId: ACTOR, workspaceId: WS })),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  asRole('ADMIN')
  repo.listByWorkspace.mockResolvedValue(ok([]))
  repo.takenKinds.mockResolvedValue(ok([]))
  repo.create.mockResolvedValue(
    ok(createFakeWorkspaceExport({ workspaceId: WS })),
  )
  repo.markFailed.mockResolvedValue(ok(undefined))
  enqueue.mockResolvedValue(undefined)
})

describe('WorkspaceExportService.overview', () => {
  it('lists the history and which kinds can run today', async () => {
    repo.listByWorkspace.mockResolvedValue(
      ok([
        createFakeWorkspaceExport({
          workspaceId: WS,
          status: 'COMPLETED',
          storageKey: 'ws_1/ex.zip',
          expiresAt: new Date('2026-10-12T00:00:00.000Z'),
        }),
      ]),
    )
    repo.takenKinds.mockResolvedValue(ok(['DATA']))

    const overview = expectOk(
      await WorkspaceExportService.overview(ACTOR, WS, {
        now: NOW,
        logsConfig: LOGS_OFF,
      }),
    )

    expect(repo.takenKinds).toHaveBeenCalledWith(WS, '2026-10-08')
    expect(overview.items[0].downloadUrl).toContain('/download')
    expect(overview.availability).toEqual([
      {
        kind: 'DATA',
        available: false,
        nextAvailableAt: '2026-10-09T03:00:00.000Z',
        configured: true,
      },
      {
        kind: 'LOGS',
        available: true,
        nextAvailableAt: null,
        configured: false,
      },
    ])
    expect(overview.retentionDays).toBe(7)
    expect(overview.logsPeriodDays).toEqual([1, 7, 30])
  })

  it('reads the server clock and config by default', async () => {
    const overview = expectOk(await WorkspaceExportService.overview(ACTOR, WS))
    expect(overview.availability).toHaveLength(2)
  })

  it('is only for OWNER and ADMIN', async () => {
    asRole('MEMBER')
    expectErr(await WorkspaceExportService.overview(ACTOR, WS), 'FORBIDDEN')
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await WorkspaceExportService.overview(ACTOR, WS), 'FORBIDDEN')
  })

  it('propagates repository errors', async () => {
    repo.listByWorkspace.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await WorkspaceExportService.overview(ACTOR, WS),
      'DATABASE_ERROR',
    )
    repo.takenKinds.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await WorkspaceExportService.overview(ACTOR, WS),
      'DATABASE_ERROR',
    )
  })
})

describe('WorkspaceExportService.request', () => {
  it('records the request for the São Paulo day, enqueues and audits', async () => {
    const dto = expectOk(
      await WorkspaceExportService.request(
        ACTOR,
        WS,
        { kind: 'DATA' },
        { now: NOW, logsConfig: LOGS_OFF },
      ),
    )
    expect(repo.create).toHaveBeenCalledWith({
      workspaceId: WS,
      kind: 'DATA',
      requestedById: ACTOR,
      dayKey: '2026-10-08',
    })
    expect(enqueue).toHaveBeenCalledWith(dto.id)
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'workspace_export',
        action: 'export_requested',
        actorId: ACTOR,
        meta: { workspaceId: WS, kind: 'DATA' },
      }),
    )
  })

  it('stores the logs window', async () => {
    expectOk(
      await WorkspaceExportService.request(
        ACTOR,
        WS,
        { kind: 'LOGS', periodDays: 30 },
        { now: NOW, logsConfig: LOGS_ON },
      ),
    )
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'LOGS',
        periodFrom: new Date('2026-09-09T00:00:00.000Z'),
        periodTo: NOW,
      }),
    )
    expect(audit.mock.calls[0][0].meta).toEqual({
      workspaceId: WS,
      kind: 'LOGS',
      periodDays: 30,
    })
  })

  it('refuses the logs export when Axiom is not configured', async () => {
    expectErr(
      await WorkspaceExportService.request(
        ACTOR,
        WS,
        { kind: 'LOGS', periodDays: 7 },
        { now: NOW, logsConfig: LOGS_OFF },
      ),
      'WORKSPACE_EXPORT_LOGS_UNAVAILABLE',
    )
    expect(repo.create).not.toHaveBeenCalled()
  })

  it('allows one export of each kind per day and says when the next one opens', async () => {
    repo.create.mockResolvedValue(ok(DAILY_SLOT_TAKEN))
    const error = expectErr(
      await WorkspaceExportService.request(
        ACTOR,
        WS,
        { kind: 'DATA' },
        { now: NOW },
      ),
      'WORKSPACE_EXPORT_LIMIT_REACHED',
    )
    expect(error.message).toContain('já foi feita hoje')
    expect(error.message).toContain('09/10/2026, 00:00')
    expect(error.details).toEqual({
      nextAvailableAt: '2026-10-09T03:00:00.000Z',
    })
    expect(enqueue).not.toHaveBeenCalled()
  })

  it('frees the slot when the job cannot be enqueued', async () => {
    enqueue.mockRejectedValueOnce(new Error('redis down'))
    expectErr(
      await WorkspaceExportService.request(ACTOR, WS, { kind: 'DATA' }),
      'WORKSPACE_EXPORT_NOT_READY',
    )
    expect(repo.markFailed).toHaveBeenCalledWith(
      expect.any(String),
      'redis down',
    )

    enqueue.mockRejectedValueOnce('offline')
    expectErr(
      await WorkspaceExportService.request(ACTOR, WS, { kind: 'DATA' }),
      'WORKSPACE_EXPORT_NOT_READY',
    )
    expect(repo.markFailed).toHaveBeenLastCalledWith(
      expect.any(String),
      'offline',
    )
    expect(audit).not.toHaveBeenCalled()
  })

  it('denies members and propagates database errors', async () => {
    asRole('MEMBER')
    expectErr(
      await WorkspaceExportService.request(ACTOR, WS, { kind: 'DATA' }),
      'FORBIDDEN',
    )
    asRole('OWNER')
    repo.create.mockResolvedValueOnce(err(databaseError('x')))
    expectErr(
      await WorkspaceExportService.request(ACTOR, WS, { kind: 'DATA' }),
      'DATABASE_ERROR',
    )
  })
})

describe('WorkspaceExportService.authorizeDownload', () => {
  const ready = () =>
    createFakeWorkspaceExport({
      id: 'ex1',
      workspaceId: WS,
      status: 'COMPLETED',
      storageKey: 'ws_1/ex1.zip',
      fileName: 'steel-acme-dados-2026-10-08.zip',
      sizeBytes: BigInt(2048),
      expiresAt: new Date('2026-10-15T00:00:00.000Z'),
    })

  it('returns the object and audits the download', async () => {
    repo.findById.mockResolvedValue(ok(ready()))
    const target = expectOk(
      await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1', {
        now: NOW,
      }),
    )
    expect(repo.findById).toHaveBeenCalledWith('ex1', WS)
    expect(target).toEqual({
      bucket: 'workspace-exports',
      key: 'ws_1/ex1.zip',
      fileName: 'steel-acme-dados-2026-10-08.zip',
      sizeBytes: 2048,
    })
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'download', targetId: 'ex1' }),
    )
  })

  it('falls back to the id as the file name and an unknown size', async () => {
    repo.findById.mockResolvedValue(
      ok({ ...ready(), fileName: null, sizeBytes: null }),
    )
    const target = expectOk(
      await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1', {
        now: NOW,
      }),
    )
    expect(target.fileName).toBe('ex1.zip')
    expect(target.sizeBytes).toBeNull()
  })

  it('refuses expired, running and failed exports', async () => {
    repo.findById.mockResolvedValue(
      ok({ ...ready(), expiresAt: new Date('2026-10-01T00:00:00.000Z') }),
    )
    const expired = expectErr(
      await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1', {
        now: NOW,
      }),
      'WORKSPACE_EXPORT_NOT_READY',
    )
    expect(expired.message).toContain('expirou')

    repo.findById.mockResolvedValue(
      ok({ ...ready(), status: 'EXPIRED', storageKey: null }),
    )
    expect(
      expectErr(
        await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1'),
        'WORKSPACE_EXPORT_NOT_READY',
      ).message,
    ).toContain('expirou')

    repo.findById.mockResolvedValue(
      ok({ ...ready(), status: 'RUNNING', storageKey: null }),
    )
    expect(
      expectErr(
        await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1'),
        'WORKSPACE_EXPORT_NOT_READY',
      ).message,
    ).toContain('não está disponível')
    expect(audit).not.toHaveBeenCalled()
  })

  it('denies members and unknown exports', async () => {
    asRole('MEMBER')
    expectErr(
      await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1'),
      'FORBIDDEN',
    )
    asRole('ADMIN')
    repo.findById.mockResolvedValue(err(databaseError('x')))
    expectErr(
      await WorkspaceExportService.authorizeDownload(ACTOR, WS, 'ex1'),
      'DATABASE_ERROR',
    )
  })
})
