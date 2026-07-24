import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmHookVaultItem } from '@/src/__tests__/factories/crm-hook-vault.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-hook-vault.repository')

import { CrmHookVaultRepository } from '@/src/repositories/crm-hook-vault.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmHookVaultService } from '../crm-hook-vault.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedHookVaultRepo = vi.mocked(CrmHookVaultRepository)

describe('CrmHookVaultService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmHookVaultService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return items for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedHookVaultRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmHookVaultItem({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmHookVaultService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })

  describe('create()', () => {
    it('should create an item', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedHookVaultRepo.create.mockResolvedValue(
        ok(createFakeCrmHookVaultItem({ id: 'h1' })),
      )

      const dto = expectOk(
        await CrmHookVaultService.create('u1', 'ws1', { text: 'Novo hook' }),
      )
      expect(dto.id).toBe('h1')
    })
  })

  describe('remove()', () => {
    it('should return NOT_FOUND when the item does not exist', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedHookVaultRepo.findById.mockResolvedValue(
        err({ code: 'RESOURCE_NOT_FOUND', message: 'not found' }),
      )

      const result = await CrmHookVaultService.remove('u1', 'ws1', 'h1')
      expect(result.ok).toBe(false)
    })
  })

  describe('reorder()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmHookVaultService.reorder('u1', 'ws1', ['h1']),
        'FORBIDDEN',
      )
    })
  })
})
