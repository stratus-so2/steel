import type { CrmQuotaPeriod } from '@prisma/client'
import { periodKeyOf } from '@/src/lib/crm-forecast-period'
import { ok, type Result } from '@/src/lib/result'
import { CrmOpportunityRepository } from '@/src/repositories/crm-opportunity.repository'
import { CrmQuotaRepository } from '@/src/repositories/crm-quota.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import type {
  ForecastDTO,
  ForecastRow,
} from '@/src/schemas/crm-forecast.schema'
import { assertMember } from './authz'

/** Chave de agrupamento por responsável + período. */
function rowKey(ownerId: string | null, periodKey: string): string {
  return `${ownerId ?? '—'}::${periodKey}`
}

export const CrmForecastService = {
  /**
   * Previsão de receita por responsável e período. Para cada oportunidade
   * viva com `closeDate`: etapas WON somam em `wonAmount`; etapas OPEN
   * entram ponderadas (`amount × probability/100`) em `weightedOpenAmount`.
   * O período vem do `closeDate` (mês ou trimestre). Mescla as metas
   * (CrmQuota) e calcula o atingimento.
   */
  async getForecast(
    actorId: string,
    workspaceId: string,
    period: CrmQuotaPeriod,
  ): Promise<Result<ForecastDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const [members, opps, quotas] = await Promise.all([
      MembershipRepository.listWithUserByWorkspace(workspaceId),
      CrmOpportunityRepository.listOpenAndWonWithStage(workspaceId),
      CrmQuotaRepository.listByWorkspace(workspaceId, { period }),
    ])
    if (!members.ok) return members
    if (!opps.ok) return opps
    if (!quotas.ok) return quotas

    const ownerName = new Map<string, string>()
    for (const m of members.value) {
      ownerName.set(m.user.id, m.user.name || m.user.email)
    }

    const rows = new Map<string, ForecastRow>()
    function bucket(ownerId: string | null, periodKey: string): ForecastRow {
      const key = rowKey(ownerId, periodKey)
      let row = rows.get(key)
      if (!row) {
        row = {
          ownerId,
          ownerName: ownerId
            ? (ownerName.get(ownerId) ?? 'Desconhecido')
            : 'Sem responsável',
          periodKey,
          wonAmount: 0,
          weightedOpenAmount: 0,
          forecastAmount: 0,
          openCount: 0,
          wonCount: 0,
          quotaAmount: 0,
          attainmentPct: null,
        }
        rows.set(key, row)
      }
      return row
    }

    for (const opp of opps.value) {
      if (!opp.closeDate) continue
      const periodKey = periodKeyOf(opp.closeDate, period)
      const amount = opp.amount ? Number(opp.amount) : 0
      const row = bucket(opp.ownerId, periodKey)

      if (opp.stage.category === 'WON') {
        row.wonAmount += amount
        row.wonCount += 1
      } else {
        row.weightedOpenAmount += (amount * opp.stage.probability) / 100
        row.openCount += 1
      }
    }

    // Mescla metas: garante linha mesmo sem oportunidades no período.
    for (const quota of quotas.value) {
      const row = bucket(quota.ownerId, quota.periodKey)
      row.quotaAmount = Number(quota.targetAmount)
    }

    for (const row of rows.values()) {
      row.weightedOpenAmount = Math.round(row.weightedOpenAmount * 100) / 100
      row.forecastAmount =
        Math.round((row.wonAmount + row.weightedOpenAmount) * 100) / 100
      row.attainmentPct =
        row.quotaAmount > 0
          ? Math.round((row.forecastAmount / row.quotaAmount) * 100)
          : null
    }

    const sorted = [...rows.values()].sort((a, b) => {
      if (a.periodKey !== b.periodKey) {
        return a.periodKey.localeCompare(b.periodKey)
      }
      return a.ownerName.localeCompare(b.ownerName)
    })

    return ok({ period, rows: sorted })
  },
}
