import { logger } from '@/lib/axiom/logger'
import { sdContractPeriodClosed } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  computeSdPeriodTotals,
  resolveSdEntryRate,
  sdPeriodRange,
} from '@/src/lib/servicedesk/billing'
import { NotificationAudienceRepository } from '@/src/repositories/notification-audience.repository'
import {
  SdContractRepository,
  type SdContractWithRelations,
} from '@/src/repositories/sd-contract.repository'
import {
  SdContractPeriodRepository,
  type SdContractPeriodWithRelations,
} from '@/src/repositories/sd-contract-period.repository'
import { SdTimeEntryRepository } from '@/src/repositories/sd-time-entry.repository'
import { notifySdUsers } from './sd-notification.service'

/**
 * Ciclo de vida e consolidação dos períodos de faturamento. É a camada que a
 * fila `servicedesk-billing`, a tela de contratos e o apontamento de horas
 * compartilham — sem autorização (quem chama já resolveu o acesso).
 *
 * Idempotente por `(contractId, periodStart)`: abrir o período do ciclo duas
 * vezes devolve a mesma linha, e consolidar de novo só recalcula os totais.
 */

export interface SdBillingTickResult {
  contracts: number
  opened: number
  closed: number
}

/** Franquia do período: a do contrato + o que sobrou do período anterior. */
async function carriedFrom(
  contract: SdContractWithRelations,
  periodStart: Date,
): Promise<Result<number>> {
  if (!contract.carryOver) return ok(0)
  const previous = await SdContractPeriodRepository.findPrevious(
    contract.id,
    periodStart,
  )
  if (!previous.ok) return previous
  return ok(previous.value?.carriedMinutes ?? 0)
}

/**
 * Período do ciclo que contém `at`, criando-o se ainda não existe (e
 * dizendo se foi criado agora). Período já fechado recusa.
 */
async function openCurrentPeriod(
  contract: SdContractWithRelations,
  at: Date,
): Promise<
  Result<{ period: SdContractPeriodWithRelations; created: boolean }>
> {
  const range = sdPeriodRange(contract.billingCycle, at)
  const existing = await SdContractPeriodRepository.findByStart(
    contract.id,
    range.start,
  )
  if (!existing.ok) return existing
  if (existing.value) {
    if (existing.value.status === 'CLOSED') return err(sdContractPeriodClosed())
    return ok({ period: existing.value, created: false })
  }

  const carried = await carriedFrom(contract, range.start)
  if (!carried.ok) return carried
  const created = await SdContractPeriodRepository.ensure({
    workspaceId: contract.workspaceId,
    contractId: contract.id,
    periodStart: range.start,
    periodEnd: range.end,
    includedMinutes: contract.includedMinutes + carried.value,
  })
  if (!created.ok) return created
  return ok({ period: created.value, created: true })
}

/** Share of the franchise that triggers the first warning. */
export const SD_FRANCHISE_WARNING_RATIO = 0.8
/** Admins told about a contract, at most. */
const ADMIN_CAP = 20

function hours(minutes: number): string {
  const value = Math.round((minutes / 60) * 10) / 10
  return `${value.toLocaleString('pt-BR')}h`
}

/**
 * Franchise warnings of a period (`contract.franchise`): once when the
 * billable time reaches 80% of the franchise and once when it goes into
 * overage, to whoever created the contract and the workspace admins. Each
 * threshold is claimed with a stamp on the period, so it is announced once
 * per period. Never fails the consolidation.
 */
async function warnFranchise(
  contract: SdContractWithRelations,
  period: SdContractPeriodWithRelations,
): Promise<void> {
  if (period.includedMinutes <= 0) return
  const overage = period.overageMinutes > 0
  const nearLimit =
    period.billableMinutes >=
    period.includedMinutes * SD_FRANCHISE_WARNING_RATIO
  if (!overage && !nearLimit) return

  const warn = (reason: string) =>
    logger.warn('servicedesk.billing.franchise_notify_failed', {
      workspaceId: contract.workspaceId,
      contractId: contract.id,
      periodId: period.id,
      reason,
    })

  const now = new Date()
  const kind = overage ? 'overage' : 'franchise'
  const claimed = await SdContractPeriodRepository.claimWarning(
    period.id,
    kind,
    now,
  )
  if (!claimed.ok) return warn(claimed.error.code)
  if (!claimed.value) return
  // Going straight into overage also settles the 80% warning: it would only
  // be old news later on.
  if (overage) {
    await SdContractPeriodRepository.claimWarning(period.id, 'franchise', now)
  }

  const admins = await NotificationAudienceRepository.listPrivilegedUserIds(
    contract.workspaceId,
    ADMIN_CAP,
  )
  if (!admins.ok) return warn(admins.error.code)

  const label = `${contract.name} (${contract.customer.name})`
  const usage = `${hours(period.billableMinutes)} de ${hours(period.includedMinutes)}`
  const sent = await notifySdUsers({
    workspaceId: contract.workspaceId,
    event: 'contract.franchise',
    userIds: [contract.createdById, ...admins.value],
    title: overage
      ? `Contrato em excedente: ${label}`
      : `Franquia em 80%: ${label}`,
    body: overage
      ? `Consumo de ${usage} da franquia — ${hours(period.overageMinutes)} já são cobradas como excedente.`
      : `Consumo de ${usage} da franquia neste período.`,
    hrefFor: (slug) => `/${slug}/servicedesk/settings?tab=contracts`,
    meta: { contractId: contract.id, periodId: period.id, kind },
  })
  if (!sent.ok) warn(sent.error.code)
}

export const SdContractBillingService = {
  /**
   * Período aberto do ciclo que contém `at` (abre se ainda não existe).
   * Período fechado devolve `SD_CONTRACT_PERIOD_CLOSED` — nada mais entra
   * nele.
   */
  async ensureOpenPeriod(
    contract: SdContractWithRelations,
    at: Date,
  ): Promise<Result<SdContractPeriodWithRelations>> {
    const opened = await openCurrentPeriod(contract, at)
    if (!opened.ok) return opened
    return ok(opened.value.period)
  },

  /**
   * Recalcula os totais do período a partir dos apontamentos fechados da
   * janela (franquia, usado, faturável, excedente, acumulado e valor) e
   * vincula os apontamentos ao período. Com `closedById`, fecha o período.
   */
  async consolidate(
    contract: SdContractWithRelations,
    period: SdContractPeriodWithRelations,
    options: { closedById?: string | null; close?: boolean } = {},
  ): Promise<Result<SdContractPeriodWithRelations>> {
    const entries = await SdTimeEntryRepository.listForPeriod(
      contract.id,
      period.periodStart,
      period.periodEnd,
    )
    if (!entries.ok) return entries

    const priced = entries.value.map((entry) => {
      const rate = resolveSdEntryRate(contract, contract.rates, {
        ticketType: entry.ticket.type,
        priorityId: entry.ticket.priorityId,
        window: entry.window,
      })
      return {
        minutes: entry.minutes,
        billable: entry.billable,
        overtimeRate: rate.overtimeRate,
        multiplier: rate.multiplier,
      }
    })

    const totals = computeSdPeriodTotals(
      priced,
      contract,
      period.includedMinutes,
    )

    const linked = await SdTimeEntryRepository.linkPeriod(
      entries.value.map((entry) => entry.id),
      period.id,
    )
    if (!linked.ok) return linked

    const updated = await SdContractPeriodRepository.update(period.id, {
      usedMinutes: totals.usedMinutes,
      billableMinutes: totals.billableMinutes,
      overageMinutes: totals.overageMinutes,
      carriedMinutes: totals.carriedMinutes,
      amount: totals.amount.toFixed(2),
      ...(options.close
        ? {
            status: 'CLOSED' as const,
            closedAt: new Date(),
            closedById: options.closedById ?? null,
          }
        : {}),
    })
    if (updated.ok) await warnFranchise(contract, updated.value)
    return updated
  },

  /**
   * Tick da fila `servicedesk-billing`: para cada contrato ativo, abre o
   * período do ciclo corrente e fecha os anteriores já vencidos,
   * consolidando os apontamentos. Rodar duas vezes no mesmo dia não muda
   * nada.
   */
  async runTick(now = new Date()): Promise<Result<SdBillingTickResult>> {
    const contracts = await SdContractRepository.listActiveForBilling()
    if (!contracts.ok) return contracts

    let opened = 0
    let closed = 0
    for (const contract of contracts.value) {
      const current = await openCurrentPeriod(contract, now)
      if (current.ok) {
        if (current.value.created) opened += 1
      } else {
        logger.warn('servicedesk.billing.period_open_failed', {
          contractId: contract.id,
          workspaceId: contract.workspaceId,
          code: current.error.code,
        })
      }

      const overdue = await SdContractPeriodRepository.listOverdueOpen(
        contract.id,
        now,
      )
      if (!overdue.ok) {
        logger.warn('servicedesk.billing.overdue_lookup_failed', {
          contractId: contract.id,
          code: overdue.error.code,
        })
        continue
      }
      for (const period of overdue.value) {
        const result = await SdContractBillingService.consolidate(
          contract,
          period,
          { close: true, closedById: null },
        )
        if (!result.ok) {
          logger.warn('servicedesk.billing.period_close_failed', {
            contractId: contract.id,
            periodId: period.id,
            code: result.error.code,
          })
          continue
        }
        closed += 1
        logger.info('servicedesk.billing.period_closed', {
          workspaceId: contract.workspaceId,
          contractId: contract.id,
          periodId: period.id,
          amount: result.value.amount.toFixed(2),
          overageMinutes: result.value.overageMinutes,
        })
      }
    }

    return ok({ contracts: contracts.value.length, opened, closed })
  },
}
