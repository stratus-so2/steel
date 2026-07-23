import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmIntegrationKey } from '@/src/__tests__/factories/crm-integration-key.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-integration-key.repository')

import { CrmIntegrationKeyRepository } from '@/src/repositories/crm-integration-key.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
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
