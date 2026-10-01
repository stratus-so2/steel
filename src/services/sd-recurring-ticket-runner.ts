import type { SdPhaseCategory } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { err, ok, type Result } from '@/src/lib/result'
import {
  nextSdOccurrence,
  sdRecurrenceProblem,
} from '@/src/lib/servicedesk/recurrence'
import { toSdRecurrenceSchedule } from '@/src/mappers/sd-recurring-ticket.mapper'
import { toSdTemplateDefaults } from '@/src/mappers/sd-ticket-template.mapper'
import {
  SdRecurringTicketRepository,
  SdRecurringTicketRunRepository,
  type SdRecurringTicketRunWithTicket,
  type SdRecurringTicketWithRelations,
} from '@/src/repositories/sd-recurring-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import { fireSdAutomations } from './sd-automation-engine'
import {
  type SdEngineConfig,
  type SdEngineCreateInput,
  SdTicketEngine,
  sdSystemActor,
  sdTicketCode,
} from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'

/**
 * Abertura das ocorrências dos chamados recorrentes (manutenção preventiva).
 * O tick da fila `servicedesk-recurring` roda a cada 5 minutos e, para cada
 * regra ativa com `nextRunAt` vencido:
 *
 * 1. reserva a ocorrência `(recurringId, scheduledFor)` — a unicidade no
 *    banco é a trava de idempotência: reprocessar o job não duplica chamado;
 * 2. com `skipIfOpen`, se o chamado da ocorrência anterior ainda estiver
 *    aberto, registra `SKIPPED` com o motivo e não abre nada;
 * 3. abre o chamado pelo `SdTicketEngine` com **ator de sistema**, grava a
 *    rastreabilidade e dispara as automações de `TICKET_CREATED`;
 * 4. recalcula `nextRunAt` pela lib de agenda. **Não faz backfill**: um tick
 *    abre no máximo uma ocorrência por regra e a agenda pula o atraso
 *    acumulado.
 *
 * Uma regra que falha não atrapalha as outras: o erro vira uma ocorrência
 * `FAILED` com o código, e o tick segue.
 */

export interface SdRecurringTickResult {
  workspaces: number
  rules: number
  created: number
  skipped: number
  failed: number
  errors: number
}

/** Quantas regras vencidas um tick processa. */
const BATCH = 200
const MINUTE_MS = 60_000
const SOURCE = 'recurring-ticket'
const FINAL: SdPhaseCategory[] = ['RESOLVED', 'CLOSED', 'CANCELED']

/**
 * Entrada do motor de chamados a partir da regra: os `defaults` (mesma
 * forma do modelo) com cliente, item de configuração, departamento e
 * responsável da rotina por cima, canal `API`.
 */
export function buildSdRecurringTicketInput(
  rule: SdRecurringTicketWithRelations,
): SdEngineCreateInput {
  const defaults = toSdTemplateDefaults(rule.defaults)
  return {
    type: rule.ticketType,
    title: defaults.title?.trim() || rule.name,
    description: defaults.description ?? rule.description ?? undefined,
    channel: 'API',
    templateId: rule.templateId ?? undefined,
    categoryId: defaults.categoryId,
    subcategoryId: defaults.subcategoryId,
    serviceId: defaults.serviceId,
    priorityId: defaults.priorityId,
    impactId: defaults.impactId,
    urgencyId: defaults.urgencyId,
    severityId: defaults.severityId,
    classificationId: defaults.classificationId,
    changeType: defaults.changeType,
    changeRisk: defaults.changeRisk,
    implementationPlan: defaults.implementationPlan,
    rollbackPlan: defaults.rollbackPlan,
    testPlan: defaults.testPlan,
    tags: defaults.tags,
    customFields: defaults.customFields,
    customerId: rule.customerId ?? undefined,
    configItemId: rule.configItemId ?? undefined,
    departmentId: rule.departmentId ?? defaults.departmentId ?? undefined,
    assigneeId: rule.assigneeId ?? undefined,
  }
}

/** Motivo do `SKIPPED` quando a ocorrência anterior continua aberta. */
async function previousStillOpenReason(
  rule: SdRecurringTicketWithRelations,
  config: SdEngineConfig,
): Promise<string | null> {
  const latest = await SdRecurringTicketRunRepository.findLatestWithTicket(
    rule.id,
  )
  if (!latest.ok || !latest.value?.ticket) return null
  const ticket = latest.value.ticket
  if (ticket.deletedAt || FINAL.includes(ticket.phase.category)) return null
  return `O chamado ${sdTicketCode(ticket, config.prefixes)} da ocorrência anterior ainda está aberto`
}

/**
 * Abre (ou pula) uma ocorrência. `null` quando ela já estava registrada —
 * a trava `(recurringId, scheduledFor)` segurou a duplicata.
 */
export async function openSdRecurringOccurrence(options: {
  rule: SdRecurringTicketWithRelations
  scheduledFor: Date
  config: SdEngineConfig
  /** `false` força a abertura mesmo com a anterior aberta ("gerar agora"). */
  honourSkipIfOpen?: boolean
  source?: string
}): Promise<Result<SdRecurringTicketRunWithTicket | null>> {
  const { rule, scheduledFor, config } = options
  const claimed = await SdRecurringTicketRunRepository.claim({
    workspaceId: rule.workspaceId,
    recurringId: rule.id,
    scheduledFor,
  })
  if (!claimed.ok) return claimed
  if (!claimed.value) {
    logger.info('servicedesk.recurring.occurrence_already_recorded', {
      workspaceId: rule.workspaceId,
      recurringId: rule.id,
      scheduledFor: scheduledFor.toISOString(),
    })
    return ok(null)
  }
  const run = claimed.value

  if (options.honourSkipIfOpen !== false && rule.skipIfOpen) {
    const reason = await previousStillOpenReason(rule, config)
    if (reason) {
      return SdRecurringTicketRunRepository.finish(run.id, {
        status: 'SKIPPED',
        reason,
      })
    }
  }

  const created = await SdTicketEngine.create(
    rule.workspaceId,
    buildSdRecurringTicketInput(rule),
    sdSystemActor(options.source ?? SOURCE),
    config,
  )
  if (!created.ok) {
    logger.error('servicedesk.recurring.open_failed', {
      workspaceId: rule.workspaceId,
      recurringId: rule.id,
      scheduledFor: scheduledFor.toISOString(),
      reason: created.error.code,
      message: created.error.message,
    })
    const failed = await SdRecurringTicketRunRepository.finish(run.id, {
      status: 'FAILED',
      reason: `${created.error.code}: ${created.error.message}`,
    })
    if (!failed.ok) return failed
    return err(created.error)
  }

  await recordSdTicketEvent({
    workspaceId: rule.workspaceId,
    ticketId: created.value.id,
    actorKind: 'SYSTEM',
    actorUserId: null,
    action: 'recurring.opened',
    meta: {
      recurringId: rule.id,
      name: rule.name,
      scheduledFor: scheduledFor.toISOString(),
    },
  })
  void fireSdAutomations('TICKET_CREATED', created.value.id)

  return SdRecurringTicketRunRepository.finish(run.id, {
    status: 'CREATED',
    ticketId: created.value.id,
  })
}

/** Grava `lastRunAt` e o próximo disparo (sem backfill do atraso). */
async function advance(
  rule: SdRecurringTicketWithRelations,
  scheduledFor: Date,
  now: Date,
): Promise<void> {
  const schedule = toSdRecurrenceSchedule(rule)
  const anchor = new Date(Math.max(scheduledFor.getTime(), now.getTime()))
  const next = nextSdOccurrence(schedule, anchor)
  const updated = await SdRecurringTicketRepository.update(
    rule.id,
    rule.workspaceId,
    { lastRunAt: now, nextRunAt: next?.runAt ?? null },
  )
  if (!updated.ok) {
    logger.error('servicedesk.recurring.advance_failed', {
      workspaceId: rule.workspaceId,
      recurringId: rule.id,
      reason: updated.error.code,
    })
  }
}

async function runRule(
  rule: SdRecurringTicketWithRelations,
  config: SdEngineConfig,
  now: Date,
  result: SdRecurringTickResult,
): Promise<void> {
  const problem = sdRecurrenceProblem(toSdRecurrenceSchedule(rule))
  if (problem) {
    result.errors++
    logger.warn('servicedesk.recurring.schedule_invalid', {
      workspaceId: rule.workspaceId,
      recurringId: rule.id,
      problem,
    })
    await SdRecurringTicketRepository.update(rule.id, rule.workspaceId, {
      nextRunAt: null,
    })
    return
  }

  // `nextRunAt` é a ocorrência menos a antecedência — o caminho de volta.
  const scheduledFor = new Date(
    (rule.nextRunAt as Date).getTime() + rule.leadTimeMinutes * MINUTE_MS,
  )
  const opened = await openSdRecurringOccurrence({
    rule,
    scheduledFor,
    config,
  })
  if (!opened.ok) result.failed++
  else if (opened.value?.status === 'CREATED') result.created++
  else if (opened.value?.status === 'SKIPPED') result.skipped++

  await advance(rule, scheduledFor, now)
}

export const SdRecurringTicketRunner = {
  /** Tick da fila `servicedesk-recurring` (a cada 5 min). */
  async runTick(now = new Date()): Promise<SdRecurringTickResult> {
    const result: SdRecurringTickResult = {
      workspaces: 0,
      rules: 0,
      created: 0,
      skipped: 0,
      failed: 0,
      errors: 0,
    }

    const due = await SdRecurringTicketRepository.listDue(now, BATCH)
    if (!due.ok) {
      result.errors++
      return result
    }
    if (due.value.length === 0) return result

    const enabled = await SdTicketContextRepository.listEnabledWorkspaceIds()
    if (!enabled.ok) {
      result.errors++
      return result
    }
    const allowed = new Set(enabled.value)
    const configs = new Map<string, SdEngineConfig>()

    for (const rule of due.value) {
      if (!allowed.has(rule.workspaceId)) continue
      result.rules++
      try {
        let config = configs.get(rule.workspaceId)
        if (!config) {
          const loaded = await SdTicketEngine.loadConfig(rule.workspaceId)
          if (!loaded.ok) {
            result.errors++
            continue
          }
          config = loaded.value
          configs.set(rule.workspaceId, config)
          result.workspaces++
        }
        await runRule(rule, config, now, result)
      } catch (error) {
        result.errors++
        logger.error('servicedesk.recurring.rule_failed', {
          workspaceId: rule.workspaceId,
          recurringId: rule.id,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
    return result
  },
}
