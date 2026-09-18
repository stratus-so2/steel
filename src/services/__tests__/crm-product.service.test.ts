import type { Role } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProduct } from '@/src/__tests__/factories/crm-product.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-product.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { CrmProductRepository } from '@/src/repositories/crm-product.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmProductService } from '../crm-product.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProductRepo = vi.mocked(CrmProductRepository)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

const createDto = {
  name: 'Plano Pro',
  unitPrice: 0,
  currency: 'BRL',
  billingType: 'ONE_TIME' as const,
  active: true,
}

describe('CrmProductService', () => {
  describe('permission matrix (products)', () => {
    it.each([
      ['VIEWER', 'create'],
      ['VIEWER', 'update'],
      ['VIEWER', 'remove'],
      ['VIEWER', 'reorder'],
      ['MEMBER', 'remove'],
    ] as const)('should forbid a %s from calling %s()', async (role, action) => {
      asRole(role)

      const result =
        action === 'create'
          ? await CrmProductService.create('u1', 'ws1', createDto)
          : action === 'update'
            ? await CrmProductService.update('u1', 'ws1', 'pr1', { name: 'X' })
            : action === 'remove'
              ? await CrmProductService.remove('u1', 'ws1', 'pr1')
              : await CrmProductService.reorder('u1', 'ws1', ['pr1'])

      expectErr(result, 'FORBIDDEN')
      expect(mockedProductRepo.findById).not.toHaveBeenCalled()
      expect(mockedProductRepo.create).not.toHaveBeenCalled()
      expect(mockedProductRepo.reorder).not.toHaveBeenCalled()
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      asRole('OWNER')
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))

      expectErr(
        await CrmProductService.create('u1', 'ws1', createDto),
        'MODULE_DISABLED',
      )
      expect(mockedProductRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('list()', () => {
    it('should return products filtered by active flag', async () => {
      asRole('VIEWER')
      mockedProductRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmProduct({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(
        await CrmProductService.list('u1', 'ws1', { active: true }),
      )
      expect(dtos).toHaveLength(1)
      expect(mockedProductRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
        active: true,
      })
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(
        await CrmProductService.list('u1', 'ws1', { active: undefined }),
        'FORBIDDEN',
      )
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedProductRepo.listByWorkspace.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmProductService.list('u1', 'ws1', { active: undefined }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('getById()', () => {
    it('should return the product', async () => {
      asRole('VIEWER')
      mockedProductRepo.findById.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1', name: 'Plano Pro' })),
      )

      const dto = expectOk(await CrmProductService.getById('u1', 'ws1', 'pr1'))
      expect(dto.name).toBe('Plano Pro')
      expect(mockedProductRepo.findById).toHaveBeenCalledWith('pr1', 'ws1')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      expectErr(
        await CrmProductService.getById('u1', 'ws1', 'pr1'),
        'FORBIDDEN',
      )
    })

    it('should propagate RESOURCE_NOT_FOUND', async () => {
      asRole('MEMBER')
      mockedProductRepo.findById.mockResolvedValue(err(notFound('Product')))

      expectErr(
        await CrmProductService.getById('u1', 'ws1', 'pr1'),
        'RESOURCE_NOT_FOUND',
      )
    })
  })

  describe('create()', () => {
    it('should create a product and audit it', async () => {
      asRole('MEMBER')
      mockedProductRepo.create.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1', name: 'Plano Pro' })),
      )

      const dto = expectOk(
        await CrmProductService.create('u1', 'ws1', {
          ...createDto,
          sku: 'PRO-1',
        }),
      )

      expect(dto.name).toBe('Plano Pro')
      expect(mockedProductRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workspaceId: 'ws1',
          createdById: 'u1',
          sku: 'PRO-1',
        }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 'pr1' }),
      )
    })

    it('should audit and propagate repository errors', async () => {
      asRole('MEMBER')
      mockedProductRepo.create.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmProductService.create('u1', 'ws1', createDto),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('update()', () => {
    it('should update the product', async () => {
      asRole('MEMBER')
      mockedProductRepo.findById.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1' })),
      )
      mockedProductRepo.update.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1', name: 'Plano Max' })),
      )

      const dto = expectOk(
        await CrmProductService.update('u1', 'ws1', 'pr1', {
          name: 'Plano Max',
          sku: null,
        }),
      )

      expect(dto.name).toBe('Plano Max')
      expect(mockedProductRepo.update).toHaveBeenCalledWith(
        'pr1',
        expect.objectContaining({
          name: 'Plano Max',
          sku: null,
          updatedById: 'u1',
        }),
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          meta: { fields: ['name', 'sku'] },
        }),
      )
    })

    it('should return RESOURCE_NOT_FOUND when the product does not exist', async () => {
      asRole('MEMBER')
      mockedProductRepo.findById.mockResolvedValue(err(notFound('Product')))

      expectErr(
        await CrmProductService.update('u1', 'ws1', 'pr1', { name: 'X' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedProductRepo.update).not.toHaveBeenCalled()
    })

    it('should audit and propagate repository errors', async () => {
      asRole('MEMBER')
      mockedProductRepo.findById.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1' })),
      )
      mockedProductRepo.update.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmProductService.update('u1', 'ws1', 'pr1', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          outcome: 'failure',
          targetId: 'pr1',
        }),
      )
    })
  })

  describe('remove()', () => {
    it('should soft delete an existing product for an admin', async () => {
      asRole('ADMIN')
      mockedProductRepo.findById.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1' })),
      )
      mockedProductRepo.softDelete.mockResolvedValue(ok(undefined))

      expectOk(await CrmProductService.remove('u1', 'ws1', 'pr1'))
      expect(mockedProductRepo.softDelete).toHaveBeenCalledWith('pr1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 'pr1' }),
      )
    })

    it('should return RESOURCE_NOT_FOUND when the product does not exist', async () => {
      asRole('ADMIN')
      mockedProductRepo.findById.mockResolvedValue(err(notFound('Product')))

      expectErr(
        await CrmProductService.remove('u1', 'ws1', 'pr1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedProductRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should propagate soft delete errors without auditing', async () => {
      asRole('OWNER')
      mockedProductRepo.findById.mockResolvedValue(
        ok(createFakeCrmProduct({ id: 'pr1' })),
      )
      mockedProductRepo.softDelete.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmProductService.remove('u1', 'ws1', 'pr1'),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('reorder()', () => {
    it('should delegate to the repository for a member', async () => {
      asRole('MEMBER')
      mockedProductRepo.reorder.mockResolvedValue(ok(undefined))

      expectOk(await CrmProductService.reorder('u1', 'ws1', ['pr2', 'pr1']))
      expect(mockedProductRepo.reorder).toHaveBeenCalledWith('ws1', [
        'pr2',
        'pr1',
      ])
    })
  })
})
