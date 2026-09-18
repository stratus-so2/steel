import { describe, expect, it, vi } from 'vitest'
import { seedCrmReport } from '@/src/__tests__/factories/crm-report.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { CrmReportRepository } from '../crm-report.repository'

describe('CrmReportRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmReport(workspace.id, user.id)

      const result = await CrmReportRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        module: 'CRM',
        name: 'Second',
        source: 'company',
        columns: ['name'],
        filters: [],
      })

      const report = expectOk(result)
      expect(report.position).toBe(1)
    })

    it('should persist the mega-query when given', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const query = {
        mode: 'join',
        datasets: [{ alias: 'company', source: 'company', filters: [] }],
        columns: ['company.name'],
      }

      const result = await CrmReportRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        module: 'CRM',
        name: 'With query',
        source: 'company',
        columns: ['name'],
        filters: [],
        query,
      })

      const report = expectOk(result)
      expect(report.query).toEqual(query)
    })
  })

  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted reports', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmReport(workspace.id, user.id)
      await seedCrmReport(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmReportRepository.listByWorkspace(workspace.id, 'CRM'),
      )
      expect(list.map((r) => r.id)).toEqual([kept.id])
    })
  })

  describe('update()', () => {
    it('should clear the mega-query back to legacy mode with explicit null', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmReport(workspace.id, user.id, {
        query: {
          mode: 'join',
          datasets: [{ alias: 'company', source: 'company', filters: [] }],
          columns: ['company.name'],
        },
      })

      const result = await CrmReportRepository.update(seeded.id, {
        query: null,
      })

      const report = expectOk(result)
      expect(report.query).toBeNull()
    })
  })

  describe('create() / failures', () => {
    it('should return DATABASE_ERROR when the workspace does not exist', async () => {
      const user = await seedUser()
      expectErr(
        await CrmReportRepository.create({
          workspaceId: 'missing-workspace',
          createdById: user.id,
          module: 'CRM',
          name: 'Orphan',
          source: 'company',
          columns: [],
          filters: [],
        }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('listByWorkspace() / module & scoping', () => {
    it('should filter by module, order by position and never leak other workspaces', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const second = await seedCrmReport(workspace.id, user.id, {
        position: 5,
      })
      const first = await seedCrmReport(workspace.id, user.id, {
        position: 1,
      })
      await prisma.crmReport.create({
        data: {
          workspaceId: workspace.id,
          createdById: user.id,
          module: 'COMMUNICATION',
          name: 'Zap',
          source: 'conversation',
          columns: [],
          filters: [],
        },
      })
      await seedCrmReport(other.id, user.id)

      const crm = expectOk(
        await CrmReportRepository.listByWorkspace(workspace.id, 'CRM'),
      )
      expect(crm.map((r) => r.id)).toEqual([first.id, second.id])

      const zap = expectOk(
        await CrmReportRepository.listByWorkspace(
          workspace.id,
          'COMMUNICATION',
        ),
      )
      expect(zap.map((r) => r.name)).toEqual(['Zap'])
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmReport, 'findMany').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(
        await CrmReportRepository.listByWorkspace('ws', 'CRM'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('findById()', () => {
    it('should find a live report in its workspace only', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const report = await seedCrmReport(workspace.id, user.id)
      const deleted = await seedCrmReport(workspace.id, user.id, {
        deletedAt: new Date(),
      })

      expect(
        expectOk(await CrmReportRepository.findById(report.id, workspace.id))
          .id,
      ).toBe(report.id)
      expectErr(
        await CrmReportRepository.findById(report.id, other.id),
        'RESOURCE_NOT_FOUND',
      )
      expectErr(
        await CrmReportRepository.findById(deleted.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR when the query throws', async () => {
      vi.spyOn(prisma.crmReport, 'findFirst').mockRejectedValueOnce(
        new Error('boom'),
      )
      expectErr(await CrmReportRepository.findById('r', 'ws'), 'DATABASE_ERROR')
    })
  })

  describe('update() / sort & fields', () => {
    it('should set sort, then clear it with null, leaving query untouched when omitted', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const query = { mode: 'join', datasets: [], columns: [] }
      const seeded = await seedCrmReport(workspace.id, user.id, { query })

      const withSort = expectOk(
        await CrmReportRepository.update(seeded.id, {
          name: 'Renamed',
          groupBy: 'stage',
          sort: { field: 'name', dir: 'asc' },
          updatedById: user.id,
        }),
      )
      expect(withSort.name).toBe('Renamed')
      expect(withSort.groupBy).toBe('stage')
      expect(withSort.sort).toEqual({ field: 'name', dir: 'asc' })
      expect(withSort.query).toEqual(query)

      const cleared = expectOk(
        await CrmReportRepository.update(seeded.id, { sort: null }),
      )
      expect(cleared.sort).toBeNull()
      expect(cleared.query).toEqual(query)
    })

    it('should replace the query with a new value', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const seeded = await seedCrmReport(workspace.id, user.id)
      const query = { mode: 'union', datasets: [], columns: [] }

      const updated = expectOk(
        await CrmReportRepository.update(seeded.id, { query }),
      )
      expect(updated.query).toEqual(query)
    })

    it('should return DATABASE_ERROR for a missing report', async () => {
      expectErr(
        await CrmReportRepository.update('missing', { name: 'x' }),
        'DATABASE_ERROR',
      )
    })
  })

  describe('softDelete()', () => {
    it('should hide the report from reads', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const report = await seedCrmReport(workspace.id, user.id)

      expectOk(await CrmReportRepository.softDelete(report.id))
      expectErr(
        await CrmReportRepository.findById(report.id, workspace.id),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should return DATABASE_ERROR for a missing report', async () => {
      expectErr(
        await CrmReportRepository.softDelete('missing'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('reorder()', () => {
    it('should rewrite positions following the given order', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const a = await seedCrmReport(workspace.id, user.id, { position: 0 })
      const b = await seedCrmReport(workspace.id, user.id, { position: 1 })

      expectOk(await CrmReportRepository.reorder(workspace.id, [b.id, a.id]))

      const list = expectOk(
        await CrmReportRepository.listByWorkspace(workspace.id, 'CRM'),
      )
      expect(list.map((r) => r.id)).toEqual([b.id, a.id])
    })

    it('should return DATABASE_ERROR when an id belongs to another workspace', async () => {
      const [workspace, other, user] = await Promise.all([
        seedWorkspace(),
        seedWorkspace(),
        seedUser(),
      ])
      const foreign = await seedCrmReport(other.id, user.id)

      expectErr(
        await CrmReportRepository.reorder(workspace.id, [foreign.id]),
        'DATABASE_ERROR',
      )
    })
  })
})
