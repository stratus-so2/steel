import { describe, expect, it } from 'vitest'
import { seedCrmReport } from '@/src/__tests__/factories/crm-report.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
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
})
