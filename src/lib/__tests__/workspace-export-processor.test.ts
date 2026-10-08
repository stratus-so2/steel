import type { Job } from 'bullmq'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readZip } from '@/src/__tests__/helpers/zip-reader'

const mocks = vi.hoisted(() => ({
  repo: {
    findById: vi.fn(),
    markRunning: vi.fn(),
    markCompleted: vi.fn(),
    markFailed: vi.fn(),
    listExpired: vi.fn(),
    markExpired: vi.fn(),
    liveStorageKeys: vi.fn(),
  },
  prisma: {
    workspace: { findUnique: vi.fn() },
    membership: { findMany: vi.fn() },
  },
  gatherWorkspaceData: vi.fn(),
  s3: {
    ensureBucket: vi.fn(),
    putObject: vi.fn(),
    deleteObjects: vi.fn(),
    listObjectKeys: vi.fn(),
  },
  runApl: vi.fn(),
  sendEmail: vi.fn(),
  notify: vi.fn(),
  audit: vi.fn(),
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

vi.mock('@/src/repositories/workspace-export.repository', () => ({
  WorkspaceExportRepository: mocks.repo,
}))
vi.mock('@/src/lib/prisma', () => ({ prisma: mocks.prisma }))
vi.mock('@/src/lib/queue/workspace-snapshot', () => ({
  gatherWorkspaceData: mocks.gatherWorkspaceData,
}))
vi.mock('@/src/lib/storage/s3', () => mocks.s3)
vi.mock('@/src/lib/analytics/axiom-query', () => ({ runApl: mocks.runApl }))
vi.mock('@/src/lib/mail/workspace/send-workspace-export-ready', () => ({
  sendWorkspaceExportReadyEmail: mocks.sendEmail,
}))
vi.mock('@/src/services/platform-notifications', () => ({
  notifyWorkspaceExportReady: mocks.notify,
}))
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: mocks.audit }))
vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.logger }))

import { workspaceExportNotFound } from '@/src/errors'
import { WorkspaceExportJob } from '@/src/lib/queue/jobs'
import {
  formatFileSize,
  handleWorkspaceExportJob,
  processWorkspaceExport,
} from '@/src/lib/queue/processors/workspace-export'

const NOW = new Date('2026-10-08T15:00:00.000Z')
const LOGS = {
  configured: true,
  token: 'xaat-1',
  url: 'https://api.axiom.co',
  dataset: 'steel',
}

function job(
  name: string,
  data: unknown = { exportId: 'ex1' },
  attempts = { made: 0, max: 2 },
): Job {
  return {
    id: 'j1',
    name,
    data,
    attemptsMade: attempts.made,
    opts: { attempts: attempts.max },
  } as unknown as Job
}

function exportRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ex1',
    workspaceId: 'ws1',
    kind: 'DATA',
    status: 'PENDING',
    requestedById: 'u1',
    requestedBy: { id: 'u1', name: 'Ana', email: 'ana@acme.test' },
    periodFrom: null,
    periodTo: null,
    ...overrides,
  }
}

const ok = <T>(value: T) => ({ ok: true as const, value })
const fail = (message = 'boom') => ({
  ok: false as const,
  error: { code: 'DATABASE_ERROR', message },
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.repo.findById.mockResolvedValue(ok(exportRow()))
  mocks.repo.markRunning.mockResolvedValue(ok(undefined))
  mocks.repo.markCompleted.mockResolvedValue(ok(undefined))
  mocks.repo.markFailed.mockResolvedValue(ok(undefined))
  mocks.prisma.workspace.findUnique.mockResolvedValue({
    id: 'ws1',
    name: 'Acme',
    slug: 'acme',
  })
  mocks.prisma.membership.findMany.mockResolvedValue([
    {
      role: 'OWNER',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      user: { id: 'u1', name: 'Ana', email: 'ana@acme.test' },
    },
  ])
  mocks.gatherWorkspaceData.mockResolvedValue({
    workspace: { id: 'ws1', name: 'Acme' },
    sdTicket: [{ id: 't1', title: 'Falha' }],
    whatsAppConnection: [{ id: 'c1', encryptedToken: 'x' }],
  })
  mocks.notify.mockResolvedValue(1)
  mocks.sendEmail.mockResolvedValue({ id: 'm1' })
})

function uploaded(): Map<string, string> {
  const call = mocks.s3.putObject.mock.calls[0][0]
  expect(call.bucket).toBe('workspace-exports')
  expect(call.key).toBe('ws1/ex1.zip')
  expect(call.contentType).toBe('application/zip')
  return readZip(call.body)
}

describe('workspace-export processor — run', () => {
  it('zips the complete workspace data, notifies and e-mails the requester', async () => {
    const result = await handleWorkspaceExportJob(
      job(WorkspaceExportJob.Run),
      NOW,
    )

    expect(result).toMatchObject({ exported: true })
    expect(mocks.repo.markRunning).toHaveBeenCalledWith('ex1')
    const files = uploaded()
    expect(files.has('LEIA-ME.txt')).toBe(true)
    expect(JSON.parse(files.get('json/members.json') as string)).toEqual([
      {
        userId: 'u1',
        name: 'Ana',
        email: 'ana@acme.test',
        role: 'OWNER',
        memberSince: '2026-01-01T00:00:00.000Z',
      },
    ])
    expect(files.get('json/workspace.json')).toContain('"Acme"')
    expect(files.get('json/whatsAppConnection.json')).toContain('[removido]')
    const manifest = JSON.parse(files.get('manifest.json') as string)
    expect(manifest.tables).toHaveLength(4)

    const completed = mocks.repo.markCompleted.mock.calls[0]
    expect(completed[0]).toBe('ex1')
    expect(completed[1]).toMatchObject({
      storageKey: 'ws1/ex1.zip',
      fileName: 'steel-acme-dados-2026-10-08.zip',
      itemCount: 4,
      completedAt: NOW,
      expiresAt: new Date('2026-10-15T15:00:00.000Z'),
    })
    expect(mocks.notify).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      requestedById: 'u1',
      exportId: 'ex1',
      kindLabel: 'dados completos',
    })
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'ana@acme.test',
        workspaceName: 'Acme',
        pageUrl: expect.stringMatching(/\/acme\/settings\/exports$/),
        expiresAt: '15/10/2026, 12:00',
      }),
    )
    expect(mocks.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'workspace_export',
        action: 'export_completed',
        targetId: 'ex1',
      }),
    )
  })

  it('exports an empty snapshot without the workspace row', async () => {
    mocks.gatherWorkspaceData.mockResolvedValue({ workspace: null })
    await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW)
    const files = uploaded()
    expect(files.has('json/workspace.json')).toBe(false)
  })

  it('queries Axiom for the requested window and writes the logs oldest first', async () => {
    mocks.repo.findById.mockResolvedValue(
      ok(
        exportRow({
          kind: 'LOGS',
          periodFrom: new Date('2026-10-07T15:00:00.000Z'),
          periodTo: NOW,
        }),
      ),
    )
    mocks.runApl.mockResolvedValue(
      ok([
        { time: '2026-10-08T14:00:00Z', message: 'newest' },
        { time: '2026-10-08T10:00:00Z', message: 'oldest' },
      ]),
    )

    await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW, {
      logsConfig: LOGS,
    })

    const [apl, window, options] = mocks.runApl.mock.calls[0]
    expect(apl).toContain('"ws1"')
    expect(window).toEqual({
      from: new Date('2026-10-07T15:00:00.000Z'),
      to: NOW,
    })
    expect(options).toMatchObject({ token: 'xaat-1', timeoutMs: 60_000 })
    const files = uploaded()
    const ndjson = (files.get('logs.ndjson') as string).trim().split('\n')
    expect(JSON.parse(ndjson[0]).message).toBe('oldest')
    expect(files.get('logs.csv')).toContain('newest')
    expect(mocks.repo.markCompleted.mock.calls[0][1]).toMatchObject({
      fileName: 'steel-acme-logs-2026-10-08.zip',
      itemCount: 2,
    })
    expect(mocks.notify).toHaveBeenCalledWith(
      expect.objectContaining({ kindLabel: 'logs' }),
    )
  })

  it('defaults a logs window without dates to the last 7 days', async () => {
    mocks.repo.findById.mockResolvedValue(ok(exportRow({ kind: 'LOGS' })))
    mocks.runApl.mockResolvedValue(ok([]))
    await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW, {
      logsConfig: LOGS,
    })
    expect(mocks.runApl.mock.calls[0][1]).toEqual({
      from: new Date('2026-10-01T15:00:00.000Z'),
      to: NOW,
    })
  })

  it('fails the export on the last attempt when Axiom is not configured', async () => {
    mocks.repo.findById.mockResolvedValue(ok(exportRow({ kind: 'LOGS' })))
    await expect(
      handleWorkspaceExportJob(
        job(WorkspaceExportJob.Run, undefined, { made: 1, max: 2 }),
        NOW,
        { logsConfig: { ...LOGS, configured: false, token: undefined } },
      ),
    ).rejects.toThrow('AXIOM_QUERY_TOKEN')
    expect(mocks.repo.markFailed).toHaveBeenCalledWith(
      'ex1',
      expect.stringContaining('not configured'),
    )
    expect(mocks.s3.putObject).not.toHaveBeenCalled()
  })

  it('reads the server config when none is injected', async () => {
    mocks.repo.findById.mockResolvedValue(ok(exportRow({ kind: 'LOGS' })))
    // The unit env has no AXIOM_QUERY_TOKEN.
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).rejects.toThrow('not configured')
  })

  it('keeps the export pending for a retry when an attempt remains', async () => {
    mocks.repo.findById.mockResolvedValue(ok(exportRow({ kind: 'LOGS' })))
    mocks.runApl.mockResolvedValue({
      ok: false,
      error: { code: 'ANALYTICS_QUERY_FAILED', message: 'Axiom respondeu 500' },
    })
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW, {
        logsConfig: LOGS,
      }),
    ).rejects.toThrow('Axiom respondeu 500')
    expect(mocks.repo.markFailed).not.toHaveBeenCalled()
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.workspace_export.failed',
      expect.any(Object),
    )
  })

  it('treats a job without attempt options as the last attempt', async () => {
    mocks.prisma.workspace.findUnique.mockResolvedValue(null)
    const single = {
      ...job(WorkspaceExportJob.Run),
      opts: {},
    } as unknown as Job
    await expect(handleWorkspaceExportJob(single, NOW)).rejects.toThrow(
      'Workspace ws1 not found',
    )
    expect(mocks.repo.markFailed).toHaveBeenCalled()
  })

  it('skips an export that is gone or already finished', async () => {
    mocks.repo.findById.mockResolvedValueOnce({
      ok: false,
      error: workspaceExportNotFound(),
    })
    expect(
      await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).toEqual({ exported: false, reason: 'not_found' })

    mocks.repo.findById.mockResolvedValueOnce(
      ok(exportRow({ status: 'COMPLETED' })),
    )
    expect(
      await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).toEqual({ exported: false, reason: 'status_completed' })
    expect(mocks.repo.markRunning).not.toHaveBeenCalled()
  })

  it('retries a database error while loading the export', async () => {
    mocks.repo.findById.mockResolvedValue(fail('db down'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).rejects.toThrow('db down')
  })

  it('surfaces failures to mark the export running or completed', async () => {
    mocks.repo.markRunning.mockResolvedValueOnce(fail('running failed'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).rejects.toThrow('running failed')

    mocks.repo.markCompleted.mockResolvedValueOnce(fail('completed failed'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).rejects.toThrow('completed failed')
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it('still completes when the e-mail fails, and skips notices without a requester', async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error('resend down'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).resolves.toMatchObject({ exported: true })
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'queue.workspace_export.email_failed',
      expect.objectContaining({ message: 'resend down' }),
    )

    mocks.sendEmail.mockRejectedValueOnce('plain failure')
    await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW)
    expect(mocks.logger.warn).toHaveBeenLastCalledWith(
      'queue.workspace_export.email_failed',
      expect.objectContaining({ message: 'plain failure' }),
    )

    vi.clearAllMocks()
    mocks.repo.findById.mockResolvedValue(
      ok(exportRow({ requestedBy: null, requestedById: null })),
    )
    mocks.repo.markRunning.mockResolvedValue(ok(undefined))
    mocks.repo.markCompleted.mockResolvedValue(ok(undefined))
    await handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW)
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('logs a non-Error failure as text', async () => {
    mocks.s3.putObject.mockRejectedValueOnce('storage offline')
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.Run), NOW),
    ).rejects.toBe('storage offline')
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'queue.workspace_export.failed',
      expect.objectContaining({ message: 'storage offline' }),
    )
  })
})

describe('workspace-export processor — prune', () => {
  beforeEach(() => {
    mocks.repo.listExpired.mockResolvedValue(
      ok([
        { id: 'ex1', storageKey: 'ws1/ex1.zip' },
        { id: 'ex2', storageKey: null },
      ]),
    )
    mocks.repo.markExpired.mockResolvedValue(ok(2))
    mocks.repo.liveStorageKeys.mockResolvedValue(ok(new Set(['ws1/ex3.zip'])))
    mocks.s3.listObjectKeys.mockResolvedValue(['ws1/ex3.zip', 'gone/ex9.zip'])
  })

  it('deletes expired files and orphans, then marks the rows', async () => {
    const result = await handleWorkspaceExportJob(
      job(WorkspaceExportJob.PruneExpired, {}),
      NOW,
    )
    expect(result).toEqual({ expired: 2, orphans: 1 })
    expect(mocks.repo.listExpired).toHaveBeenCalledWith(NOW)
    expect(mocks.s3.deleteObjects).toHaveBeenNthCalledWith(
      1,
      'workspace-exports',
      ['ws1/ex1.zip'],
    )
    expect(mocks.repo.markExpired).toHaveBeenCalledWith(['ex1', 'ex2'])
    expect(mocks.s3.deleteObjects).toHaveBeenNthCalledWith(
      2,
      'workspace-exports',
      ['gone/ex9.zip'],
    )
  })

  it('does nothing in storage when nothing expired or is orphaned', async () => {
    mocks.repo.listExpired.mockResolvedValue(ok([]))
    mocks.repo.markExpired.mockResolvedValue(ok(0))
    mocks.s3.listObjectKeys.mockResolvedValue(['ws1/ex3.zip'])
    await expect(
      processWorkspaceExport(job('prune-expired', {})),
    ).resolves.toEqual({ expired: 0, orphans: 0 })
    expect(mocks.s3.deleteObjects).not.toHaveBeenCalled()
  })

  it('throws on repository failures so BullMQ retries', async () => {
    mocks.repo.listExpired.mockResolvedValueOnce(fail('list failed'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.PruneExpired, {}), NOW),
    ).rejects.toThrow('list failed')

    mocks.repo.markExpired.mockResolvedValueOnce(fail('mark failed'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.PruneExpired, {}), NOW),
    ).rejects.toThrow('mark failed')

    mocks.repo.liveStorageKeys.mockResolvedValueOnce(fail('keys failed'))
    await expect(
      handleWorkspaceExportJob(job(WorkspaceExportJob.PruneExpired, {}), NOW),
    ).rejects.toThrow('keys failed')
  })
})

describe('workspace-export processor — misc', () => {
  it('rejects unknown job names', async () => {
    await expect(processWorkspaceExport(job('nope'))).rejects.toThrow(
      'Unknown workspace-export job: nope (id=j1)',
    )
    const anonymous = { name: 'nope', data: {} } as unknown as Job
    await expect(processWorkspaceExport(anonymous)).rejects.toThrow(
      '(id=unknown)',
    )
  })

  it('formats file sizes', () => {
    expect(formatFileSize(512)).toBe('512 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatFileSize(3 * 1024 ** 3)).toBe('3.0 GB')
    expect(formatFileSize(5 * 1024 ** 4)).toBe('5120.0 GB')
  })
})
