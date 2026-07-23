import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedCrmCompany } from '@/src/__tests__/factories/crm-company.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmCompanyRepository } from '../crm-company.repository'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('CrmCompanyRepository', () => {
  describe('findById()', () => {
    it('should return the company when it exists in the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmCompany(workspace.id, user.id, {
        name: 'Acme',
      })

      const result = await CrmCompanyRepository.findById(
        seeded.id,
        workspace.id,
      )

      const company = expectOk(result)
      expect(company.name).toBe('Acme')
    })

    it('should return RESOURCE_NOT_FOUND for a soft-deleted company', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmCompany(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      const result = await CrmCompanyRepository.findById(
        seeded.id,
        workspace.id,
      )
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })

    it('should return RESOURCE_NOT_FOUND for another workspace', async () => {
      const [workspaceA, workspaceB, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const seeded = await seedCrmCompany(workspaceA.id, user.id)

      const result = await CrmCompanyRepository.findById(
        seeded.id,
        workspaceB.id,
      )
      expectErr(result, 'RESOURCE_NOT_FOUND')
    })
  })

  describe('listByWorkspace()', () => {
    it('should list companies ordered by position, excluding soft-deleted', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmCompany(workspace.id, user.id, { name: 'A' })
      const b = await seedCrmCompany(workspace.id, user.id, { name: 'B' })
      await seedCrmCompany(workspace.id, user.id, {
        name: 'C',
        deletedAt: new Date(),
      })

      const result = await CrmCompanyRepository.listByWorkspace(workspace.id)

      const list = expectOk(result)
      expect(list.map((c) => c.id)).toEqual([a.id, b.id])
    })

    it('should filter by icp when provided', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const icp = await seedCrmCompany(workspace.id, user.id, { icp: true })
      await seedCrmCompany(workspace.id, user.id, { icp: false })

      const result = await CrmCompanyRepository.listByWorkspace(workspace.id, {
        icp: true,
      })

      const list = expectOk(result)
      expect(list.map((c) => c.id)).toEqual([icp.id])
    })
  })

  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmCompany(workspace.id, user.id)

      const result = await CrmCompanyRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Second',
      })

      const company = expectOk(result)
      expect(company.position).toBe(1)
    })

    it('should return CRM_COMPANY_CONFLICT on duplicate domain', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmCompany(workspace.id, user.id, { domain: 'acme.com' })

      const result = await CrmCompanyRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        name: 'Dup',
        domain: 'acme.com',
      })

      expectErr(result, 'CRM_COMPANY_CONFLICT')
    })
  })

  describe('softDelete()', () => {
    it('should set deletedAt and exclude the company from listing', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmCompany(workspace.id, user.id)

      expectOk(await CrmCompanyRepository.softDelete(seeded.id))

      const stored = await prisma.crmCompany.findUnique({
        where: { id: seeded.id },
      })
      expect(stored?.deletedAt).not.toBeNull()
    })
  })

  describe('reorder()', () => {
    it('should update positions to match the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmCompany(workspace.id, user.id)
      const b = await seedCrmCompany(workspace.id, user.id)

      expectOk(await CrmCompanyRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmCompanyRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((c) => c.id)).toEqual([b.id, a.id])
    })
  })
})
