import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmHookVaultItem } from '@/src/__tests__/factories/crm-hook-vault.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-hook-vault.repository')

import { CrmHookVaultRepository } from '@/src/repositories/crm-hook-vault.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
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

const dbError = () => err(databaseError('boom'))

function asRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmHookVaultService — full lifecycle', () => {
  beforeEach(() => {
    asRole('MEMBER')
    mockedHookVaultRepo.findById.mockResolvedValue(
      ok(createFakeCrmHookVaultItem({ id: 'h1', workspaceId: 'ws1' })),
    )
  })

  it('list() propagates repository errors', async () => {
    mockedHookVaultRepo.listByWorkspace.mockResolvedValue(dbError())
    expectErr(await CrmHookVaultService.list('u1', 'ws1'), 'DATABASE_ERROR')
  })

  it('list() returns MODULE_DISABLED when CRM is off', async () => {
    vi.mocked(WorkspaceModuleAccessRepository.isEnabled).mockResolvedValueOnce(
      ok(false),
    )
    expectErr(await CrmHookVaultService.list('u1', 'ws1'), 'MODULE_DISABLED')
  })

  describe('create()', () => {
    it('passes every field to the repository', async () => {
      mockedHookVaultRepo.create.mockResolvedValue(
        ok(createFakeCrmHookVaultItem({ id: 'h2' })),
      )
      expectOk(
        await CrmHookVaultService.create('u1', 'ws1', {
          text: 'Hook',
          platform: 'INSTAGRAM',
          usageCount: 3,
          notes: 'viral',
        }),
      )
      expect(mockedHookVaultRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        createdById: 'u1',
        text: 'Hook',
        platform: 'INSTAGRAM',
        usageCount: 3,
        notes: 'viral',
      })
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmHookVaultService.create('u1', 'ws1', { text: 'x' }),
        'FORBIDDEN',
      )
      expect(mockedHookVaultRepo.create).not.toHaveBeenCalled()
    })

    it('propagates repository failures', async () => {
      mockedHookVaultRepo.create.mockResolvedValue(dbError())
      expectErr(
        await CrmHookVaultService.create('u1', 'ws1', { text: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('update()', () => {
    it('updates the item stamping the editor', async () => {
      mockedHookVaultRepo.update.mockResolvedValue(
        ok(createFakeCrmHookVaultItem({ id: 'h1', text: 'Editado' })),
      )
      const dto = expectOk(
        await CrmHookVaultService.update('u1', 'ws1', 'h1', {
          text: 'Editado',
        }),
      )
      expect(dto.text).toBe('Editado')
      expect(mockedHookVaultRepo.update).toHaveBeenCalledWith(
        'h1',
        expect.objectContaining({ text: 'Editado', updatedById: 'u1' }),
      )
    })

    it('returns FORBIDDEN for a VIEWER', async () => {
      asRole('VIEWER')
      expectErr(
        await CrmHookVaultService.update('u1', 'ws1', 'h1', {}),
        'FORBIDDEN',
      )
    })

    it('returns not found for an item of another workspace', async () => {
      mockedHookVaultRepo.findById.mockResolvedValue(err(notFound('Hook')))
      expectErr(
        await CrmHookVaultService.update('u1', 'ws1', 'h1', {}),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedHookVaultRepo.update).not.toHaveBeenCalled()
    })

    it('propagates update failures', async () => {
      mockedHookVaultRepo.update.mockResolvedValue(dbError())
      expectErr(
        await CrmHookVaultService.update('u1', 'ws1', 'h1', {}),
        'DATABASE_ERROR',
      )
    })
  })

  describe('remove()', () => {
    it('soft-deletes the item for an admin', async () => {
      asRole('ADMIN')
      mockedHookVaultRepo.softDelete.mockResolvedValue(ok(undefined))
      expectOk(await CrmHookVaultService.remove('u1', 'ws1', 'h1'))
      expect(mockedHookVaultRepo.softDelete).toHaveBeenCalledWith('h1', 'u1')
    })

    it('returns FORBIDDEN for a MEMBER without delete permission', async () => {
      expectErr(
        await CrmHookVaultService.remove('u1', 'ws1', 'h1'),
        'FORBIDDEN',
      )
      expect(mockedHookVaultRepo.softDelete).not.toHaveBeenCalled()
    })

    it('returns not found for an unknown item', async () => {
      asRole('ADMIN')
      mockedHookVaultRepo.findById.mockResolvedValue(err(notFound('Hook')))
      expectErr(
        await CrmHookVaultService.remove('u1', 'ws1', 'h1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('propagates delete failures', async () => {
      asRole('ADMIN')
      mockedHookVaultRepo.softDelete.mockResolvedValue(dbError())
      expectErr(
        await CrmHookVaultService.remove('u1', 'ws1', 'h1'),
        'DATABASE_ERROR',
      )
    })
  })

  it('reorder() delegates the order to the repository', async () => {
    mockedHookVaultRepo.reorder.mockResolvedValue(ok(undefined))
    expectOk(await CrmHookVaultService.reorder('u1', 'ws1', ['b', 'a']))
    expect(mockedHookVaultRepo.reorder).toHaveBeenCalledWith('ws1', ['b', 'a'])
  })
})
