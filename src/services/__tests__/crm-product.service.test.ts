import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProduct } from '@/src/__tests__/factories/crm-product.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-product.repository')

import { CrmProductRepository } from '@/src/repositories/crm-product.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmProductService } from '../crm-product.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProductRepo = vi.mocked(CrmProductRepository)

describe('CrmProductService', () => {
  describe('list()', () => {
    it('should return products for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedProductRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmProduct({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(
        await CrmProductService.list('u1', 'ws1', { active: undefined }),
      )
      expect(dtos).toHaveLength(1)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(
        await CrmProductService.list('u1', 'ws1', { active: undefined }),
        'FORBIDDEN',
      )
    })
  })

  describe('create()', () => {
    it('should propagate repository errors', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedProductRepo.create.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmProductService.create('u1', 'ws1', {
          name: 'Plano Pro',
          unitPrice: 0,
          currency: 'BRL',
          billingType: 'ONE_TIME',
          active: true,
        }),
        'DATABASE_ERROR',
      )
    })
  })
})
