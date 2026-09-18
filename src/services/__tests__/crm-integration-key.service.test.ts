import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmIntegrationKey } from '@/src/__tests__/factories/crm-integration-key.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-integration-key.repository')

import { CrmIntegrationKeyRepository } from '@/src/repositories/crm-integration-key.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmIntegrationKeyService } from '../crm-integration-key.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedKeyRepo = vi.mocked(CrmIntegrationKeyRepository)

describe('CrmIntegrationKeyService', () => {
  describe('create()', () => {
    it('should return FORBIDDEN for a plain member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      expectErr(
        await CrmIntegrationKeyService.create('u1', 'ws1', { name: 'Zap' }),
        'FORBIDDEN',
      )
    })

    it('should return the plaintext key once for a privileged member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedKeyRepo.create.mockResolvedValue(
        ok(createFakeCrmIntegrationKey({ id: 'k1' })),
      )

      const dto = expectOk(
        await CrmIntegrationKeyService.create('u1', 'ws1', { name: 'Zap' }),
      )
      expect(dto.plaintextKey).toMatch(/^crm_live_/)
    })
  })

  describe('verify()', () => {
    it('should return CRM_INTEGRATION_KEY_INVALID for an unknown key', async () => {
      mockedKeyRepo.findActiveByHash.mockResolvedValue(ok(null))

      expectErr(
        await CrmIntegrationKeyService.verify('bad-key'),
        'CRM_INTEGRATION_KEY_INVALID',
      )
    })

    it('should return workspace context for a valid key', async () => {
      mockedKeyRepo.findActiveByHash.mockResolvedValue(
        ok(
          createFakeCrmIntegrationKey({
            id: 'k1',
            workspaceId: 'ws1',
            createdById: 'owner1',
          }),
        ),
      )
      mockedKeyRepo.markUsed.mockResolvedValue(ok(undefined))

      const context = expectOk(
        await CrmIntegrationKeyService.verify('crm_live_x'),
      )
      expect(context.workspaceId).toBe('ws1')
    })
  })
})

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmIntegrationKeyService — admin operations', () => {
  beforeEach(() => {
    asRole('OWNER')
    mockedKeyRepo.findById.mockResolvedValue(
      ok(createFakeCrmIntegrationKey({ id: 'k1', workspaceId: 'ws1' })),
    )
  })

  describe('list()', () => {
    it('lists keys without exposing the hash', async () => {
      mockedKeyRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmIntegrationKey({ id: 'k1', name: 'Zap' })]),
      )
      const dtos = expectOk(await CrmIntegrationKeyService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
      expect(dtos[0].name).toBe('Zap')
      expect(dtos[0]).not.toHaveProperty('keyHash')
    })

    it('returns FORBIDDEN for a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(await CrmIntegrationKeyService.list('u1', 'ws1'), 'FORBIDDEN')
      expect(mockedKeyRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('propagates repository errors', async () => {
      mockedKeyRepo.listByWorkspace.mockResolvedValue(dbError())
      expectErr(
        await CrmIntegrationKeyService.list('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create()', () => {
    it('stores only the sha256 hash and the visible prefix', async () => {
      mockedKeyRepo.create.mockResolvedValue(
        ok(createFakeCrmIntegrationKey({ id: 'k2' })),
      )
      const dto = expectOk(
        await CrmIntegrationKeyService.create('u1', 'ws1', { name: 'Zap' }),
      )

      const input = mockedKeyRepo.create.mock.calls[0][0]
      expect(input.keyHash).toBe(
        createHash('sha256').update(dto.plaintextKey).digest('hex'),
      )
      expect(input.prefix).toBe(dto.plaintextKey.slice(0, 14))
      expect(input).toMatchObject({
        workspaceId: 'ws1',
        createdById: 'u1',
        name: 'Zap',
      })
    })

    it('generates a different key on every call', async () => {
      mockedKeyRepo.create.mockResolvedValue(
        ok(createFakeCrmIntegrationKey({ id: 'k2' })),
      )
      const a = expectOk(
        await CrmIntegrationKeyService.create('u1', 'ws1', { name: 'A' }),
      )
      const b = expectOk(
        await CrmIntegrationKeyService.create('u1', 'ws1', { name: 'B' }),
      )
      expect(a.plaintextKey).not.toBe(b.plaintextKey)
    })

    it('propagates repository failures', async () => {
      mockedKeyRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmIntegrationKeyService.create('u1', 'ws1', { name: 'Zap' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('revoke()', () => {
    it('revokes a key of the workspace', async () => {
      mockedKeyRepo.revoke.mockResolvedValue(ok(undefined))
      expectOk(await CrmIntegrationKeyService.revoke('u1', 'ws1', 'k1'))
      expect(mockedKeyRepo.findById).toHaveBeenCalledWith('k1', 'ws1')
      expect(mockedKeyRepo.revoke).toHaveBeenCalledWith('k1')
    })

    it('returns FORBIDDEN for a MEMBER', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmIntegrationKeyService.revoke('u1', 'ws1', 'k1'),
        'FORBIDDEN',
      )
      expect(mockedKeyRepo.revoke).not.toHaveBeenCalled()
    })

    it('returns not found for a key of another workspace', async () => {
      mockedKeyRepo.findById.mockResolvedValue(err(notFound('Key')))
      expectErr(
        await CrmIntegrationKeyService.revoke('u1', 'ws1', 'k1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedKeyRepo.revoke).not.toHaveBeenCalled()
    })

    it('propagates revoke failures', async () => {
      mockedKeyRepo.revoke.mockResolvedValue(dbError())
      expectErr(
        await CrmIntegrationKeyService.revoke('u1', 'ws1', 'k1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('verify()', () => {
    it('looks the key up by its sha256 hash', async () => {
      mockedKeyRepo.findActiveByHash.mockResolvedValue(ok(null))
      await CrmIntegrationKeyService.verify('crm_live_abc')
      expect(mockedKeyRepo.findActiveByHash).toHaveBeenCalledWith(
        createHash('sha256').update('crm_live_abc').digest('hex'),
      )
    })

    it('propagates lookup failures', async () => {
      mockedKeyRepo.findActiveByHash.mockResolvedValue(dbError())
      expectErr(
        await CrmIntegrationKeyService.verify('crm_live_x'),
        'DATABASE_ERROR',
      )
    })

    it('rejects a valid key when the CRM module is disabled', async () => {
      mockedKeyRepo.findActiveByHash.mockResolvedValue(
        ok(createFakeCrmIntegrationKey({ id: 'k1', workspaceId: 'ws1' })),
      )
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))

      expectErr(
        await CrmIntegrationKeyService.verify('crm_live_x'),
        'MODULE_DISABLED',
      )
      expect(mockedKeyRepo.markUsed).not.toHaveBeenCalled()
    })

    it('marks the key as used and returns its context', async () => {
      mockedKeyRepo.findActiveByHash.mockResolvedValue(
        ok(
          createFakeCrmIntegrationKey({
            id: 'k1',
            workspaceId: 'ws1',
            createdById: 'owner1',
          }),
        ),
      )
      mockedKeyRepo.markUsed.mockResolvedValue(ok(undefined))

      expect(
        expectOk(await CrmIntegrationKeyService.verify('crm_live_x')),
      ).toEqual({ workspaceId: 'ws1', createdById: 'owner1', keyId: 'k1' })
      expect(mockedKeyRepo.markUsed).toHaveBeenCalledWith('k1')
    })
  })
})
