import type { SdTaskStatus } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { validationError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toSdTicketTaskDTO,
  toSdTicketTaskListDTO,
} from '@/src/mappers/sd-ticket-task.mapper'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import {
  type SdTicketTaskData,
  SdTicketTaskRepository,
} from '@/src/repositories/sd-ticket-task.repository'
import type {
  CreateSdTicketTaskDTO,
  ReorderSdTicketTasksDTO,
  UpdateSdTicketTaskDTO,
} from '@/src/schemas/sd-ticket-task.schema'
import type {
  SdTicketTaskDTO,
  SdTicketTaskListDTO,
} from '@/types/sd-ticket-task'
import { SdTicketEngine } from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { SdTicketNotifier } from './sd-ticket-notifier'
import {
  loadSdTicketTab,
  publishSdTicketTab,
  type SdTicketTabScope,
} from './sd-ticket-tab-support'

const STATUS_ACTION: Record<SdTaskStatus, string> = {
  TODO: 'task.reopened',
  IN_PROGRESS: 'task.started',
  DONE: 'task.completed',
  CANCELED: 'task.canceled',
}

async function assertMember(
  workspaceId: string,
  userId: string | null | undefined,
): Promise<Result<void>> {
  if (!userId) return ok(undefined)
  const outsiders = await SdTicketContextRepository.findNonMembers(
    workspaceId,
    [userId],
  )
  if (!outsiders.ok) return outsiders
  if (outsiders.value.length > 0) {
    return err(validationError('Responsável não é membro do workspace'))
  }
  return ok(undefined)
}

async function notifyAssignee(
  scope: SdTicketTabScope,
  assigneeId: string | null | undefined,
  title: string,
): Promise<void> {
  if (!assigneeId) return
  const { ticket, code, ctx } = scope
  await SdTicketNotifier.notify({
    workspaceId: ticket.workspaceId,
    userIds: [assigneeId],
    excludeUserIds: [ctx.userId],
    kind: 'SD_TICKET_MESSAGE',
    ticket: { number: ticket.number, code, title: ticket.title },
    title: `Tarefa atribuída a você em ${code}`,
    body: title,
  })
}

/** Carimbo de conclusão conforme a mudança de status. */
function completion(
  status: SdTaskStatus | undefined,
  previous: SdTaskStatus | null,
): Pick<SdTicketTaskData, 'completedAt'> {
  if (!status || status === previous) return {}
  return { completedAt: status === 'DONE' ? new Date() : null }
}

/**
 * Tarefas do chamado ("estilo CRM"): só agentes. Modelos de chamado e
 * automações também criam tarefas pelo motor (fatia de chamados).
 */
export const SdTicketTaskService = {
  async list(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketTaskListDTO>> {
    const scope = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'VIEW',
      { agentOnly: true },
    )
    if (!scope.ok) return scope
    const rows = await SdTicketTaskRepository.list(scope.value.ticket.id)
    if (!rows.ok) return rows
    return ok(toSdTicketTaskListDTO(rows.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: CreateSdTicketTaskDTO,
  ): Promise<Result<SdTicketTaskDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'CREATE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const scope = loaded.value
    const member = await assertMember(workspaceId, dto.assigneeId)
    if (!member.ok) return member

    const created = await SdTicketTaskRepository.create({
      workspaceId,
      ticketId: scope.ticket.id,
      createdById: actorId,
      title: dto.title,
      description: dto.description ?? null,
      assigneeId: dto.assigneeId ?? null,
      dueDate: dto.dueDate ?? null,
      status: dto.status,
      ...completion(dto.status, 'TODO'),
    })
    if (!created.ok) return created
    const task = created.value

    await SdTicketEngine.touchActivity(scope.ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: scope.ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'task.created',
      toValue: { id: task.id, label: task.title },
    })
    await notifyAssignee(scope, task.assigneeId, task.title)
    await publishSdTicketTab(scope.ticket, 'ticket.task', actorId, true)
    auditMutation({
      entity: 'sd_ticket_task',
      action: 'create',
      actorId,
      targetId: task.id,
      meta: { workspaceId, ticketId: scope.ticket.id },
    })
    return ok(toSdTicketTaskDTO(task))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    taskId: string,
    dto: UpdateSdTicketTaskDTO,
  ): Promise<Result<SdTicketTaskDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const scope = loaded.value
    const existing = await SdTicketTaskRepository.findById(
      taskId,
      scope.ticket.id,
    )
    if (!existing.ok) return existing
    const member = await assertMember(workspaceId, dto.assigneeId)
    if (!member.ok) return member

    const updated = await SdTicketTaskRepository.update(taskId, {
      ...dto,
      ...completion(dto.status, existing.value.status),
    })
    if (!updated.ok) return updated
    const task = updated.value

    const statusChanged = task.status !== existing.value.status
    await SdTicketEngine.touchActivity(scope.ticket.id)
    await recordSdTicketEvent({
      workspaceId,
      ticketId: scope.ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: statusChanged ? STATUS_ACTION[task.status] : 'task.updated',
      toValue: { id: task.id, label: task.title },
      meta: { fields: Object.keys(dto) },
    })
    if (task.assigneeId !== existing.value.assigneeId) {
      await notifyAssignee(scope, task.assigneeId, task.title)
    }
    await publishSdTicketTab(scope.ticket, 'ticket.task', actorId, true)
    auditMutation({
      entity: 'sd_ticket_task',
      action: 'update',
      actorId,
      targetId: task.id,
      meta: {
        workspaceId,
        ticketId: scope.ticket.id,
        fields: Object.keys(dto),
      },
    })
    return ok(toSdTicketTaskDTO(task))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    taskId: string,
  ): Promise<Result<void>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'DELETE',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value
    const existing = await SdTicketTaskRepository.findById(taskId, ticket.id)
    if (!existing.ok) return existing
    const removed = await SdTicketTaskRepository.delete(taskId)
    if (!removed.ok) return removed

    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'task.deleted',
      fromValue: { id: taskId, label: existing.value.title },
    })
    await publishSdTicketTab(ticket, 'ticket.task', actorId, true)
    auditMutation({
      entity: 'sd_ticket_task',
      action: 'delete',
      actorId,
      targetId: taskId,
      meta: { workspaceId, ticketId: ticket.id },
    })
    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    dto: ReorderSdTicketTasksDTO,
  ): Promise<Result<SdTicketTaskListDTO>> {
    const loaded = await loadSdTicketTab(
      actorId,
      workspaceId,
      ticketRef,
      'EDIT',
      { agentOnly: true, requireOpen: true },
    )
    if (!loaded.ok) return loaded
    const { ticket } = loaded.value
    const current = await SdTicketTaskRepository.list(ticket.id)
    if (!current.ok) return current
    const known = new Set(current.value.map((t) => t.id))
    const ordered = Array.from(new Set(dto.orderedIds))
    if (
      ordered.length !== dto.orderedIds.length ||
      ordered.some((id) => !known.has(id))
    ) {
      return err(validationError('Lista de tarefas inválida'))
    }
    const reordered = await SdTicketTaskRepository.reorder(ticket.id, ordered)
    if (!reordered.ok) return reordered
    const rows = await SdTicketTaskRepository.list(ticket.id)
    if (!rows.ok) return rows

    await publishSdTicketTab(ticket, 'ticket.task', actorId, true)
    auditMutation({
      entity: 'sd_ticket_task',
      action: 'reorder',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, count: ordered.length },
    })
    return ok(toSdTicketTaskListDTO(rows.value))
  },
}
