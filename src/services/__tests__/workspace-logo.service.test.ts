import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/cache/workspace.cache')
vi.mock('@/src/cache/user.cache')
vi.mock('@/src/lib/storage/s3')
vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import type { Role } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { UserCache } from '@/src/cache/user.cache'
import { WorkspaceCache } from '@/src/cache/workspace.cache'
import {
  deleteObject,
  ensurePublicBucket,
  putObject,
} from '@/src/lib/storage/s3'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import {
  logoKeyFromUrl,
  WORKSPACE_LOGO_BUCKET,
  WorkspaceLogoService,
} from '../media/workspace-logo.service'

const membershipRepo = vi.mocked(MembershipRepository)
const workspaceRepo = vi.mocked(WorkspaceRepository)
const s3Put = vi.mocked(putObject)
const s3Delete = vi.mocked(deleteObject)
const s3Bucket = vi.mocked(ensurePublicBucket)
const audit = vi.mocked(auditMutation)

const OLD_URL = `http://localhost:9002/${WORKSPACE_LOGO_BUCKET}/ws1/old.png`

function asRole(role: Role) {
  membershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ userId: 'u1', workspaceId: 'ws1', role })),
  )
}

const baseInput = {
  actorId: 'u1',
  workspaceId: 'ws1',
  contentType: 'image/png',
  byteSize: 1024,
  readBody: async () => Buffer.from('fake-image-bytes'),
}

beforeEach(() => {
  vi.clearAllMocks()
  s3Bucket.mockResolvedValue()
  s3Put.mockResolvedValue()
  s3Delete.mockResolvedValue()
  asRole('ADMIN')
  workspaceRepo.findById.mockResolvedValue(
    ok(createFakeWorkspace({ id: 'ws1', logoUrl: null })),
  )
  workspaceRepo.update.mockImplementation(async (id, data) =>
    ok(createFakeWorkspace({ id, logoUrl: data.logoUrl ?? null })),
  )
  membershipRepo.listUserByWorkspace.mockResolvedValue(ok(['u1', 'u2']))
})

describe('logoKeyFromUrl()', () => {
  it('extracts the key of a logo URL', () => {
    expect(logoKeyFromUrl(OLD_URL)).toBe('ws1/old.png')
  })

  it('returns null for empty, foreign or bucket-only URLs', () => {
    expect(logoKeyFromUrl(null)).toBeNull()
    expect(logoKeyFromUrl('https://cdn.example.com/x.png')).toBeNull()
    expect(
      logoKeyFromUrl(`http://localhost:9002/${WORKSPACE_LOGO_BUCKET}/`),
    ).toBeNull()
  })
})

describe('WorkspaceLogoService.upload()', () => {
  it('stores the logo under the workspace prefix and saves the URL', async () => {
    const dto = expectOk(await WorkspaceLogoService.upload(baseInput))

    expect(dto.logoUrl).toMatch(
      new RegExp(`/${WORKSPACE_LOGO_BUCKET}/ws1/[\\w-]+\\.png$`),
    )
    expect(s3Bucket).toHaveBeenCalledWith(WORKSPACE_LOGO_BUCKET)
    expect(workspaceRepo.update).toHaveBeenCalledWith('ws1', {
      logoUrl: dto.logoUrl,
    })
    // Nothing to replace: no delete.
    expect(s3Delete).not.toHaveBeenCalled()
    expect(WorkspaceCache.invalidate).toHaveBeenCalledWith('ws1')
    expect(UserCache.invalidate).toHaveBeenCalledWith('u2')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'workspace',
        action: 'update',
        meta: expect.objectContaining({ fields: ['logoUrl'], replaced: false }),
      }),
    )
  })

  it('deletes the previous logo object when replacing it', async () => {
    asRole('OWNER')
    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', logoUrl: OLD_URL })),
    )

    expectOk(await WorkspaceLogoService.upload(baseInput))

    expect(s3Delete).toHaveBeenCalledWith({
      bucket: WORKSPACE_LOGO_BUCKET,
      key: 'ws1/old.png',
    })
  })

  it('only logs when the old object cannot be deleted', async () => {
    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', logoUrl: OLD_URL })),
    )
    s3Delete.mockRejectedValueOnce(new Error('minio down'))

    expectOk(await WorkspaceLogoService.upload(baseInput))
    expect(logger.warn).toHaveBeenCalledWith(
      'workspace_logo.delete_failed',
      expect.objectContaining({ message: 'minio down' }),
    )
  })

  it('logs non-Error delete failures too', async () => {
    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', logoUrl: OLD_URL })),
    )
    s3Delete.mockRejectedValueOnce('boom')

    expectOk(await WorkspaceLogoService.upload(baseInput))
    expect(logger.warn).toHaveBeenCalledWith(
      'workspace_logo.delete_failed',
      expect.objectContaining({ message: 'boom' }),
    )
  })

  it.each(['MEMBER', 'VIEWER'] as Role[])(
    'forbids a %s before touching storage',
    async (role) => {
      asRole(role)
      const readBody = vi.fn(baseInput.readBody)

      expectErr(
        await WorkspaceLogoService.upload({ ...baseInput, readBody }),
        'FORBIDDEN',
      )
      expect(readBody).not.toHaveBeenCalled()
      expect(s3Put).not.toHaveBeenCalled()
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'insufficient_role',
        }),
      )
    },
  )

  it('forbids a non-member', async () => {
    membershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
    expectErr(await WorkspaceLogoService.upload(baseInput), 'FORBIDDEN')
  })

  it('rejects unsupported types (SVG included)', async () => {
    const error = expectErr(
      await WorkspaceLogoService.upload({
        ...baseInput,
        contentType: 'image/svg+xml',
      }),
      'VALIDATION_ERROR',
    )
    expect(error.message).toContain('Formato')
  })

  it('rejects files over 2 MB', async () => {
    const error = expectErr(
      await WorkspaceLogoService.upload({
        ...baseInput,
        byteSize: 2 * 1024 * 1024 + 1,
      }),
      'VALIDATION_ERROR',
    )
    expect(error.message).toBe('Arquivo muito grande. Máximo 2 MB')
    expect(s3Put).not.toHaveBeenCalled()
  })

  it('propagates a failed workspace lookup', async () => {
    workspaceRepo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await WorkspaceLogoService.upload(baseInput), 'DATABASE_ERROR')
    expect(s3Put).not.toHaveBeenCalled()
  })

  it('returns STORAGE_ERROR when the upload fails', async () => {
    s3Put.mockRejectedValueOnce(new Error('minio down'))
    expectErr(await WorkspaceLogoService.upload(baseInput), 'STORAGE_ERROR')
    expect(workspaceRepo.update).not.toHaveBeenCalled()
  })

  it('removes the new object and audits when saving the URL fails', async () => {
    workspaceRepo.update.mockResolvedValueOnce(err(databaseError()))

    expectErr(await WorkspaceLogoService.upload(baseInput), 'DATABASE_ERROR')
    expect(s3Delete).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: WORKSPACE_LOGO_BUCKET }),
    )
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure', reason: 'DATABASE_ERROR' }),
    )
    expect(WorkspaceCache.invalidate).not.toHaveBeenCalled()
  })
})

describe('WorkspaceLogoService.remove()', () => {
  it('clears the URL, deletes the object and audits', async () => {
    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', logoUrl: OLD_URL })),
    )

    const dto = expectOk(await WorkspaceLogoService.remove('u1', 'ws1'))

    expect(dto.logoUrl).toBeNull()
    expect(workspaceRepo.update).toHaveBeenCalledWith('ws1', { logoUrl: null })
    expect(s3Delete).toHaveBeenCalledWith({
      bucket: WORKSPACE_LOGO_BUCKET,
      key: 'ws1/old.png',
    })
    expect(WorkspaceCache.invalidate).toHaveBeenCalledWith('ws1')
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: { fields: ['logoUrl'], removed: true },
      }),
    )
  })

  it('is a no-op when there is no logo', async () => {
    const dto = expectOk(await WorkspaceLogoService.remove('u1', 'ws1'))
    expect(dto.logoUrl).toBeNull()
    expect(workspaceRepo.update).not.toHaveBeenCalled()
    expect(s3Delete).not.toHaveBeenCalled()
  })

  it('forbids a MEMBER', async () => {
    asRole('MEMBER')
    expectErr(await WorkspaceLogoService.remove('u1', 'ws1'), 'FORBIDDEN')
    expect(workspaceRepo.update).not.toHaveBeenCalled()
  })

  it('propagates a failed workspace lookup', async () => {
    workspaceRepo.findById.mockResolvedValue(err(databaseError()))
    expectErr(await WorkspaceLogoService.remove('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('keeps the object and audits when clearing the URL fails', async () => {
    workspaceRepo.findById.mockResolvedValue(
      ok(createFakeWorkspace({ id: 'ws1', logoUrl: OLD_URL })),
    )
    workspaceRepo.update.mockResolvedValueOnce(err(databaseError()))

    expectErr(await WorkspaceLogoService.remove('u1', 'ws1'), 'DATABASE_ERROR')
    expect(s3Delete).not.toHaveBeenCalled()
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: 'failure' }),
    )
  })
})
