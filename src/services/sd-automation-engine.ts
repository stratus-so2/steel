import type {
  NotificationKind,
  Prisma,
  SdAutomationEvent,
  SdAutomationRule,
} from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { sdConfigNotFound, validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { evaluateSdConditions } from '@/src/lib/servicedesk/conditions'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { SdAutomationRepository } from '@/src/repositories/sd-automation.repository'
import {
  SdTicketRepository,
  type SdTicketWithRelations,
} from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  type SdAutomationAction,
  SdAutomationActionsSchema,
  SdConditionsSchema,
} from '@/src/schemas/sd-rule.schema'
import {
  type SdActor,
  type SdEngineChanges,
  type SdEngineConfig,
  SdTicketEngine,
  sdRecordAuthorId,
  sdSystemActor,
  sdTicketCode,
} from './sd-ticket-engine'
import { escalateSdTicket } from './sd-ticket-escalator'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { SdTicketNotifier } from './sd-ticket-notifier'
import { addSdTicketParticipant } from './sd-ticket-participant.service'
import {
  applySdTemplateDefaults,
  SD_TEMPLATE_DEFAULT_KEYS,
  sdTemplateTasks,
  sdTicketRowFacts,
} from './sd-ticket-rules'

/**
 * Motor de automação do ServiceDesk: `SdAutomationRule` (evento →
 * condições → ações), avaliadas por `position`, com `stopProcessing`.
 *
 * Proteção contra laço: as ações alteram o chamado pelo `SdTicketEngine`,
 * que **não** dispara automações; e uma execução em andamento para o mesmo
 * chamado+evento não reentra. Cada regra executada incrementa
 * `runCount`/`lastRunAt` e grava `automation.applied` na rastreabilidade.
 *
 * Disparado pelo service de chamados (TICKET_CREATED, TICKET_UPDATED,
 * PHASE_CHANGED), pelo worker de SLA (SLA_AT_RISK, SLA_BREACHED) e pelas
 * outras fatias (MESSAGE_RECEIVED, APPROVAL_RESPONDED).
 */

export interface SdAutomationRunResult {
  /** Regras cujas condições casaram. */
  matched: number
  rules: { ruleId: string; executed: string[]; failed: string[] }[]
}

export interface SdAutomationRunOptions {
  /** Usuário que causou o evento (só informativo no log/meta). */
  actorId?: string | null
}

const NOTIFY_KIND: Record<SdAutomationEvent, NotificationKind> = {
  TICKET_CREATED: 'SD_TICKET_MESSAGE',
  TICKET_UPDATED: 'SD_TICKET_MESSAGE',
  PHASE_CHANGED: 'SD_TICKET_MESSAGE',
  MESSAGE_RECEIVED: 'SD_TICKET_MESSAGE',
  APPROVAL_RESPONDED: 'SD_APPROVAL_RESPONDED',
  SLA_AT_RISK: 'SD_SLA_AT_RISK',
  SLA_BREACHED: 'SD_SLA_BREACHED',
}

/** Campos que `set_field` pode alterar (além de `phaseId` e `customFields.*`). */
const SETTABLE_STRING = new Set([
  'channel',
  'priorityId',
  'severityId',
  'impactId',
  'urgencyId',
  'categoryId',
  'subcategoryId',
  'serviceId',
  'classificationId',
  'customerId',
  'companyId',
  'contactId',
  'configItemId',
  'departmentId',
  'assigneeId',
  'requesterId',
  'title',
  'description',
])

const running = new Set<string>()

interface ActionContext {
  event: SdAutomationEvent
  rule: SdAutomationRule
  actor: SdActor
  config: SdEngineConfig
}

function toStringValue(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null
  return String(value)
}

async function reload(t: SdTicketWithRelations) {
  return SdTicketRepository.findById(t.id, t.workspaceId)
}

async function setField(
  t: SdTicketWithRelations,
  field: string,
  value: unknown,
  ctx: ActionContext,
): Promise<Result<SdTicketWithRelations>> {
  const meta = {
    eventMeta: { via: 'automation', ruleId: ctx.rule.id },
    allowClosed: true,
  }
  if (field === 'phaseId') {
    const phaseId = toStringValue(value)
    if (!phaseId) return err(validationError('Fase inválida'))
    return SdTicketEngine.changePhase(t, phaseId, ctx.actor, ctx.config, {
      reason: `automation:${ctx.rule.id}`,
    })
  }
  if (field.startsWith('customFields.')) {
    return SdTicketEngine.update(
      t,
      { customFields: { [field.slice(13)]: value } },
      ctx.actor,
      ctx.config,
      meta,
    )
  }
  if (field === 'tags') {
    const tags = (Array.isArray(value) ? value : value ? [value] : []).map(
      String,
    )
    return SdTicketEngine.update(t, { tags }, ctx.actor, ctx.config, meta)
  }
  if (field === 'escalationLevel') {
    const level = Number(value)
    if (!Number.isInteger(level) || level < 0) {
      return err(validationError('Nível de escalonamento inválido'))
    }
    return SdTicketEngine.update(
      t,
      { escalationLevel: level },
      ctx.actor,
      ctx.config,
      meta,
    )
  }
  if (SETTABLE_STRING.has(field)) {
    const next = toStringValue(value)
    if ((field === 'title' || field === 'channel') && !next) {
      return err(validationError(`"${field}" não pode ficar vazio`))
    }
    return SdTicketEngine.update(
      t,
      { [field]: next } as SdEngineChanges,
      ctx.actor,
      ctx.config,
      meta,
    )
  }
  return err(
    validationError(`O campo "${field}" não pode ser alterado por automação`),
  )
}

async function applyTemplate(
  t: SdTicketWithRelations,
  templateId: string,
  ctx: ActionContext,
): Promise<Result<SdTicketWithRelations>> {
  const tpl = await SdTicketContextRepository.findTemplate(
    t.workspaceId,
    templateId,
  )
  if (!tpl.ok) return tpl
  if (!tpl.value?.active || tpl.value.ticketType !== t.type) {
    return err(sdConfigNotFound())
  }
  // Só preenche o que está vazio no chamado.
  const empty: Record<string, unknown> = {}
  const raw = t as unknown as Record<string, unknown>
  for (const key of SD_TEMPLATE_DEFAULT_KEYS) {
    if (key === 'title') continue
    if (raw[key] === null || raw[key] === undefined) empty[key] = undefined
  }
  const filled = applySdTemplateDefaults(empty, tpl.value.defaults)
  const changes: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(filled)) {
    // Só as chaves vazias no chamado (`empty`): não sobrescreve o preenchido.
    if (key !== 'customFields' && value !== undefined && key in empty) {
      changes[key] = value
    }
  }
  const current = t.customFields as Record<string, unknown>
  const templateFields = (filled.customFields ?? {}) as Record<string, unknown>
  const missingFields = Object.fromEntries(
    Object.entries(templateFields).filter(([k]) => current[k] === undefined),
  )
  if (Object.keys(missingFields).length > 0)
    changes.customFields = missingFields

  const updated = await SdTicketEngine.update(
    t,
    changes as SdEngineChanges,
    ctx.actor,
    ctx.config,
    {
      eventMeta: { via: 'automation', ruleId: ctx.rule.id },
      allowClosed: true,
    },
  )
  if (!updated.ok) return updated
  const tasks = sdTemplateTasks(tpl.value.tasks)
  const authorId = await sdRecordAuthorId(t.workspaceId, ctx.actor)
  if (tasks.length > 0 && authorId) {
    const inserted = await SdAutomationRepository.insertTasks(
      t.workspaceId,
      t.id,
      authorId,
      tasks,
    )
    if (!inserted.ok) return inserted
  }
  return updated
}

async function execute(
  action: SdAutomationAction,
  t: SdTicketWithRelations,
  ctx: ActionContext,
): Promise<Result<SdTicketWithRelations>> {
  const meta = {
    eventMeta: { via: 'automation', ruleId: ctx.rule.id },
    allowClosed: true,
  }
  switch (action.type) {
    case 'set_field':
      return setField(t, action.params.field, action.params.value, ctx)
    case 'assign_department':
      return SdTicketEngine.update(
        t,
        { departmentId: action.params.departmentId },
        ctx.actor,
        ctx.config,
        meta,
      )
    case 'assign_user':
      return SdTicketEngine.update(
        t,
        { assigneeId: action.params.userId },
        ctx.actor,
        ctx.config,
        meta,
      )
    case 'round_robin':
      return SdTicketEngine.roundRobin(
        t,
        ctx.actor,
        ctx.config,
        action.params.departmentId,
      )
    case 'add_participant':
      return addSdTicketParticipant(
        t,
        action.params.userId,
        ctx.actor,
        ctx.config,
      )
    case 'add_tag':
      if (t.tags.includes(action.params.tag)) return ok(t)
      return SdTicketEngine.update(
        t,
        { tags: [...t.tags, action.params.tag] },
        ctx.actor,
        ctx.config,
        meta,
      )
    case 'notify': {
      const p = action.params
      let leads: string[] = []
      if (p.departmentLeads && t.departmentId) {
        const found = await SdTicketContextRepository.listDepartmentLeadIds(
          t.departmentId,
        )
        if (!found.ok) return found
        leads = found.value
      }
      await SdTicketNotifier.notify({
        workspaceId: t.workspaceId,
        userIds: [
          ...p.userIds,
          ...(p.assignee ? [t.assigneeId] : []),
          ...(p.requester ? [t.requesterId] : []),
          ...leads,
        ],
        kind: NOTIFY_KIND[ctx.event],
        ticket: {
          number: t.number,
          code: sdTicketCode(t, ctx.config.prefixes),
          title: t.title,
        },
        title: p.title,
        body: p.message || t.title,
        email: p.email,
      })
      return ok(t)
    }
    case 'post_message': {
      const posted = await SdAutomationRepository.insertSystemMessage({
        workspaceId: t.workspaceId,
        ticketId: t.id,
        body: action.params.body,
        visibility: action.params.visibility,
      })
      if (!posted.ok) return posted
      await recordSdTicketEvent({
        workspaceId: t.workspaceId,
        ticketId: t.id,
        actorKind: 'SYSTEM',
        action: 'message.posted',
        meta: {
          messageId: posted.value.id,
          visibility: action.params.visibility,
          via: 'automation',
          ruleId: ctx.rule.id,
        },
      })
      await publishSdTicketEvent(
        t.workspaceId,
        {
          type: 'ticket.message',
          ticketId: t.id,
          number: t.number,
          at: new Date().toISOString(),
          actorId: null,
          internal: action.params.visibility === 'INTERNAL',
        },
        {
          requesterId: t.requesterId,
          participantIds: t.participants.map((p) => p.userId),
          contactUserId: t.contact?.userId ?? null,
        },
      )
      return ok(t)
    }
    case 'create_task': {
      const authorId = await sdRecordAuthorId(t.workspaceId, ctx.actor)
      if (!authorId) return err(validationError('Sem autor para a tarefa'))
      const p = action.params
      const inserted = await SdAutomationRepository.insertTasks(
        t.workspaceId,
        t.id,
        authorId,
        [
          {
            title: p.title,
            description: p.description ?? null,
            assigneeId: p.assigneeId ?? null,
            dueDate: p.dueInMinutes
              ? new Date(Date.now() + p.dueInMinutes * 60_000)
              : null,
          },
        ],
      )
      if (!inserted.ok) return inserted
      await recordSdTicketEvent({
        workspaceId: t.workspaceId,
        ticketId: t.id,
        actorKind: 'SYSTEM',
        action: 'task.created',
        toValue: p.title,
        meta: { via: 'automation', ruleId: ctx.rule.id },
      })
      return ok(t)
    }
    case 'apply_template':
      return applyTemplate(t, action.params.templateId, ctx)
    case 'escalate': {
      const result = await escalateSdTicket(
        t,
        {
          kind: action.params.kind,
          toDepartmentId: action.params.toDepartmentId,
          toUserId: action.params.toUserId,
          reason: action.params.reason,
          notifyDepartmentLeads: action.params.kind === 'HIERARCHICAL',
          automatic: true,
          ruleId: null,
        },
        ctx.actor,
        ctx.config,
      )
      if (!result.ok) return result
      return ok(result.value.ticket)
    }
  }
}

/**
 * Roda as automações do `event` para o chamado. Nunca lança; regras com
 * condições/ações inválidas são puladas (log). Falha de uma ação não
 * interrompe as demais — vai para `failed` e para o evento.
 */
export async function runSdAutomations(
  event: SdAutomationEvent,
  ticketId: string,
  options: SdAutomationRunOptions = {},
): Promise<Result<SdAutomationRunResult>> {
  const key = `${ticketId}:${event}`
  if (running.has(key)) return ok({ matched: 0, rules: [] })
  running.add(key)
  try {
    const loaded = await SdTicketRepository.findByIdUnscoped(ticketId)
    if (!loaded.ok) return loaded
    let ticket = loaded.value

    const rules = await SdAutomationRepository.listActiveRules(
      ticket.workspaceId,
      event,
    )
    if (!rules.ok) return rules
    if (rules.value.length === 0) return ok({ matched: 0, rules: [] })

    const config = await SdTicketEngine.loadConfig(ticket.workspaceId)
    if (!config.ok) return config

    const actor = sdSystemActor('automation')
    const result: SdAutomationRunResult = { matched: 0, rules: [] }

    for (const rule of rules.value) {
      const conditions = SdConditionsSchema.safeParse(rule.conditions)
      const actions = SdAutomationActionsSchema.safeParse(rule.actions)
      if (!conditions.success || !actions.success) {
        logger.warn('servicedesk.automation.invalid_rule', {
          workspaceId: ticket.workspaceId,
          ruleId: rule.id,
        })
        continue
      }
      if (!evaluateSdConditions(conditions.data, sdTicketRowFacts(ticket))) {
        continue
      }

      result.matched++
      const ctx: ActionContext = { event, rule, actor, config: config.value }
      const executed: string[] = []
      const failed: string[] = []
      for (const action of actions.data) {
        const outcome = await execute(action, ticket, ctx)
        if (outcome.ok) {
          ticket = outcome.value
          executed.push(action.type)
        } else {
          failed.push(`${action.type}:${outcome.error.code}`)
        }
      }
      // Estado atualizado para as próximas regras (participantes, tarefas…).
      const fresh = await reload(ticket)
      if (fresh.ok) ticket = fresh.value

      await SdAutomationRepository.markRun(rule.id, new Date())
      await recordSdTicketEvent({
        workspaceId: ticket.workspaceId,
        ticketId: ticket.id,
        actorKind: 'SYSTEM',
        action: failed.length > 0 ? 'automation.failed' : 'automation.applied',
        meta: {
          ruleId: rule.id,
          ruleName: rule.name,
          event,
          executed,
          failed,
          ...(options.actorId ? { triggeredBy: options.actorId } : {}),
        } satisfies Prisma.InputJsonObject,
      })
      result.rules.push({ ruleId: rule.id, executed, failed })
      if (rule.stopProcessing) break
    }

    if (result.matched > 0) {
      logger.info('servicedesk.automation.run', {
        workspaceId: ticket.workspaceId,
        ticketId,
        event,
        matched: result.matched,
      })
    }
    return ok(result)
  } finally {
    running.delete(key)
  }
}

/**
 * Dispara sem esperar (fluxos de request): erros só no log. Use
 * `runSdAutomations` quando precisar do resultado.
 */
export function fireSdAutomations(
  event: SdAutomationEvent,
  ticketId: string,
  options: SdAutomationRunOptions = {},
): Promise<void> {
  return runSdAutomations(event, ticketId, options).then(
    (result) => {
      if (!result.ok) {
        logger.error('servicedesk.automation.failed', {
          ticketId,
          event,
          reason: result.error.code,
        })
      }
    },
    (error: unknown) => {
      logger.error('servicedesk.automation.crashed', {
        ticketId,
        event,
        message: error instanceof Error ? error.message : String(error),
      })
    },
  )
}
