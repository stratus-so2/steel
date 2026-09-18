import { describe, expect, it, vi } from 'vitest'
import { seedCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { seedCrmPerson } from '@/src/__tests__/factories/crm-person.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmPersonRepository } from '../crm-person.repository'

describe('CrmPersonRepository', () => {
  describe('findById()', () => {
    it('should return the person when it exists in the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmPerson(workspace.id, user.id, {
        name: 'Jane',
      })

      const result = await CrmPersonRepository.findById(seeded.id, workspace.id)

      const person = expectOk(result)
      expect(person.name).toBe('Jane')
    })

    it('should return RESOURCE_NOT_FOUND for a soft-deleted person', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmPerson(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const result = await CrmPersonRepository.findById(seeded.id, workspace.id)
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('findFirstByContacts()', () => {
    it('should return the oldest person sharing an e-mail (case-insensitive)', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const oldest = await seedCrmPerson(workspace.id, user.id, {
        emails: ['JANE@acme.com'],
      })
      await seedCrmPerson(workspace.id, user.id, { emails: ['jane@acme.com'] })

      const found = expectOk(
        await CrmPersonRepository.findFirstByContacts(workspace.id, {
          emails: ['jane@acme.com'],
          phones: [],
        }),
      )
      expect(found?.id).toBe(oldest.id)
    })

    it('should match by phone digits', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmPerson(workspace.id, user.id, {
        phones: ['+55 81 99999-0000'],
      })

      const found = expectOk(
        await CrmPersonRepository.findFirstByContacts(workspace.id, {
          emails: [],
          phones: ['5581999990000'],
        }),
      )
      expect(found?.id).toBe(seeded.id)
    })

    it('should ignore deleted people and other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const emails = ['jane@acme.com']
      await seedCrmPerson(workspace.id, user.id, {
        emails,
        deletedAt: new Date(),
      })
      await seedCrmPerson(other.id, user.id, { emails })

      const found = expectOk(
        await CrmPersonRepository.findFirstByContacts(workspace.id, {
          emails,
          phones: [],
        }),
      )
      expect(found).toBeNull()
    })
  })

  describe('listByWorkspace()', () => {
    it('should filter by companyId when provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const company = await seedCrmCompany(workspace.id, user.id)
      const linked = await seedCrmPerson(workspace.id, user.id, {
        companyId: company.id,
      })
      await seedCrmPerson(workspace.id, user.id)

      const result = await CrmPersonRepository.listByWorkspace(workspace.id, {
        companyId: company.id,
      })

      const list = expectOk(result)
      expect(list.map((p) => p.id)).toEqual([linked.id])
    })
  })

  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmPerson(workspace.id, user.id)

      const result = await CrmPersonRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
      })

      const person = expectOk(result)
      expect(person.position).toBe(1)
    })
  })

  describe('softDelete()', () => {
    it('should set deletedAt', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmPerson(workspace.id, user.id)

      expectOk(await CrmPersonRepository.softDelete(seeded.id))

      const stored = await prisma.crmPerson.findUnique({
        where: { id: seeded.id },
      })
      expect(stored?.deletedAt).not.toBeNull()
    })
  })

  describe('reorder()', () => {
    it('should update positions to match the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmPerson(workspace.id, user.id)
      const b = await seedCrmPerson(workspace.id, user.id)

      expectOk(await CrmPersonRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmPersonRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((p) => p.id)).toEqual([b.id, a.id])
    })
  })

  describe('update()', () => {
    it('should update contact fields and unlink the company', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const company = await seedCrmCompany(workspace.id, user.id)
      const seeded = await seedCrmPerson(workspace.id, user.id, {
        companyId: company.id,
      })

      const person = expectOk(
        await CrmPersonRepository.update(seeded.id, {
          name: 'Renomeada',
          emails: ['nova@example.com'],
          jobTitle: null,
          companyId: null,
          updatedById: user.id,
        }),
      )
      expect(person.name).toBe('Renomeada')
      expect(person.emails).toEqual(['nova@example.com'])
      expect(person.companyId).toBeNull()
    })
  })

  describe('edge cases and database failures', () => {
    it('should short-circuit findFirstByContacts when no contact is given', async () => {
      const spy = vi.spyOn(prisma, '$queryRaw')
      expect(
        expectOk(
          await CrmPersonRepository.findFirstByContacts('w', {
            emails: [],
            phones: [],
          }),
        ),
      ).toBeNull()
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    })

    it('should return null when no person matches the contacts', async () => {
      const workspace = await seedWorkspace()
      expect(
        expectOk(
          await CrmPersonRepository.findFirstByContacts(workspace.id, {
            emails: ['ninguem@example.com'],
            phones: [],
          }),
        ),
      ).toBeNull()
    })

    it('should return DATABASE_ERROR when the contacts query throws', async () => {
      const spy = vi
        .spyOn(prisma, '$queryRaw')
        .mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await CrmPersonRepository.findFirstByContacts('w', {
          emails: ['a@example.com'],
          phones: [],
        }),
        'DATABASE_ERROR',
      )
      spy.mockRestore()
    })

    it('should return DATABASE_ERROR when writes hit missing rows or FKs', async () => {
      const user = await seedUser()
      expectErr(
        await CrmPersonRepository.create({
          workspaceId: 'missing',
          createdById: user.id,
          name: 'X',
        }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmPersonRepository.update('missing', { name: 'X' }),
        'DATABASE_ERROR',
      )
      expectErr(
        await CrmPersonRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })

    it('should not reorder people of another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmPerson(other.id, user.id)

      expectErr(
        await CrmPersonRepository.reorder(workspace.id, [foreign.id]),
        'DATABASE_ERROR',
      )
    })

    it('should return DATABASE_ERROR when reads throw', async () => {
      const list = vi
        .spyOn(prisma.crmPerson, 'findMany')
        .mockRejectedValueOnce(new Error('boom'))
      const find = vi
        .spyOn(prisma.crmPerson, 'findFirst')
        .mockRejectedValueOnce(new Error('boom'))
      expectErr(
        await CrmPersonRepository.listByWorkspace('w'),
        'DATABASE_ERROR',
      )
      expectErr(await CrmPersonRepository.findById('p', 'w'), 'DATABASE_ERROR')
      list.mockRestore()
      find.mockRestore()
    })
  })
})
