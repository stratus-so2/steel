import { auditMutation } from '@/lib/axiom/audit'
import {
  forbidden,
  sdNotAgent,
  sdPortalDisabled,
  sdTicketForbidden,
  validationError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { indexSearchDocument } from '@/src/lib/search/index-hooks'
import { publishSdTicketEvent } from '@/src/lib/servicedesk/realtime'
import { startOfSdLocalDay } from '@/src/lib/servicedesk/sla'
import { parseSdTicketCode } from '@/src/lib/servicedesk/ticket-code'
import { toSdTicketDTO } from '@/src/mappers/sd-ticket.mapper'
import {
  buildSdTicketWhere,
  type SdTicketFilters,
  SdTicketRepository,
  type SdTicketWithRelations,
  sdRequesterScope,
} from '@/src/repositories/sd-ticket.repository'
import { SdTicketContextRepository } from '@/src/repositories/sd-ticket-context.repository'
import type {
  BulkUpdateSdTicketsDTO,
  CreateSdTicketDTO,
  ListSdTicketsDTO,
  MoveSdTicketPhaseDTO,
  SetSdTicketParentDTO,
  UpdateSdTicketDTO,
} from '@/src/schemas/sd-ticket.schema'
import type {
  SdBulkUpdateResultDTO,
  SdTicketDTO,
  SdTicketKanbanDTO,
  SdTicketPageDTO,
  SdTicketSummaryDTO,
} from '@/types/sd-ticket'
import type { PermissionAction } from '../lib/permissions'
import { SdAccess, type SdAccessContext } from './sd-access'
import { runSdAutomations } from './sd-automation-engine'
import {
  type SdEngineChanges,
  type SdEngineConfig,
  SdTicketEngine,
  sdUserActor,
} from './sd-ticket-engine'
import { recordSdTicketEvent } from './sd-ticket-event-recorder'
import { canViewSdTicket } from './sd-ticket-visibility'

/** Campos que o solicitante (portal) pode informar ao abrir. */
const PORTAL_CREATE_FIELDS = [
  'type',
  'title',
  'description',
  'templateId',
  'categoryId',
  'subcategoryId',
  'serviceId',
  'urgencyId',
  'configItemId',
  'customFields',
] as const

/** Campos que o solicitante pode alterar depois. */
const REQUESTER_EDIT_FIELDS = new Set([
  'title',
  'description',
  'csatScore',
  'csatComment',
])
const CSAT_FIELDS = new Set(['csatScore', 'csatComment'])
const TIMEZONE = 'America/Sao_Paulo'

interface Loaded {
  ctx: SdAccessContext
  config: SdEngineConfig
}

async function access(
  actorId: string,
  workspaceId: string,
  action: PermissionAction,
): Promise<Result<Loaded>> {
  const ctx = await SdAccess.resolve(actorId, workspaceId, {
    resource: 'sd-tickets',
    action,
  })
  if (!ctx.ok) return ctx
  const config = await SdTicketEngine.loadConfig(workspaceId)
  if (!config.ok) return config
  return ok({ ctx: ctx.value, config: config.value })
}

async function accessTicket(
  actorId: string,
  workspaceId: string,
  ticketRef: string,
  action: PermissionAction,
): Promise<Result<Loaded & { ticket: SdTicketWithRelations }>> {
  const loaded = await access(actorId, workspaceId, action)
  if (!loaded.ok) return loaded
  const ticket = await SdTicketEngine.resolveRef(
    workspaceId,
    ticketRef,
    loaded.value.config.prefixes,
  )
  if (!ticket.ok) return ticket
  if (!canViewSdTicket(loaded.value.ctx, ticket.value)) {
    return err(sdTicketForbidden())
  }
  return ok({ ...loaded.value, ticket: ticket.value })
}

function dto(t: SdTicketWithRelations, loaded: Loaded): SdTicketDTO {
  return toSdTicketDTO(t, {
    prefixes: loaded.config.prefixes,
    atRiskPercent: loaded.config.settings.slaAtRiskPercent,
    audience: loaded.ctx.isAgent ? 'agent' : 'requester',
  })
}

/** Recarrega depois das automações (que podem ter mudado o chamado). */
async function afterAutomations(
  t: SdTicketWithRelations,
  event: 'TICKET_CREATED' | 'TICKET_UPDATED' | 'PHASE_CHANGED',
  actorId: string,
): Promise<SdTicketWithRelations> {
  const run = await runSdAutomations(event, t.id, { actorId })
  if (!run.ok || run.value.matched === 0) return t
  const fresh = await SdTicketRepository.findById(t.id, t.workspaceId)
  return fresh.ok ? fresh.value : t
}

function resolveFilters(
  q: ListSdTicketsDTO,
  ctx: SdAccessContext,
  config: SdEngineConfig,
): SdTicketFilters {
  const assignees = q.assigneeIds ?? []
  const parsedCode = q.q ? parseSdTicketCode(q.q, config.prefixes) : null
  return {
    types: q.types ?? (q.type ? [q.type] : undefined),
    phaseIds: q.phaseIds,
    phaseCategories: q.phaseCategories,
    priorityIds: q.priorityIds,
    severityIds: q.severityIds,
    impactIds: q.impactIds,
    urgencyIds: q.urgencyIds,
    departmentIds: q.departmentIds,
    assigneeIds: assignees
      .filter((id) => id !== 'unassigned')
      .map((id) => (id === 'me' ? ctx.userId : id)),
    includeUnassigned: assignees.includes('unassigned'),
    requesterId: q.requesterId === 'me' ? ctx.userId : q.requesterId,
    participantId: q.participantId === 'me' ? ctx.userId : q.participantId,
    customerId: q.customerId,
    companyId: q.companyId,
    contactId: q.contactId,
    configItemId: q.configItemId,
    categoryId: q.categoryId,
    subcategoryId: q.subcategoryId,
    serviceId: q.serviceId,
    classificationId: q.classificationId,
    channel: q.channel,
    tags: q.tags,
    sla: q.sla,
    riskLevel: q.riskLevel,
    createdFrom: q.createdFrom,
    createdTo: q.createdTo,
    dueFrom: q.dueFrom,
    dueTo: q.dueTo,
    parentId: q.parentId === 'none' ? null : q.parentId,
    q: q.q,
    qNumber: parsedCode?.number,
    includeClosed: q.includeClosed,
    visibleToUserId: ctx.isAgent ? undefined : ctx.userId,
  }
}

function pick<T extends object, K extends keyof T>(
  source: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>
  for (const key of keys) if (source[key] !== undefined) out[key] = source[key]
  return out
}

export const SdTicketService = {
  /** Lista paginada (página ou cursor). Solicitante vê só os próprios. */
  async list(
    actorId: string,
    workspaceId: string,
    query: ListSdTicketsDTO,
  ): Promise<Result<SdTicketPageDTO>> {
    const loaded = await access(actorId, workspaceId, 'VIEW')
    if (!loaded.ok) return loaded
    const { ctx, config } = loaded.value
    const where = buildSdTicketWhere(
      workspaceId,
      resolveFilters(query, ctx, config),
      new Date(),
    )
    const page = await SdTicketRepository.list({
      where,
      sort: { field: query.sort, order: query.order },
      page: query.page,
      pageSize: query.pageSize,
      cursor: query.cursor,
    })
    if (!page.ok) return page
    return ok({
      items: page.value.items.map((t) => dto(t, loaded.value)),
      total: page.value.total,
      page: query.cursor ? 1 : query.page,
      pageSize: query.pageSize,
      nextCursor: page.value.nextCursor,
    })
  },

  /** Quadro kanban de um tipo: uma coluna por fase ativa, com contagem. */
  async kanban(
    actorId: string,
    workspaceId: string,
    query: ListSdTicketsDTO,
  ): Promise<Result<SdTicketKanbanDTO>> {
    const type = query.type ?? query.types?.[0]
    if (!type)
      return err(validationError('Informe o tipo de chamado do quadro'))
    const loaded = await access(actorId, workspaceId, 'VIEW')
    if (!loaded.ok) return loaded
    const { ctx, config } = loaded.value

    const phases = await SdTicketContextRepository.listPhases(workspaceId, type)
    if (!phases.ok) return phases
    const visible = query.phaseIds?.length
      ? phases.value.filter((p) => query.phaseIds?.includes(p.id))
      : phases.value

    const where = buildSdTicketWhere(
      workspaceId,
      {
        ...resolveFilters(query, ctx, config),
        types: [type],
        phaseIds: undefined,
        phaseCategories: undefined,
        includeClosed: true,
      },
      new Date(),
    )
    const columns = await SdTicketRepository.kanban({
      where,
      phaseIds: visible.map((p) => p.id),
      sort: { field: query.sort, order: query.order },
      take: query.columnLimit,
    })
    if (!columns.ok) return columns
    return ok({
      type,
      columns: visible.map((phase, i) => ({
        phase: {
          id: phase.id,
          name: phase.name,
          color: phase.color,
          category: phase.category,
          completionPercent: phase.completionPercent,
          position: phase.position,
          wipLimit: phase.wipLimit,
        },
        count: columns.value[i].count,
        items: columns.value[i].items.map((t) => dto(t, loaded.value)),
      })),
    })
  },

  /** Números do painel inicial do ServiceDesk. */
  async summary(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdTicketSummaryDTO>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId, {
      resource: 'sd-tickets',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const now = new Date()
    return SdTicketRepository.summary({
      workspaceId,
      actorId,
      scope: ctx.value.isAgent ? undefined : sdRequesterScope(actorId),
      todayStart: startOfSdLocalDay(now, TIMEZONE),
      now,
    })
  },

  /** Por id, número ou código (`INC-000123`). */
  async get(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<SdTicketDTO>> {
    const loaded = await accessTicket(actorId, workspaceId, ticketRef, 'VIEW')
    if (!loaded.ok) return loaded
    return ok(dto(loaded.value.ticket, loaded.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    input: CreateSdTicketDTO,
  ): Promise<Result<SdTicketDTO>> {
    const loaded = await access(actorId, workspaceId, 'CREATE')
    if (!loaded.ok) return loaded
    const { ctx, config } = loaded.value

    let engineInput: Parameters<typeof SdTicketEngine.create>[1]
    if (ctx.isAgent) {
      engineInput = { ...input, channel: input.channel ?? 'AGENT' }
    } else {
      if (!config.settings.portalEnabled) return err(sdPortalDisabled())
      if (!config.settings.portalTicketTypes.includes(input.type)) {
        return err(
          sdTicketForbidden(
            'Este tipo de chamado não pode ser aberto pelo portal',
          ),
        )
      }
      engineInput = {
        ...pick(input, PORTAL_CREATE_FIELDS),
        type: input.type,
        title: input.title,
        channel: 'PORTAL',
        requesterId: actorId,
        portal: true,
      }
    }

    const created = await SdTicketEngine.create(
      workspaceId,
      engineInput,
      sdUserActor(ctx),
      config,
    )
    if (!created.ok) {
      auditMutation({
        entity: 'sd_ticket',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: created.error.code,
        meta: { workspaceId },
      })
      return created
    }
    auditMutation({
      entity: 'sd_ticket',
      action: 'create',
      actorId,
      targetId: created.value.id,
      meta: {
        workspaceId,
        type: created.value.type,
        channel: created.value.channel,
      },
    })
    const ticket = await afterAutomations(
      created.value,
      'TICKET_CREATED',
      actorId,
    )
    return ok(dto(ticket, loaded.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    input: UpdateSdTicketDTO,
  ): Promise<Result<SdTicketDTO>> {
    const loaded = await accessTicket(actorId, workspaceId, ticketRef, 'EDIT')
    if (!loaded.ok) return loaded
    const { ctx, config, ticket } = loaded.value
    // `confirmChangeSchedule` não é campo do chamado: vira opção do motor.
    const { confirmChangeSchedule, ...changes } = input
    const fields = Object.keys(changes).filter(
      (k) => (changes as Record<string, unknown>)[k] !== undefined,
    )

    if (!ctx.isAgent) {
      if (fields.some((f) => !REQUESTER_EDIT_FIELDS.has(f))) {
        return err(
          sdTicketForbidden(
            'Solicitantes só podem alterar título, descrição e a avaliação',
          ),
        )
      }
      const isDone = ['RESOLVED', 'CLOSED'].includes(ticket.phase.category)
      if (fields.some((f) => CSAT_FIELDS.has(f)) && !isDone) {
        return err(
          validationError('A avaliação só é possível após a resolução'),
        )
      }
    } else if (fields.some((f) => CSAT_FIELDS.has(f))) {
      return err(sdTicketForbidden('Só o solicitante avalia o atendimento'))
    }

    const updated = await SdTicketEngine.update(
      ticket,
      changes as SdEngineChanges,
      sdUserActor(ctx),
      config,
      { confirmChangeSchedule },
    )
    if (!updated.ok) return updated
    auditMutation({
      entity: 'sd_ticket',
      action: 'update',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, fields },
    })
    const after =
      updated.value === ticket
        ? ticket
        : await afterAutomations(updated.value, 'TICKET_UPDATED', actorId)
    return ok(dto(after, loaded.value))
  },

  /** Mudança de fase (só agentes). */
  async movePhase(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    input: MoveSdTicketPhaseDTO,
  ): Promise<Result<SdTicketDTO>> {
    const loaded = await accessTicket(actorId, workspaceId, ticketRef, 'EDIT')
    if (!loaded.ok) return loaded
    const { ctx, config, ticket } = loaded.value
    if (!ctx.isAgent) return err(sdNotAgent())

    const moved = await SdTicketEngine.changePhase(
      ticket,
      input.phaseId,
      sdUserActor(ctx),
      config,
      {
        solution: input.solution,
        solutionClassificationId: input.solutionClassificationId,
        comment: input.comment,
      },
    )
    if (!moved.ok) return moved
    if (moved.value === ticket) return ok(dto(ticket, loaded.value))
    auditMutation({
      entity: 'sd_ticket',
      action: 'update',
      actorId,
      targetId: ticket.id,
      meta: {
        workspaceId,
        op: 'phase',
        from: ticket.phaseId,
        to: moved.value.phaseId,
      },
    })
    const after = await afterAutomations(moved.value, 'PHASE_CHANGED', actorId)
    return ok(dto(after, loaded.value))
  },

  /** Alteração em massa do quadro (responsável, departamento, prioridade, fase). */
  async bulkUpdate(
    actorId: string,
    workspaceId: string,
    input: BulkUpdateSdTicketsDTO,
  ): Promise<Result<SdBulkUpdateResultDTO>> {
    const loaded = await access(actorId, workspaceId, 'EDIT')
    if (!loaded.ok) return loaded
    const { ctx, config } = loaded.value
    if (!ctx.isAgent) return err(sdNotAgent())
    const actor = sdUserActor(ctx)

    const changes: SdEngineChanges = {}
    if (input.assigneeId !== undefined) changes.assigneeId = input.assigneeId
    if (input.departmentId !== undefined)
      changes.departmentId = input.departmentId
    if (input.priorityId !== undefined) changes.priorityId = input.priorityId

    const result: SdBulkUpdateResultDTO = { updated: [], failed: [] }
    for (const id of Array.from(new Set(input.ids))) {
      const ticket = await SdTicketRepository.findById(id, workspaceId)
      if (!ticket.ok) {
        result.failed.push({
          id,
          code: ticket.error.code,
          message: ticket.error.message,
        })
        continue
      }
      let current = ticket.value
      const updated = await SdTicketEngine.update(
        current,
        changes,
        actor,
        config,
      )
      if (!updated.ok) {
        result.failed.push({
          id,
          code: updated.error.code,
          message: updated.error.message,
        })
        continue
      }
      if (updated.value !== current) {
        current = await afterAutomations(
          updated.value,
          'TICKET_UPDATED',
          actorId,
        )
      }
      if (input.phaseId) {
        const moved = await SdTicketEngine.changePhase(
          current,
          input.phaseId,
          actor,
          config,
        )
        if (!moved.ok) {
          result.failed.push({
            id,
            code: moved.error.code,
            message: moved.error.message,
          })
          continue
        }
        if (moved.value !== current) {
          await afterAutomations(moved.value, 'PHASE_CHANGED', actorId)
        }
      }
      result.updated.push(id)
    }
    auditMutation({
      entity: 'sd_ticket',
      action: 'update',
      actorId,
      meta: {
        workspaceId,
        op: 'bulk',
        updated: result.updated.length,
        failed: result.failed.length,
        fields: Object.keys(changes).concat(input.phaseId ? ['phaseId'] : []),
      },
    })
    return ok(result)
  },

  /** Define ou remove o item pai (itens filhos). */
  async setParent(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
    input: SetSdTicketParentDTO,
  ): Promise<Result<SdTicketDTO>> {
    const loaded = await accessTicket(actorId, workspaceId, ticketRef, 'EDIT')
    if (!loaded.ok) return loaded
    const { ctx, config, ticket } = loaded.value
    if (!ctx.isAgent) return err(sdNotAgent())

    let parentId = input.parentId
    if (parentId) {
      const parent = await SdTicketEngine.resolveRef(
        workspaceId,
        parentId,
        config.prefixes,
      )
      if (!parent.ok) return parent
      parentId = parent.value.id
    }
    const updated = await SdTicketEngine.update(
      ticket,
      { parentId },
      sdUserActor(ctx),
      config,
      { allowClosed: true },
    )
    if (!updated.ok) return updated
    auditMutation({
      entity: 'sd_ticket',
      action: 'update',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, op: 'parent', parentId },
    })
    return ok(dto(updated.value, loaded.value))
  },

  /** Exclusão lógica (admins do módulo). */
  async remove(
    actorId: string,
    workspaceId: string,
    ticketRef: string,
  ): Promise<Result<void>> {
    const loaded = await accessTicket(actorId, workspaceId, ticketRef, 'DELETE')
    if (!loaded.ok) return loaded
    const { ctx, ticket } = loaded.value
    if (!ctx.isAdmin) {
      return err(
        forbidden('Apenas administradores do ServiceDesk excluem chamados'),
      )
    }
    const removed = await SdTicketRepository.softDelete(ticket.id)
    if (!removed.ok) return removed
    await recordSdTicketEvent({
      workspaceId,
      ticketId: ticket.id,
      actorKind: 'AGENT',
      actorUserId: actorId,
      action: 'ticket.deleted',
    })
    auditMutation({
      entity: 'sd_ticket',
      action: 'delete',
      actorId,
      targetId: ticket.id,
      meta: { workspaceId, number: ticket.number },
    })
    await publishSdTicketEvent(
      workspaceId,
      {
        type: 'ticket.deleted',
        ticketId: ticket.id,
        number: ticket.number,
        at: new Date().toISOString(),
        actorId,
      },
      {
        requesterId: ticket.requesterId,
        participantIds: ticket.participants.map((p) => p.userId),
        contactUserId: ticket.contact?.userId ?? null,
      },
    )
    void indexSearchDocument('sd-ticket', workspaceId, ticket.id)
    return ok(undefined)
  },
}
