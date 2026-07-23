import { describe, expect, it } from 'vitest'
import {
  seedCrmDashboard,
  seedCrmDashboardWidget,
} from '@/src/__tests__/factories/crm-dashboard.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmDashboardRepository,
  CrmDashboardWidgetRepository,
} from '../crm-dashboard.repository'

describe('CrmDashboardRepository', () => {
  describe('create()', () => {
    it('should assign the next position within the workspace', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      await seedCrmDashboard(workspace.id, user.id)

      const result = await CrmDashboardRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        title: 'Second',
      })

      const dashboard = expectOk(result)
      expect(dashboard.position).toBe(1)
    })
  })
})

describe('CrmDashboardWidgetRepository', () => {
  describe('listByDashboard()', () => {
    it('should list widgets for a dashboard', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const dashboard = await seedCrmDashboard(workspace.id, user.id)
      await seedCrmDashboardWidget(dashboard.id)

      const list = expectOk(
        await CrmDashboardWidgetRepository.listByDashboard(dashboard.id),
      )
      expect(list).toHaveLength(1)
    })
  })
})
