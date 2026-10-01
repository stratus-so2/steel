import type { SdEscalationRule, SdEscalationTrigger } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { sdDepartmentNotFound, validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { sdNotifyTicketOf } from '@/src/lib/servicedesk/notify'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  SdTicketEscalationRepository,
  type SdTicketEscalationWithActor,
} from '@/src/repositories/sd-ticket-escalation.repository'
import { SdEscalationActionsSchema } from '@/src/schemas/sd-rule.schema'
import { notifySdEvent } from './sd-notification.service'
import {
  type SdActor,
  type SdEngineChanges,
  type SdEngineConfig,
  SdTicketEngine,
  sdActorUserId,
  sdTicketCode,
} from './sd-ticket-engine'
import {
  recordSdTicketEvent,
  sdEventActorKind,
} from './sd-ticket-event-recorder'

/**
 * Núcleo do escalonamento (sem autorização), usado pelo escalonamento
 * manual, pela ação `escalate` das automações e pelas regras automáticas
 * do worker (`SdEscalationRule`).
 *
 * - FUNCTIONAL: outro departamento e/ou pessoa; o nível não muda.
 * - HIERARCHICAL: nível + 1; vai para um líder do departamento (se o
 *   responsável já é líder, ou não há líder, sobe para o departamento pai).
 */

export interface SdEscalationInput {
  kind: 'FUNCTIONAL' | 'HIERARCHICAL'
  toDepartmentId?: string | null
  toUserId?: string | null
  reason: string
  notifyUserIds?: string[]
  notifyAssignee?: boolean
  notifyDepartmentLeads?: boolean
  raisePriority?: boolean
  email?: boolean
  automatic?: boolean
  ruleId?: string | null
}

export interface SdEscalationOutcome {
  ticket: SdTicketWithRelations
  escalation: SdTicketEscalationWithActor
}

async function hierarchicalLeads(
  ticket: SdTicketWithRelations,
  departmentId: string | null,
): Promise<Result<{ departmentId: string | null; leads: string[] }>> {
  if (!departmentId) return ok({ departmentId: null, leads: [] })
  const leads =
    await SdTicketContextRepository.listDepartmentLeadIds(departmentId)
  if (!leads.ok) return leads
  const candidates = leads.value.filter((id) => id !== ticket.assigneeId)
  if (candidates.length > 0 && !leads.value.includes(ticket.assigneeId ?? '')) {
    return ok({ departmentId, leads: candidates })
  }
  const department = await SdTicketContextRepository.findDepartment(
    ticket.workspaceId,
    departmentId,
  )
  if (!department.ok) return department
  const parentId = department.value?.parentId ?? null
  if (!parentId) return ok({ departmentId, leads: candidates })
  const parentLeads =
    await SdTicketContextRepository.listDepartmentLeadIds(parentId)
  if (!parentLeads.ok) return parentLeads
  return ok({ departmentId: parentId, leads: parentLeads.value })
}

export async function escalateSdTicket(
  ticket: SdTicketWithRelations,
  input: SdEscalationInput,
  actor: SdActor,
  config: SdEngineConfig,
): Promise<Result<SdEscalationOutcome>> {
  const fromLevel = ticket.escalationLevel
  const changes: SdEngineChanges = {}
  let notifyLeads: string[] = []

  if (input.toDepartmentId) {
    const department = await SdTicketContextRepository.findDepartment(
      ticket.workspaceId,
      input.toDepartmentId,
    )
    if (!department.ok) return department
    if (!department.value) return err(sdDepartmentNotFound())
  }

  if (input.kind === 'FUNCTIONAL') {
    if (!input.toDepartmentId && !input.toUserId) {
      return err(
        validationError(
          'Escalonamento funcional exige um departamento ou responsável',
        ),
      )
    }
    if (input.toDepartmentId && input.toDepartmentId !== ticket.departmentId) {
      changes.departmentId = input.toDepartmentId
      changes.assigneeId = input.toUserId ?? null
    } else if (input.toUserId) {
      changes.assigneeId = input.toUserId
    }
    const leadsOf = input.toDepartmentId ?? ticket.departmentId
    if (input.notifyDepartmentLeads && leadsOf) {
      const leads =
        await SdTicketContextRepository.listDepartmentLeadIds(leadsOf)
      if (!leads.ok) return leads
      notifyLeads = leads.value
    }
  } else {
    const target = await hierarchicalLeads(
      ticket,
      input.toDepartmentId ?? ticket.departmentId,
    )
    if (!target.ok) return target
    changes.escalationLevel = fromLevel + 1
    if (
      target.value.departmentId &&
      target.value.departmentId !== ticket.departmentId
    ) {
      changes.departmentId = target.value.departmentId
    }
    const assignee = input.toUserId ?? target.value.leads[0] ?? null
    if (assignee && assignee !== ticket.assigneeId)
      changes.assigneeId = assignee
    notifyLeads =
      input.notifyDepartmentLeads === false ? [] : target.value.leads
  }

  if (input.raisePriority) {
    const next = await SdTicketContextRepository.findNextPriorityId(
      ticket.workspaceId,
      ticket.priority?.level ?? null,
    )
    if (!next.ok) return next
    if (next.value && next.value !== ticket.priorityId)
      changes.priorityId = next.value
  }

  const updated = await SdTicketEngine.update(ticket, changes, actor, config, {
    touchActivity: !input.automatic,
    eventMeta: { via: 'escalation' },
  })
  if (!updated.ok) return updated
  const after = updated.value

  const escalation = await SdTicketEscalationRepository.create({
    workspaceId: ticket.workspaceId,
    ticketId: ticket.id,
    kind: input.kind,
    fromLevel,
    toLevel: after.escalationLevel,
    fromDepartmentId: ticket.departmentId,
    toDepartmentId: after.departmentId,
    fromAssigneeId: ticket.assigneeId,
    toAssigneeId: after.assigneeId,
    reason: input.reason,
    automatic: input.automatic ?? false,
    ruleId: input.ruleId ?? null,
    createdById: sdActorUserId(actor),
  })
  if (!escalation.ok) return escalation

  await recordSdTicketEvent({
    workspaceId: ticket.workspaceId,
    ticketId: ticket.id,
    actorKind: sdEventActorKind(actor),
    actorUserId: sdActorUserId(actor),
    action: 'escalated',
    fromValue: fromLevel,
    toValue: after.escalationLevel,
    meta: {
      kind: input.kind,
      reason: input.reason,
      automatic: input.automatic ?? false,
      ...(input.ruleId ? { ruleId: input.ruleId } : {}),
    },
  })

  const code = sdTicketCode(after, config.prefixes)
  const sent = await notifySdEvent({
    workspaceId: ticket.workspaceId,
    event: 'ticket.escalated',
    ticket: sdNotifyTicketOf(after, code),
    actorId: sdActorUserId(actor),
    payload: {
      title: `${code} escalonado${input.kind === 'HIERARCHICAL' ? ` (nível ${after.escalationLevel})` : ''}`,
      body: input.reason,
      // Alvos escolhidos no escalonamento, além do público do catálogo.
      userIds: [...(input.notifyUserIds ?? []), ...notifyLeads],
      // `notifyAssignee: false` tira o responsável deste disparo.
      excludeUserIds:
        input.notifyAssignee === false ? [after.assigneeId] : undefined,
      meta: {
        kind: input.kind,
        automatic: input.automatic ?? false,
        // Antes forçava e-mail; hoje o canal é a preferência de cada um.
        ruleEmail: input.email ?? false,
      },
    },
  })
  if (!sent.ok) {
    logger.warn('servicedesk.escalation.notify_failed', {
      workspaceId: ticket.workspaceId,
      ticketId: ticket.id,
      reason: sent.error.code,
    })
  }

  return ok({ ticket: after, escalation: escalation.value })
}

const TRIGGER_LABELS: Record<SdEscalationTrigger, string> = {
  FIRST_RESPONSE_AT_RISK: '1ª resposta em risco',
  FIRST_RESPONSE_BREACHED: '1ª resposta violada',
  RESOLUTION_AT_RISK: 'resolução em risco',
  RESOLUTION_BREACHED: 'resolução violada',
  NO_UPDATE: 'sem atualização',
}

/** Executa uma `SdEscalationRule` num chamado (worker). */
export async function runSdEscalationRule(
  ticket: SdTicketWithRelations,
  rule: SdEscalationRule,
  actor: SdActor,
  config: SdEngineConfig,
): Promise<Result<SdEscalationOutcome>> {
  const actions = SdEscalationActionsSchema.safeParse(rule.actions)
  if (!actions.success) {
    return err(validationError(`Ações inválidas na regra "${rule.name}"`))
  }
  const a = actions.data
  return escalateSdTicket(
    ticket,
    {
      kind: a.kind,
      toDepartmentId: a.reassignDepartmentId,
      toUserId: a.reassignUserId,
      reason: `Regra "${rule.name}": ${TRIGGER_LABELS[rule.trigger]}`,
      notifyUserIds: a.notifyUserIds,
      notifyAssignee: a.notifyAssignee,
      notifyDepartmentLeads: a.notifyDepartmentLeads,
      raisePriority: a.raisePriority,
      email: a.email,
      automatic: true,
      ruleId: rule.id,
    },
    actor,
    config,
  )
}
