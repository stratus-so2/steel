import { describe, expect, it, vi } from 'vitest'
import {
  seedCrmDashboard,
  seedCrmDashboardWidget,
} from '@/src/__tests__/factories/crm-dashboard.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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
        module: 'CRM',
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

describe('CrmDashboardRepository (reads & writes)', () => {
  it('should list by module and position without leaking other workspaces', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const second = await seedCrmDashboard(workspace.id, user.id, {
      position: 3,
    })
    const first = await seedCrmDashboard(workspace.id, user.id, {
      position: 1,
    })
    await seedCrmDashboard(workspace.id, user.id, { deletedAt: new Date() })
    expectOk(
      await CrmDashboardRepository.create({
        workspaceId: workspace.id,
        createdById: user.id,
        title: 'Zap',
        module: 'COMMUNICATION',
      }),
    )
    await seedCrmDashboard(other.id, user.id)

    const crm = expectOk(
      await CrmDashboardRepository.listByWorkspace(workspace.id, 'CRM'),
    )
    expect(crm.map((d) => d.id)).toEqual([first.id, second.id])
    const zap = expectOk(
      await CrmDashboardRepository.listByWorkspace(
        workspace.id,
        'COMMUNICATION',
      ),
    )
    expect(zap.map((d) => d.title)).toEqual(['Zap'])
  })

  it('should find by id only inside the workspace and while not deleted', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const dashboard = await seedCrmDashboard(workspace.id, user.id)

    expect(
      expectOk(
        await CrmDashboardRepository.findById(dashboard.id, workspace.id),
      ).id,
    ).toBe(dashboard.id)
    expectErr(
      await CrmDashboardRepository.findById(dashboard.id, other.id),
      'RESOURCE_NOT_FOUND',
    )

    expectOk(await CrmDashboardRepository.softDelete(dashboard.id))
    expectErr(
      await CrmDashboardRepository.findById(dashboard.id, workspace.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should update the title', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const dashboard = await seedCrmDashboard(workspace.id, user.id)

    const updated = expectOk(
      await CrmDashboardRepository.update(dashboard.id, {
        title: 'Renamed',
        updatedById: user.id,
      }),
    )
    expect(updated.title).toBe('Renamed')
  })

  it('should reorder dashboards and reject ids from other workspaces', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const a = await seedCrmDashboard(workspace.id, user.id, { position: 0 })
    const b = await seedCrmDashboard(workspace.id, user.id, { position: 1 })
    const foreign = await seedCrmDashboard(other.id, user.id)

    expectOk(await CrmDashboardRepository.reorder(workspace.id, [b.id, a.id]))
    const list = expectOk(
      await CrmDashboardRepository.listByWorkspace(workspace.id, 'CRM'),
    )
    expect(list.map((d) => d.id)).toEqual([b.id, a.id])

    expectErr(
      await CrmDashboardRepository.reorder(workspace.id, [foreign.id]),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await CrmDashboardRepository.create({
        workspaceId: 'missing-workspace',
        createdById: 'missing-user',
        title: 'x',
        module: 'CRM',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmDashboardRepository.update('missing', { title: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmDashboardRepository.softDelete('missing'),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.crmDashboard, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmDashboardRepository.listByWorkspace('ws', 'CRM'),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.crmDashboard, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmDashboardRepository.findById('d', 'ws'),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmDashboardWidgetRepository (reads & writes)', () => {
  it('should create, update, find and delete a widget', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const dashboard = await seedCrmDashboard(workspace.id, user.id)
    const otherDashboard = await seedCrmDashboard(workspace.id, user.id)

    const widget = expectOk(
      await CrmDashboardWidgetRepository.create({
        dashboardId: dashboard.id,
        type: 'RICH_TEXT',
        x: 1,
        y: 2,
        config: { text: 'Olá' },
      }),
    )
    expect(widget).toMatchObject({ type: 'RICH_TEXT', x: 1, y: 2 })

    const updated = expectOk(
      await CrmDashboardWidgetRepository.update(widget.id, {
        w: 8,
        config: { text: 'Tchau' },
      }),
    )
    expect(updated.w).toBe(8)
    expect(updated.config).toEqual({ text: 'Tchau' })

    expect(
      expectOk(
        await CrmDashboardWidgetRepository.findById(widget.id, dashboard.id),
      ).id,
    ).toBe(widget.id)
    expectErr(
      await CrmDashboardWidgetRepository.findById(widget.id, otherDashboard.id),
      'RESOURCE_NOT_FOUND',
    )

    expectOk(await CrmDashboardWidgetRepository.delete(widget.id))
    expectErr(
      await CrmDashboardWidgetRepository.findById(widget.id, dashboard.id),
      'RESOURCE_NOT_FOUND',
    )
  })

  it('should apply a layout only to widgets of the given dashboard', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const dashboard = await seedCrmDashboard(workspace.id, user.id)
    const otherDashboard = await seedCrmDashboard(workspace.id, user.id)
    const mine = await seedCrmDashboardWidget(dashboard.id)
    const foreign = await seedCrmDashboardWidget(otherDashboard.id)

    expectOk(
      await CrmDashboardWidgetRepository.applyLayout(dashboard.id, [
        { id: mine.id, x: 4, y: 5, w: 6, h: 7 },
        { id: foreign.id, x: 9, y: 9, w: 9, h: 9 },
      ]),
    )

    const stored = await prisma.crmDashboardWidget.findMany({
      where: { id: { in: [mine.id, foreign.id] } },
    })
    const byId = new Map(stored.map((w) => [w.id, w]))
    expect(byId.get(mine.id)).toMatchObject({ x: 4, y: 5, w: 6, h: 7 })
    expect(byId.get(foreign.id)).toMatchObject({ x: 0, y: 0 })
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await CrmDashboardWidgetRepository.create({
        dashboardId: 'missing',
        type: 'CHART',
        config: {},
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmDashboardWidgetRepository.update('missing', { x: 1 }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmDashboardWidgetRepository.delete('missing'),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.crmDashboardWidget, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmDashboardWidgetRepository.listByDashboard('d'),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.crmDashboardWidget, 'findFirst').mockRejectedValueOnce(
      new Error('boom'),
    )
    expectErr(
      await CrmDashboardWidgetRepository.findById('w', 'd'),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await CrmDashboardWidgetRepository.applyLayout('d', []),
      'DATABASE_ERROR',
    )
  })
})
