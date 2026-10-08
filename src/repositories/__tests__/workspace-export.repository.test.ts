import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { seedWorkspaceExport } from '@/src/__tests__/factories/workspace-export.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  DAILY_SLOT_TAKEN,
  WorkspaceExportRepository,
} from '../workspace-export.repository'

async function setup() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  return { workspace, user }
}

describe('WorkspaceExportRepository', () => {
  it('creates one export per kind and day, and reports the taken slot', async () => {
    const { workspace, user } = await setup()
    const base = {
      workspaceId: workspace.id,
      requestedById: user.id,
      dayKey: '2026-10-08',
    }
    const data = expectOk(
      await WorkspaceExportRepository.create({ ...base, kind: 'DATA' }),
    )
    expect(data).not.toBe(DAILY_SLOT_TAKEN)
    if (data === DAILY_SLOT_TAKEN) return
    expect(data.status).toBe('PENDING')
    expect(data.requestedBy?.email).toBe(user.email)

    expect(
      expectOk(
        await WorkspaceExportRepository.create({ ...base, kind: 'DATA' }),
      ),
    ).toBe(DAILY_SLOT_TAKEN)
    const logs = expectOk(
      await WorkspaceExportRepository.create({
        ...base,
        kind: 'LOGS',
        periodFrom: new Date('2026-10-01T00:00:00.000Z'),
        periodTo: new Date('2026-10-08T00:00:00.000Z'),
      }),
    )
    expect(logs).not.toBe(DAILY_SLOT_TAKEN)

    expect(
      expectOk(
        await WorkspaceExportRepository.takenKinds(workspace.id, '2026-10-08'),
      ).sort(),
    ).toEqual(['DATA', 'LOGS'])
    expect(
      expectOk(
        await WorkspaceExportRepository.takenKinds(workspace.id, '2026-10-09'),
      ),
    ).toEqual([])
  })

  it('frees the daily slot when an export fails', async () => {
    const { workspace, user } = await setup()
    const row = await seedWorkspaceExport(workspace.id, user.id)
    expectOk(await WorkspaceExportRepository.markRunning(row.id))
    expectOk(
      await WorkspaceExportRepository.markFailed(row.id, 'x'.repeat(600)),
    )
    const failed = expectOk(await WorkspaceExportRepository.findById(row.id))
    expect(failed.status).toBe('FAILED')
    expect(failed.dayKey).toBeNull()
    expect(failed.errorMessage).toHaveLength(500)
    expect(failed.startedAt).not.toBeNull()

    const retry = expectOk(
      await WorkspaceExportRepository.create({
        workspaceId: workspace.id,
        kind: 'DATA',
        requestedById: user.id,
        dayKey: '2026-10-08',
      }),
    )
    expect(retry).not.toBe(DAILY_SLOT_TAKEN)
  })

  it('completes, lists newest first and scopes findById by workspace', async () => {
    const { workspace, user } = await setup()
    const other = await seedWorkspace()
    const older = await seedWorkspaceExport(workspace.id, user.id, {
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      dayKey: '2026-10-01',
    })
    const newer = await seedWorkspaceExport(workspace.id, null, {
      kind: 'LOGS',
    })
    await seedWorkspaceExport(other.id, null)

    expectOk(
      await WorkspaceExportRepository.markCompleted(older.id, {
        storageKey: `${workspace.id}/${older.id}.zip`,
        fileName: 'steel.zip',
        sizeBytes: 4096,
        itemCount: 12,
        completedAt: new Date('2026-10-01T01:00:00.000Z'),
        expiresAt: new Date('2026-10-08T01:00:00.000Z'),
      }),
    )
    const list = expectOk(
      await WorkspaceExportRepository.listByWorkspace(workspace.id),
    )
    expect(list.map((r) => r.id)).toEqual([newer.id, older.id])
    expect(list[1].sizeBytes).toBe(BigInt(4096))
    expect(list[0].requestedBy).toBeNull()

    expectErr(
      await WorkspaceExportRepository.findById(older.id, other.id),
      'WORKSPACE_EXPORT_NOT_FOUND',
    )
    expect(
      expectOk(await WorkspaceExportRepository.findById(older.id, workspace.id))
        .status,
    ).toBe('COMPLETED')
  })

  it('finds expired files, expires them and lists the live keys', async () => {
    const { workspace } = await setup()
    const expired = await seedWorkspaceExport(workspace.id, null, {
      status: 'COMPLETED',
      storageKey: 'ws/expired.zip',
      expiresAt: new Date('2026-10-01T00:00:00.000Z'),
    })
    await seedWorkspaceExport(workspace.id, null, {
      kind: 'LOGS',
      status: 'COMPLETED',
      storageKey: 'ws/live.zip',
      expiresAt: new Date('2026-10-20T00:00:00.000Z'),
    })
    const now = new Date('2026-10-08T00:00:00.000Z')

    expect(expectOk(await WorkspaceExportRepository.listExpired(now))).toEqual([
      { id: expired.id, storageKey: 'ws/expired.zip' },
    ])
    expect(expectOk(await WorkspaceExportRepository.liveStorageKeys())).toEqual(
      new Set(['ws/expired.zip', 'ws/live.zip']),
    )

    expect(expectOk(await WorkspaceExportRepository.markExpired([]))).toBe(0)
    expect(
      expectOk(await WorkspaceExportRepository.markExpired([expired.id])),
    ).toBe(1)
    const row = await prisma.workspaceExport.findUnique({
      where: { id: expired.id },
    })
    expect(row?.status).toBe('EXPIRED')
    expect(row?.storageKey).toBeNull()
    expect(expectOk(await WorkspaceExportRepository.listExpired(now))).toEqual(
      [],
    )
  })
})

describe('WorkspaceExportRepository — database failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns DATABASE_ERROR when Prisma throws', async () => {
    const boom = () => Promise.reject(new Error('boom'))
    vi.spyOn(prisma.workspaceExport, 'create').mockImplementation(boom as never)
    vi.spyOn(prisma.workspaceExport, 'findFirst').mockImplementation(
      boom as never,
    )
    vi.spyOn(prisma.workspaceExport, 'findMany').mockImplementation(
      boom as never,
    )
    vi.spyOn(prisma.workspaceExport, 'update').mockImplementation(boom as never)
    vi.spyOn(prisma.workspaceExport, 'updateMany').mockImplementation(
      boom as never,
    )
    const base = {
      workspaceId: 'w',
      kind: 'DATA' as const,
      requestedById: 'u',
      dayKey: 'd',
    }
    expectErr(await WorkspaceExportRepository.create(base), 'DATABASE_ERROR')
    expectErr(await WorkspaceExportRepository.findById('x'), 'DATABASE_ERROR')
    expectErr(
      await WorkspaceExportRepository.listByWorkspace('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await WorkspaceExportRepository.takenKinds('w', 'd'),
      'DATABASE_ERROR',
    )
    expectErr(
      await WorkspaceExportRepository.markRunning('x'),
      'DATABASE_ERROR',
    )
    expectErr(
      await WorkspaceExportRepository.listExpired(new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await WorkspaceExportRepository.markExpired(['x']),
      'DATABASE_ERROR',
    )
    expectErr(
      await WorkspaceExportRepository.liveStorageKeys(),
      'DATABASE_ERROR',
    )
  })
})
