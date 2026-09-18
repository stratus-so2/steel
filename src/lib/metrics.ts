import type {
  BillingInterval,
  ModuleKind,
  SubscriptionStatus,
} from '@prisma/client'
import type {
  ChurnMonthDTO,
  ModuleUsageDayDTO,
  ModuleUsageTotalDTO,
  TopWorkspaceUsageDTO,
} from '@/types/admin-metrics'
import { USAGE_TIMEZONE } from './usage/module-usage'

/** Cálculos puros do painel de métricas do admin global. */

const MODULES: ModuleKind[] = ['SERVICE_DESK', 'CRM', 'COMMUNICATION']

/** Valor mensal equivalente de uma cobrança (anual entra como /12). */
export function monthlyEquivalentCents(
  amount: number,
  interval: BillingInterval,
): number {
  return interval === 'YEARLY' ? Math.round(amount / 12) : amount
}

export interface PayingSubscription {
  workspaceId: string
  amount: number
  interval: BillingInterval
}

/**
 * MRR a partir da assinatura PAID mais recente de cada workspace pagante.
 * Se vier mais de uma por workspace, só a primeira da lista conta (o
 * repository ordena da mais recente para a mais antiga).
 */
export function computeMrr(subscriptions: readonly PayingSubscription[]): {
  cents: number
  payingWorkspaces: number
} {
  const seen = new Set<string>()
  let cents = 0
  for (const sub of subscriptions) {
    if (seen.has(sub.workspaceId)) continue
    seen.add(sub.workspaceId)
    cents += monthlyEquivalentCents(sub.amount, sub.interval)
  }
  return { cents, payingWorkspaces: seen.size }
}

const monthFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: USAGE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
})

/** `YYYY-MM` no fuso de São Paulo. */
export function monthKey(date: Date): string {
  return monthFormatter.format(date).slice(0, 7)
}

/** Os `count` meses até o de `now` (inclusive), do mais antigo ao mais novo. */
export function recentMonths(now: Date, count: number): string[] {
  const [year, month] = monthKey(now).split('-').map(Number)
  return Array.from({ length: count }, (_, i) => {
    const offset = month - 1 - (count - 1 - i)
    const y = year + Math.floor(offset / 12)
    const m = ((offset % 12) + 12) % 12
    return `${y}-${String(m + 1).padStart(2, '0')}`
  })
}

export interface EndedSubscription {
  status: SubscriptionStatus
  amount: number
  interval: BillingInterval
  /** Momento em que o status final foi gravado (proxy da data de cancelamento). */
  endedAt: Date
}

/** Cancelamentos por mês nos últimos `months` meses, meses vazios incluídos. */
export function bucketChurnByMonth(
  subscriptions: readonly EndedSubscription[],
  now: Date,
  months = 12,
): ChurnMonthDTO[] {
  const buckets = new Map<string, ChurnMonthDTO>(
    recentMonths(now, months).map((month) => [
      month,
      { month, cancelled: 0, expired: 0, lostMrrCents: 0 },
    ]),
  )
  for (const sub of subscriptions) {
    const bucket = buckets.get(monthKey(sub.endedAt))
    if (!bucket) continue
    if (sub.status === 'CANCELLED') bucket.cancelled += 1
    else if (sub.status === 'EXPIRED') bucket.expired += 1
    else continue
    bucket.lostMrrCents += monthlyEquivalentCents(sub.amount, sub.interval)
  }
  return [...buckets.values()]
}

export interface UsageRow {
  /** `YYYY-MM-DD`. */
  day: string
  workspaceId: string
  workspaceName: string
  workspaceSlug: string
  module: ModuleKind
  requests: number
  mutations: number
}

/** Totais por módulo, série diária e ranking de workspaces. */
export function summarizeUsage(
  rows: readonly UsageRow[],
  topLimit = 10,
): {
  totals: ModuleUsageTotalDTO[]
  daily: ModuleUsageDayDTO[]
  topWorkspaces: TopWorkspaceUsageDTO[]
  activeWorkspaces: number
} {
  const totals = new Map(
    MODULES.map((module) => [
      module,
      { module, requests: 0, mutations: 0, workspaces: new Set<string>() },
    ]),
  )
  const daily = new Map<string, ModuleUsageDayDTO>()
  const byWorkspace = new Map<string, TopWorkspaceUsageDTO>()

  for (const row of rows) {
    const total = totals.get(row.module)
    if (total) {
      total.requests += row.requests
      total.mutations += row.mutations
      total.workspaces.add(row.workspaceId)
    }

    const dayId = `${row.day}|${row.module}`
    const day = daily.get(dayId) ?? {
      day: row.day,
      module: row.module,
      requests: 0,
      mutations: 0,
    }
    day.requests += row.requests
    day.mutations += row.mutations
    daily.set(dayId, day)

    const ws = byWorkspace.get(row.workspaceId) ?? {
      workspaceId: row.workspaceId,
      name: row.workspaceName,
      slug: row.workspaceSlug,
      requests: 0,
      mutations: 0,
    }
    ws.requests += row.requests
    ws.mutations += row.mutations
    byWorkspace.set(row.workspaceId, ws)
  }

  return {
    totals: [...totals.values()].map(({ workspaces, ...rest }) => ({
      ...rest,
      workspaces: workspaces.size,
    })),
    daily: [...daily.values()].sort(
      (a, b) => a.day.localeCompare(b.day) || a.module.localeCompare(b.module),
    ),
    topWorkspaces: [...byWorkspace.values()]
      .sort((a, b) => b.requests - a.requests)
      .slice(0, topLimit),
    activeWorkspaces: byWorkspace.size,
  }
}
