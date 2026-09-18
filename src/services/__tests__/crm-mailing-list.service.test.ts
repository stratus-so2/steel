import type { Role } from '@prisma/client'
import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmMailingList,
  createFakeCrmMailingListMember,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-mailing-list.repository')

import { auditMutation } from '@/lib/axiom/audit'
import {
  CrmMailingListMemberRepository,
  CrmMailingListRepository,
} from '@/src/repositories/crm-mailing-list.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmMailingListService } from '../crm-mailing-list.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedListRepo = vi.mocked(CrmMailingListRepository)
const mockedMemberRepo = vi.mocked(CrmMailingListMemberRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)
const mockedAudit = vi.mocked(auditMutation)

function asRole(role: Role) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

const list = createFakeCrmMailingList({ id: 'l1', workspaceId: 'ws1' })
const member = createFakeCrmMailingListMember({
  id: 'm1',
  mailingListId: 'l1',
  email: 'jane@acme.com',
})

describe('CrmMailingListService', () => {
  describe('authorization', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmMailingListService.list('u1', 'ws1'), 'FORBIDDEN')
      expect(mockedListRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      asRole('OWNER')
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))
      expectErr(
        await CrmMailingListService.list('u1', 'ws1'),
        'MODULE_DISABLED',
      )
    })

    it('should block every action on a suspended workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({ role: 'OWNER', workspaceStatus: 'SUSPENDED' }),
        ),
      )
      expectErr(
        await CrmMailingListService.create('u1', 'ws1', { name: 'X' }),
        'WORKSPACE_SUSPENDED',
      )
    })

    it('should forbid a MEMBER from deleting a list', async () => {
      asRole('MEMBER')
      expectErr(
        await CrmMailingListService.remove('u1', 'ws1', 'l1'),
        'FORBIDDEN',
      )
      expect(mockedListRepo.softDelete).not.toHaveBeenCalled()
    })

    it.each([
      [
        'create',
        () => CrmMailingListService.create('u1', 'ws1', { name: 'X' }),
      ],
      [
        'update',
        () => CrmMailingListService.update('u1', 'ws1', 'l1', { name: 'X' }),
      ],
      ['remove', () => CrmMailingListService.remove('u1', 'ws1', 'l1')],
      [
        'addMember',
        () =>
          CrmMailingListService.addMember('u1', 'ws1', 'l1', {
            email: 'a@acme.com',
          }),
      ],
      [
        'removeMember',
        () => CrmMailingListService.removeMember('u1', 'ws1', 'l1', 'm1'),
      ],
    ])('should forbid a VIEWER from %s', async (_name, call) => {
      asRole('VIEWER')
      expectErr(await call(), 'FORBIDDEN')
      expect(mockedListRepo.findById).not.toHaveBeenCalled()
      expect(mockedListRepo.create).not.toHaveBeenCalled()
    })

    it.each([
      [
        'listMembers',
        () => CrmMailingListService.listMembers('u1', 'ws1', 'l1'),
      ],
    ])('should return FORBIDDEN on %s for a non-member', async (_n, call) => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await call(), 'FORBIDDEN')
    })
  })

  describe('list()', () => {
    it('should list the workspace lists for a VIEWER', async () => {
      asRole('VIEWER')
      mockedListRepo.listByWorkspace.mockResolvedValue(
        ok([{ ...list, _count: { members: 0 } }]),
      )

      const dtos = expectOk(await CrmMailingListService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
      expect(dtos[0].id).toBe('l1')
      expect(mockedListRepo.listByWorkspace).toHaveBeenCalledWith('ws1')
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedListRepo.listByWorkspace.mockResolvedValue(err(databaseError()))
      expectErr(await CrmMailingListService.list('u1', 'ws1'), 'DATABASE_ERROR')
    })
  })

  describe('create()', () => {
    it('should create the list owned by the actor and audit it', async () => {
      asRole('MEMBER')
      mockedListRepo.create.mockResolvedValue(ok(list))

      const dto = expectOk(
        await CrmMailingListService.create('u1', 'ws1', {
          name: 'Newsletter',
          description: 'Mensal',
        }),
      )
      expect(dto.id).toBe('l1')
      expect(mockedListRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        createdById: 'u1',
        name: 'Newsletter',
        description: 'Mensal',
      })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'create', targetId: 'l1' }),
      )
    })

    it('should audit a failure and propagate the repository error', async () => {
      asRole('MEMBER')
      mockedListRepo.create.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmMailingListService.create('u1', 'ws1', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('update()', () => {
    it('should update an existing list', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedListRepo.update.mockResolvedValue(ok({ ...list, name: 'Novo' }))

      const dto = expectOk(
        await CrmMailingListService.update('u1', 'ws1', 'l1', { name: 'Novo' }),
      )
      expect(dto.name).toBe('Novo')
      expect(mockedListRepo.findById).toHaveBeenCalledWith('l1', 'ws1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { fields: ['name'] } }),
      )
    })

    it('should return not found for a list outside the workspace', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(err(notFound('CrmMailingList')))

      expectErr(
        await CrmMailingListService.update('u1', 'ws1', 'l1', { name: 'X' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedListRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate update errors', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedListRepo.update.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmMailingListService.update('u1', 'ws1', 'l1', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('remove()', () => {
    it('should soft-delete the list for an ADMIN', async () => {
      asRole('ADMIN')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedListRepo.softDelete.mockResolvedValue(ok(undefined as never))

      expectOk(await CrmMailingListService.remove('u1', 'ws1', 'l1'))
      expect(mockedListRepo.softDelete).toHaveBeenCalledWith('l1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 'l1' }),
      )
    })

    it('should return not found for a missing list', async () => {
      asRole('OWNER')
      mockedListRepo.findById.mockResolvedValue(err(notFound('CrmMailingList')))
      expectErr(
        await CrmMailingListService.remove('u1', 'ws1', 'l1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedListRepo.softDelete).not.toHaveBeenCalled()
    })

    it('should propagate soft-delete errors', async () => {
      asRole('OWNER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedListRepo.softDelete.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmMailingListService.remove('u1', 'ws1', 'l1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listMembers()', () => {
    it('should list members of a list in the workspace', async () => {
      asRole('VIEWER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedMemberRepo.listByList.mockResolvedValue(ok([member]))

      const dtos = expectOk(
        await CrmMailingListService.listMembers('u1', 'ws1', 'l1'),
      )
      expect(dtos.map((d) => d.email)).toEqual(['jane@acme.com'])
    })

    it('should not leak members of a list from another workspace', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(err(notFound('CrmMailingList')))
      expectErr(
        await CrmMailingListService.listMembers('u1', 'ws1', 'l1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedMemberRepo.listByList).not.toHaveBeenCalled()
    })

    it('should propagate repository errors', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedMemberRepo.listByList.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmMailingListService.listMembers('u1', 'ws1', 'l1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('addMember()', () => {
    it('should add a member and audit the address', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedMemberRepo.add.mockResolvedValue(ok(member))

      const dto = expectOk(
        await CrmMailingListService.addMember('u1', 'ws1', 'l1', {
          email: 'jane@acme.com',
          name: 'Jane',
          personId: 'p1',
        }),
      )
      expect(dto.id).toBe('m1')
      expect(mockedMemberRepo.add).toHaveBeenCalledWith({
        mailingListId: 'l1',
        email: 'jane@acme.com',
        name: 'Jane',
        personId: 'p1',
      })
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { memberAdded: 'jane@acme.com' } }),
      )
    })

    it('should return not found for a missing list', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(err(notFound('CrmMailingList')))
      expectErr(
        await CrmMailingListService.addMember('u1', 'ws1', 'l1', {
          email: 'a@acme.com',
        }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedMemberRepo.add).not.toHaveBeenCalled()
    })

    it('should propagate add errors', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedMemberRepo.add.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmMailingListService.addMember('u1', 'ws1', 'l1', {
          email: 'a@acme.com',
        }),
        'DATABASE_ERROR',
      )
      expect(mockedAudit).not.toHaveBeenCalled()
    })
  })

  describe('removeMember()', () => {
    it('should remove a member (MEMBER can edit lists)', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedMemberRepo.remove.mockResolvedValue(ok(undefined as never))

      expectOk(
        await CrmMailingListService.removeMember('u1', 'ws1', 'l1', 'm1'),
      )
      expect(mockedMemberRepo.remove).toHaveBeenCalledWith('m1')
      expect(mockedAudit).toHaveBeenCalledWith(
        expect.objectContaining({ meta: { memberRemoved: 'm1' } }),
      )
    })

    it('should return not found for a missing list', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(err(notFound('CrmMailingList')))
      expectErr(
        await CrmMailingListService.removeMember('u1', 'ws1', 'l1', 'm1'),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedMemberRepo.remove).not.toHaveBeenCalled()
    })

    it('should propagate remove errors', async () => {
      asRole('MEMBER')
      mockedListRepo.findById.mockResolvedValue(ok(list))
      mockedMemberRepo.remove.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmMailingListService.removeMember('u1', 'ws1', 'l1', 'm1'),
        'DATABASE_ERROR',
      )
    })
  })
})
