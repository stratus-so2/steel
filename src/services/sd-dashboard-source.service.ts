import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import { resolveSdTicketPrefixes } from '@/src/lib/servicedesk/ticket-code'
import {
  toSdCostDashboardRow,
  toSdEventDashboardRow,
  toSdKbDashboardRow,
  toSdTicketDashboardRow,
} from '@/src/mappers/sd-dashboard-source.mapper'
import { SdDashboardSourceRepository } from '@/src/repositories/sd-dashboard-source.repository'
import {
  SD_DASHBOARD_HISTORY_DAYS,
  SD_DASHBOARD_ROW_LIMITS,
  type SdDashboardSource,
} from '@/src/schemas/sd-dashboard.schema'
import type { SdDashboardRow } from '@/types/sd-dashboard'
import { SdAccess } from './sd-access'

const DAY_MS = 86_400_000

/**
 * Dados dos widgets dos dashboards do ServiceDesk. Só agentes/admins com
 * `sd-dashboards:VIEW` (os painéis mostram a operação inteira — solicitante
 * nunca vê). O recorte é o histórico de `SD_DASHBOARD_HISTORY_DAYS` dias
 * (chamados em aberto entram sempre), com teto de linhas por fonte.
 */
export const SdDashboardSourceService = {
  async rows(
    actorId: string,
    workspaceId: string,
    source: SdDashboardSource,
    now: Date = new Date(),
  ): Promise<Result<SdDashboardRow[]>> {
    const access = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-dashboards',
      action: 'VIEW',
    })
    if (!access.ok) return access

    const limit = SD_DASHBOARD_ROW_LIMITS[source]
    if (source === 'sd-kb-articles') {
      const articles = await SdDashboardSourceRepository.listKbArticles(
        workspaceId,
        limit,
      )
      if (!articles.ok) return articles
      return ok(articles.value.map(toSdKbDashboardRow))
    }

    const context = await SdDashboardSourceRepository.context(workspaceId)
    if (!context.ok) return context
    const prefixes = resolveSdTicketPrefixes(context.value.ticketPrefixes)
    const since = new Date(now.getTime() - SD_DASHBOARD_HISTORY_DAYS * DAY_MS)

    if (source === 'sd-ticket-costs') {
      const costs = await SdDashboardSourceRepository.listCosts(
        workspaceId,
        since,
        limit,
      )
      if (!costs.ok) return costs
      return ok(costs.value.map((c) => toSdCostDashboardRow(c, prefixes)))
    }

    if (source === 'sd-ticket-events') {
      const events = await SdDashboardSourceRepository.listEvents(
        workspaceId,
        since,
        limit,
      )
      if (!events.ok) return events
      return ok(events.value.map((e) => toSdEventDashboardRow(e, prefixes)))
    }

    const tickets = await SdDashboardSourceRepository.listTickets(
      workspaceId,
      since,
      limit,
    )
    if (!tickets.ok) return tickets
    if (tickets.value.length >= limit) {
      logger.warn('servicedesk.dashboard.source_truncated', {
        workspaceId,
        source,
        limit,
      })
    }
    const ctx = {
      prefixes,
      atRiskPercent: context.value.slaAtRiskPercent,
      topPriorityLevel: context.value.topPriorityLevel,
      now,
    }
    return ok(tickets.value.map((t) => toSdTicketDashboardRow(t, ctx)))
  },
}
