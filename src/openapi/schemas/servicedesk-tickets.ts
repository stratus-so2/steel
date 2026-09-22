import { z } from 'zod'
import { dto } from '../common'

/**
 * DTOs dos chamados do ServiceDesk (`types/sd-ticket.d.ts`,
 * `src/mappers/sd-ticket*.mapper.ts`).
 */

const dateTime = () => z.iso.datetime()
const nullableDateTime = () => z.iso.datetime().nullable()

const TicketType = z.enum(['INCIDENT', 'SERVICE_REQUEST', 'CHANGE', 'PROBLEM'])
const PhaseCategory = z.enum([
  'NEW',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELED',
])

export const SdUserSummaryDTO = dto(
  'SdUserSummary',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'Ana Agente' }),
    email: z.string(),
    image: z.string().nullable(),
  }),
)

const SlaTimer = z.object({
  dueAt: nullableDateTime(),
  remainingMinutes: z
    .number()
    .nullable()
    .meta({ description: 'Minutos úteis restantes (negativo = atraso).' }),
  percentUsed: z.number().nullable(),
  state: z.enum(['ok', 'at_risk', 'breached', 'met', 'paused', 'none']),
})

export const SdSlaStateDTO = dto(
  'SdSlaState',
  z.object({ firstResponse: SlaTimer, resolution: SlaTimer }),
)

export const SdPhaseSummaryDTO = dto(
  'SdPhaseSummary',
  z.object({
    id: z.string(),
    name: z.string().meta({ example: 'Em andamento' }),
    color: z.string().nullable(),
    category: PhaseCategory,
    completionPercent: z.number().int(),
    position: z.number().int(),
    wipLimit: z.number().int(),
  }),
)

const LevelRef = z
  .object({
    id: z.string(),
    name: z.string(),
    level: z.number().int(),
    color: z.string().nullable(),
  })
  .nullable()
const NamedRef = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string().nullable().optional(),
  })
  .nullable()
const CustomerRef = z
  .object({
    id: z.string(),
    name: z.string(),
    tradeName: z.string().nullable(),
    document: z
      .string()
      .nullable()
      .meta({ description: 'CPF/CNPJ (dígitos). `null` para solicitantes.' }),
  })
  .nullable()

export const SdTicketDTO = dto(
  'SdTicket',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    number: z.number().int().meta({ example: 123 }),
    code: z.string().meta({ example: 'INC-000123' }),
    type: TicketType,
    title: z.string().meta({ example: 'Servidor de e-mail fora do ar' }),
    description: z
      .string()
      .nullable()
      .meta({ description: 'HTML sanitizado.' }),
    channel: z.enum([
      'AGENT',
      'PORTAL',
      'EMAIL',
      'WHATSAPP',
      'PHONE',
      'AI',
      'API',
    ]),
    phaseId: z.string(),
    phase: SdPhaseSummaryDTO,
    completionPercent: z.number().int(),
    impact: LevelRef,
    urgency: LevelRef,
    priority: LevelRef,
    severity: LevelRef,
    category: NamedRef,
    subcategory: NamedRef,
    service: NamedRef,
    classification: NamedRef,
    solutionClassification: NamedRef,
    solution: z.string().nullable(),
    customer: CustomerRef,
    company: CustomerRef,
    contact: z
      .object({
        id: z.string(),
        name: z.string(),
        email: z.string().nullable(),
        phone: z.string().nullable(),
        userId: z.string().nullable(),
      })
      .nullable(),
    configItem: z
      .object({ id: z.string(), name: z.string(), code: z.string().nullable() })
      .nullable(),
    department: NamedRef,
    assignee: SdUserSummaryDTO.nullable(),
    requester: SdUserSummaryDTO.nullable(),
    createdBy: SdUserSummaryDTO.nullable(),
    participants: z.array(SdUserSummaryDTO),
    parent: z
      .object({
        id: z.string(),
        number: z.number().int(),
        code: z.string(),
        title: z.string(),
        type: TicketType,
      })
      .nullable(),
    childrenCount: z.number().int(),
    templateId: z.string().nullable(),
    whatsappConversationId: z.string().nullable(),
    escalationLevel: z.number().int(),
    tags: z.array(z.string()),
    customFields: z.record(z.string(), z.unknown()),
    slaPolicyId: z.string().nullable(),
    firstResponseDueAt: nullableDateTime(),
    resolutionDueAt: nullableDateTime(),
    firstRespondedAt: nullableDateTime(),
    slaPausedAt: nullableDateTime(),
    slaPausedMinutes: z.number().int(),
    firstResponseBreached: z.boolean(),
    resolutionBreached: z.boolean(),
    sla: SdSlaStateDTO,
    resolvedAt: nullableDateTime(),
    closedAt: nullableDateTime(),
    reopenCount: z.number().int(),
    changeType: z.enum(['STANDARD', 'NORMAL', 'EMERGENCY']).nullable(),
    changeRisk: z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).nullable(),
    plannedStartAt: nullableDateTime(),
    plannedEndAt: nullableDateTime(),
    implementationPlan: z.string().nullable(),
    rollbackPlan: z.string().nullable(),
    testPlan: z.string().nullable(),
    rootCause: z.string().nullable(),
    workaround: z.string().nullable(),
    knownError: z.boolean(),
    aiSummary: z.string().nullable(),
    aiTriage: z.unknown(),
    csatScore: z.number().int().nullable(),
    csatComment: z.string().nullable(),
    lastActivityAt: dateTime(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

export const SdTicketPageDTO = dto(
  'SdTicketPage',
  z.object({
    items: z.array(SdTicketDTO),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
    nextCursor: z.string().nullable(),
  }),
)

export const SdTicketKanbanDTO = dto(
  'SdTicketKanban',
  z.object({
    type: TicketType,
    columns: z.array(
      z.object({
        phase: SdPhaseSummaryDTO,
        count: z.number().int(),
        items: z.array(SdTicketDTO),
      }),
    ),
  }),
)

export const SdTicketSummaryDTO = dto(
  'SdTicketSummary',
  z.object({
    byPhaseCategory: z.record(PhaseCategory, z.number().int()),
    myOpen: z.number().int(),
    unassigned: z.number().int(),
    atRisk: z.number().int(),
    breached: z.number().int(),
    createdToday: z.number().int(),
  }),
)

export const SdBulkUpdateResultDTO = dto(
  'SdBulkUpdateResult',
  z.object({
    updated: z.array(z.string()),
    failed: z.array(
      z.object({ id: z.string(), code: z.string(), message: z.string() }),
    ),
  }),
)

export const SdTicketEventDTO = dto(
  'SdTicketEvent',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    actorKind: z.enum(['AGENT', 'REQUESTER', 'CONTACT', 'AI', 'SYSTEM']),
    actor: SdUserSummaryDTO.nullable(),
    action: z.string().meta({ example: 'phase.changed' }),
    field: z.string().nullable(),
    fromValue: z.unknown(),
    toValue: z.unknown(),
    meta: z.record(z.string(), z.unknown()).nullable(),
    createdAt: dateTime(),
  }),
)

export const SdTicketEventPageDTO = dto(
  'SdTicketEventPage',
  z.object({
    items: z.array(SdTicketEventDTO),
    nextCursor: z.string().nullable(),
  }),
)

export const SdTicketEscalationDTO = dto(
  'SdTicketEscalation',
  z.object({
    id: z.string(),
    ticketId: z.string(),
    kind: z.enum(['FUNCTIONAL', 'HIERARCHICAL']),
    fromLevel: z.number().int(),
    toLevel: z.number().int(),
    fromDepartmentId: z.string().nullable(),
    toDepartmentId: z.string().nullable(),
    fromAssigneeId: z.string().nullable(),
    toAssigneeId: z.string().nullable(),
    reason: z.string(),
    automatic: z.boolean(),
    ruleId: z.string().nullable(),
    createdBy: SdUserSummaryDTO.nullable(),
    createdAt: dateTime(),
  }),
)

export const SdSavedViewDTO = dto(
  'SdSavedView',
  z.object({
    id: z.string(),
    workspaceId: z.string(),
    userId: z.string(),
    name: z.string().meta({ example: 'Minha fila — P1' }),
    ticketType: TicketType.nullable(),
    mode: z.enum(['KANBAN', 'LIST', 'TABLE']),
    filters: z.record(z.string(), z.unknown()),
    sort: z.array(
      z.object({ field: z.string(), order: z.enum(['asc', 'desc']) }),
    ),
    columns: z.array(z.string()),
    shared: z.boolean(),
    position: z.number().int(),
    editable: z.boolean(),
    createdAt: dateTime(),
    updatedAt: dateTime(),
  }),
)

/** Linha `data:` do SSE (`src/lib/servicedesk/realtime.ts`). */
export const SdTicketRealtimeEventDTO = z
  .object({
    type: z.enum([
      'ticket.created',
      'ticket.updated',
      'ticket.phase_changed',
      'ticket.assigned',
      'ticket.deleted',
      'ticket.escalated',
      'ticket.sla',
      'ticket.participants',
      'ticket.message',
      'ticket.task',
      'ticket.cost',
      'ticket.part',
      'ticket.attachment',
      'ticket.approval',
      'ticket.signature',
    ]),
    ticketId: z.string(),
    number: z.number().int(),
    at: dateTime(),
    actorId: z.string().nullable().optional(),
    internal: z.boolean().optional(),
  })
  .meta({ description: 'Aviso de mudança — recarregue pelas rotas normais.' })
