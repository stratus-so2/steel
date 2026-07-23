import { describe, expect, it } from 'vitest'
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
})
