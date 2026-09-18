import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmMailingList,
  seedCrmMailingListMember,
} from '@/src/__tests__/factories/crm-email-marketing.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  CrmMailingListMemberRepository,
  CrmMailingListRepository,
} from '../crm-mailing-list.repository'

async function seedBase() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

describe('CrmMailingListRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted lists', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmMailingList(workspace.id, user.id)
      await seedCrmMailingList(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const list = expectOk(
        await CrmMailingListRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((l) => l.id)).toEqual([kept.id])
    })

    it('should list newest first with member counts, scoped to the workspace', async () => {
      const { workspace, other, user } = await seedBase()
      const older = await seedCrmMailingList(workspace.id, user.id, {
        name: 'Antiga',
      })
      await prisma.crmMailingList.update({
        where: { id: older.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const newer = await seedCrmMailingList(workspace.id, user.id, {
        name: 'Nova',
      })
      await seedCrmMailingListMember(older.id, { email: 'a@x.com' })
      await seedCrmMailingListMember(older.id, { email: 'b@x.com' })
      await seedCrmMailingList(other.id, user.id)

      const lists = expectOk(
        await CrmMailingListRepository.listByWorkspace(workspace.id),
      )
      expect(lists.map((l) => [l.id, l._count.members])).toEqual([
        [newer.id, 0],
        [older.id, 2],
      ])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmMailingList, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmMailingListRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find the list only in its workspace and while not deleted', async () => {
      const { workspace, other, user } = await seedBase()
      const list = await seedCrmMailingList(workspace.id, user.id)
      const deleted = await seedCrmMailingList(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      expect(
        expectOk(await CrmMailingListRepository.findById(list.id, workspace.id))
          .id,
      ).toBe(list.id)
      expectErr(
        await CrmMailingListRepository.findById(list.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
      expectErr(
        await CrmMailingListRepository.findById(deleted.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmMailingList, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmMailingListRepository.findById('l', 'w'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('create() / update() / softDelete()', () => {
    it('should create, rename and soft delete a list', async () => {
      const { workspace, user } = await seedBase()

      const created = expectOk(
        await CrmMailingListRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Clientes',
          description: 'Base ativa',
        }),
      )
      expect(created).toMatchObject({ name: 'Clientes', deletedAt: null })

      const updated = expectOk(
        await CrmMailingListRepository.update(created.id, {
          name: 'Clientes VIP',
        }),
      )
      expect(updated.name).toBe('Clientes VIP')
      expect(updated.description).toBe('Base ativa')

      expectOk(await CrmMailingListRepository.softDelete(created.id))
      expectErr(
        await CrmMailingListRepository.findById(created.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR on invalid writes', async () => {
      const user = await seedUser()
      expectErr(
        await CrmMailingListRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          name: 'X',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmMailingListRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmMailingListRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})

describe('CrmMailingListMemberRepository', () => {
  describe('add()', () => {
    it('should add a member to the list', async () => {
      const { workspace, user } = await seedBase()
      const list = await seedCrmMailingList(workspace.id, user.id)

      const member = expectOk(
        await CrmMailingListMemberRepository.add({
          mailingListId: list.id,
          email: 'jane@acme.com',
          name: 'Jane',
        }),
      )
      expect(member).toMatchObject({
        mailingListId: list.id,
        email: 'jane@acme.com',
        name: 'Jane',
      })
    })

    it('should return CRM_MAILING_LIST_MEMBER_CONFLICT on duplicate email', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const list = await seedCrmMailingList(workspace.id, user.id)
      await seedCrmMailingListMember(list.id, { email: 'jane@acme.com' })

      const result = await CrmMailingListMemberRepository.add({
        mailingListId: list.id,
        email: 'jane@acme.com',
      })

      expectErr(result, 'CRM_MAILING_LIST_MEMBER_CONFLICT')
    })

    it('should return DATABASE_ERROR when the list does not exist', async () => {
      expectErr(
        await CrmMailingListMemberRepository.add({
          mailingListId: 'missing',
          email: 'x@x.com',
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByList() / remove()', () => {
    it('should list only the list members newest first and remove one', async () => {
      const { workspace, user } = await seedBase()
      const list = await seedCrmMailingList(workspace.id, user.id)
      const otherList = await seedCrmMailingList(workspace.id, user.id)
      const first = await seedCrmMailingListMember(list.id, {
        email: 'a@x.com',
      })
      await prisma.crmMailingListMember.update({
        where: { id: first.id },
        data: { createdAt: new Date('2020-01-01') },
      })
      const second = await seedCrmMailingListMember(list.id, {
        email: 'b@x.com',
      })
      await seedCrmMailingListMember(otherList.id, { email: 'c@x.com' })

      expect(
        expectOk(await CrmMailingListMemberRepository.listByList(list.id)).map(
          (m) => m.id,
        ),
      ).toEqual([second.id, first.id])

      expectOk(await CrmMailingListMemberRepository.remove(first.id))
      expect(
        expectOk(await CrmMailingListMemberRepository.listByList(list.id)).map(
          (m) => m.id,
        ),
      ).toEqual([second.id])
    })

    it('should return DATABASE_ERROR on failures', async () => {
      vi.spyOn(prisma.crmMailingListMember, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmMailingListMemberRepository.listByList('l'),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmMailingListMemberRepository.remove('missing'),
        'DATABASE_ERROR',
      )
    })
  })
})
