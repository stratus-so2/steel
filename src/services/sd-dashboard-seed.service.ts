import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import {
  CrmDashboardRepository,
  CrmDashboardWidgetRepository,
} from '@/src/repositories/crm-dashboard.repository'
import type { CreateCrmDashboardWidgetDTO } from '@/src/schemas/crm-dashboard.schema'
import { SD_DEFAULT_DASHBOARDS } from './sd-dashboard-seed-data'

export interface SdDashboardSeedSummary {
  /** Títulos criados agora (os que já existiam são pulados). */
  created: string[]
}

async function createIfMissing(
  workspaceId: string,
  actorId: string,
  existingTitles: Set<string>,
  title: string,
  widgets: readonly CreateCrmDashboardWidgetDTO[],
): Promise<Result<boolean>> {
  if (existingTitles.has(title)) return ok(false)

  const dashboard = await CrmDashboardRepository.create({
    workspaceId,
    createdById: actorId,
    title,
    module: 'SERVICE_DESK',
  })
  if (!dashboard.ok) return dashboard

  for (const widget of widgets) {
    const created = await CrmDashboardWidgetRepository.create({
      dashboardId: dashboard.value.id,
      type: widget.type,
      x: widget.x,
      y: widget.y,
      w: widget.w,
      h: widget.h,
      config: widget.config as Prisma.InputJsonValue,
    })
    if (!created.ok) {
      logger.error('servicedesk.dashboard_seed.widget_failed', {
        workspaceId,
        dashboardTitle: title,
        error: created.error.code,
      })
    }
  }

  auditMutation({
    entity: 'crm_dashboard',
    action: 'create',
    actorId,
    targetId: dashboard.value.id,
    meta: { seeded: true, module: 'SERVICE_DESK', title },
  })
  return ok(true)
}

/**
 * Dashboards padrão do ServiceDesk ("Dashboard analítico" e "KPIs (TV)"),
 * semeados ao liberar o módulo, no "Restaurar padrões" e pelo backfill
 * `pnpm seed:servicedesk`. Idempotente por título: o que já existe (mesmo
 * renomeado de volta) não é recriado nem alterado. Sem autorização — quem
 * chama já autorizou (admin da plataforma, admin do módulo ou script).
 */
export const SdDashboardSeedService = {
  async seedDefaults(
    workspaceId: string,
    actorId: string,
  ): Promise<Result<SdDashboardSeedSummary>> {
    const existing = await CrmDashboardRepository.listByWorkspace(
      workspaceId,
      'SERVICE_DESK',
    )
    if (!existing.ok) {
      logger.error('servicedesk.dashboard_seed.failed', {
        workspaceId,
        error: existing.error.code,
      })
      return existing
    }
    const titles = new Set(existing.value.map((d) => d.title))

    const created: string[] = []
    for (const spec of SD_DEFAULT_DASHBOARDS) {
      const result = await createIfMissing(
        workspaceId,
        actorId,
        titles,
        spec.title,
        spec.widgets,
      )
      if (!result.ok) {
        logger.error('servicedesk.dashboard_seed.failed', {
          workspaceId,
          dashboardTitle: spec.title,
          error: result.error.code,
        })
        return result
      }
      if (result.value) created.push(spec.title)
    }

    if (created.length > 0) {
      logger.info('servicedesk.dashboard_seed.applied', {
        workspaceId,
        created: created.join(','),
      })
    }
    return ok({ created })
  },
}
