import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmDashboard,
  createFakeCrmDashboardWidget,
} from '@/src/__tests__/factories/crm-dashboard.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit', () => ({ auditMutation: vi.fn() }))
vi.mock('@/lib/axiom/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))
vi.mock('@/src/repositories/crm-dashboard.repository')

import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import {
  CrmDashboardRepository,
  CrmDashboardWidgetRepository,
} from '@/src/repositories/crm-dashboard.repository'
import {
  ChartConfigSchema,
  ViewConfigSchema,
} from '@/src/schemas/crm-dashboard.schema'
import { SdDashboardSeedService } from '../sd-dashboard-seed.service'
import {
  SD_ANALYTIC_DASHBOARD_TITLE,
  SD_ANALYTIC_WIDGETS,
  SD_TV_DASHBOARD_TITLE,
  SD_TV_WIDGETS,
} from '../sd-dashboard-seed-data'

const dashboards = vi.mocked(CrmDashboardRepository)
const widgets = vi.mocked(CrmDashboardWidgetRepository)

function created(title: string) {
  return ok(
    createFakeCrmDashboard({
      id: `d-${title}`,
      title,
      module: 'SERVICE_DESK',
    }),
  )
}

describe('SdDashboardSeedService.seedDefaults', () => {
  it('creates the analytic and TV dashboards with every widget', async () => {
    dashboards.listByWorkspace.mockResolvedValue(ok([]))
    dashboards.create.mockImplementation(async (data) => created(data.title))
    widgets.create.mockResolvedValue(ok(createFakeCrmDashboardWidget()))

    const summary = expectOk(
      await SdDashboardSeedService.seedDefaults('ws1', 'u1'),
    )

    expect(summary.created).toEqual([
      SD_ANALYTIC_DASHBOARD_TITLE,
      SD_TV_DASHBOARD_TITLE,
    ])
    expect(dashboards.listByWorkspace).toHaveBeenCalledWith(
      'ws1',
      'SERVICE_DESK',
    )
    expect(dashboards.create).toHaveBeenCalledWith({
      workspaceId: 'ws1',
      createdById: 'u1',
      title: SD_TV_DASHBOARD_TITLE,
      module: 'SERVICE_DESK',
    })
    expect(widgets.create).toHaveBeenCalledTimes(
      SD_ANALYTIC_WIDGETS.length + SD_TV_WIDGETS.length,
    )
    expect(auditMutation).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: 'crm_dashboard',
        meta: expect.objectContaining({ seeded: true, module: 'SERVICE_DESK' }),
      }),
    )
    expect(logger.info).toHaveBeenCalledWith(
      'servicedesk.dashboard_seed.applied',
      expect.anything(),
    )
  })

  it('is idempotent by title (nothing created on a second run)', async () => {
    dashboards.listByWorkspace.mockResolvedValue(
      ok([
        createFakeCrmDashboard({ title: SD_ANALYTIC_DASHBOARD_TITLE }),
        createFakeCrmDashboard({ title: SD_TV_DASHBOARD_TITLE }),
      ]),
    )
    const summary = expectOk(
      await SdDashboardSeedService.seedDefaults('ws1', 'u1'),
    )
    expect(summary.created).toEqual([])
    expect(dashboards.create).not.toHaveBeenCalled()
    expect(logger.info).not.toHaveBeenCalled()
  })

  it('recreates only the missing dashboard', async () => {
    dashboards.listByWorkspace.mockResolvedValue(
      ok([createFakeCrmDashboard({ title: SD_ANALYTIC_DASHBOARD_TITLE })]),
    )
    dashboards.create.mockImplementation(async (data) => created(data.title))
    widgets.create.mockResolvedValue(ok(createFakeCrmDashboardWidget()))
    const summary = expectOk(
      await SdDashboardSeedService.seedDefaults('ws1', 'u1'),
    )
    expect(summary.created).toEqual([SD_TV_DASHBOARD_TITLE])
    expect(widgets.create).toHaveBeenCalledTimes(SD_TV_WIDGETS.length)
  })

  it('logs a failed widget and keeps going', async () => {
    dashboards.listByWorkspace.mockResolvedValue(ok([]))
    dashboards.create.mockImplementation(async (data) => created(data.title))
    widgets.create.mockResolvedValue(err(databaseError()))
    expectOk(await SdDashboardSeedService.seedDefaults('ws1', 'u1'))
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.dashboard_seed.widget_failed',
      expect.objectContaining({ workspaceId: 'ws1' }),
    )
  })

  it('propagates a listing or creation failure', async () => {
    dashboards.listByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDashboardSeedService.seedDefaults('ws1', 'u1'),
      'DATABASE_ERROR',
    )

    dashboards.listByWorkspace.mockResolvedValue(ok([]))
    dashboards.create.mockResolvedValue(err(databaseError()))
    expectErr(
      await SdDashboardSeedService.seedDefaults('ws1', 'u1'),
      'DATABASE_ERROR',
    )
    expect(logger.error).toHaveBeenCalledWith(
      'servicedesk.dashboard_seed.failed',
      expect.objectContaining({ dashboardTitle: SD_ANALYTIC_DASHBOARD_TITLE }),
    )
  })
})

describe('seeded widget configs', () => {
  it('are valid for their widget type and only use ServiceDesk sources', () => {
    for (const widget of [...SD_ANALYTIC_WIDGETS, ...SD_TV_WIDGETS]) {
      const schema =
        widget.type === 'CHART' ? ChartConfigSchema : ViewConfigSchema
      const parsed = schema.parse(widget.config)
      expect(parsed.source.startsWith('sd-')).toBe(true)
      expect(parsed.title).toBeTruthy()
      expect(widget.x + widget.w).toBeLessThanOrEqual(12)
    }
  })

  it('cover the TV KPIs requested by the managers', () => {
    const titles = SD_TV_WIDGETS.map(
      (w) => (w.config as { title?: string }).title,
    )
    expect(titles).toEqual(
      expect.arrayContaining([
        'Abertos agora',
        'Não atribuídos',
        'SLA em risco',
        'SLA violados',
        'Resolvidos hoje',
        '% SLA no mês',
        'MTTR hoje',
        'Críticos abertos',
        'Resolvidos por agente hoje',
      ]),
    )
  })
})
