import z from 'zod'
import { clearableText } from '@/src/schemas/clearable.schema'
import { SdTicketTypeEnum } from '@/src/schemas/sd-rule.schema'

/**
 * Contrato da API de chamados do ServiceDesk
 * (`/api/workspaces/[id]/servicedesk/tickets/**`). Regras de negócio em
 * `docs/servicedesk/README.md` ("Abertura" e "Mudança de fase") e no
 * `SdTicketService`.
 */

export const SD_TICKET_CHANNELS = [
  'AGENT',
  'PORTAL',
  'EMAIL',
  'WHATSAPP',
  'PHONE',
  'AI',
  'API',
] as const
export const SD_PHASE_CATEGORIES = [
  'NEW',
  'IN_PROGRESS',
  'WAITING',
  'RESOLVED',
  'CLOSED',
  'CANCELED',
] as const
export const SD_CHANGE_TYPES = ['STANDARD', 'NORMAL', 'EMERGENCY'] as const
export const SD_RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'] as const

const id = z.string().min(1).max(64)
const nullableId = id.nullable().optional()
const tag = z.string().trim().min(1).max(50)
const customFields = z.record(z.string().max(64), z.unknown())

/** Campos editáveis comuns a criar e atualizar. */
const editable = {
  impactId: nullableId,
  urgencyId: nullableId,
  priorityId: nullableId,
  severityId: nullableId,
  categoryId: nullableId,
  subcategoryId: nullableId,
  serviceId: nullableId,
  classificationId: nullableId,
  customerId: nullableId,
  companyId: nullableId,
  contactId: nullableId,
  configItemId: nullableId,
  departmentId: nullableId,
  assigneeId: nullableId,
  requesterId: nullableId,
  parentId: nullableId,
  tags: z.array(tag).max(30).optional(),
  customFields: customFields.optional(),
  changeType: z.enum(SD_CHANGE_TYPES).nullable().optional(),
  changeRisk: z.enum(SD_RISK_LEVELS).nullable().optional(),
  plannedStartAt: z.coerce.date().nullable().optional(),
  plannedEndAt: z.coerce.date().nullable().optional(),
  implementationPlan: clearableText(20_000),
  rollbackPlan: clearableText(20_000),
  testPlan: clearableText(20_000),
  rootCause: clearableText(20_000),
  workaround: clearableText(20_000),
  knownError: z.boolean().optional(),
}

export const CreateSdTicketSchema = z
  .object({
    type: SdTicketTypeEnum,
    title: z.string().trim().min(1, 'Título é obrigatório').max(200),
    /** HTML do editor rico — sanitizado no service. */
    description: z.string().max(100_000).optional(),
    channel: z.enum(SD_TICKET_CHANNELS).optional(),
    templateId: id.optional(),
    /** Fase inicial explícita (senão a `isInitial` do tipo). Só agentes. */
    phaseId: id.optional(),
    ...editable,
  })
  .refine(
    (d) =>
      !d.plannedStartAt ||
      !d.plannedEndAt ||
      d.plannedEndAt.getTime() >= d.plannedStartAt.getTime(),
    {
      message: 'O fim planejado deve ser após o início',
      path: ['plannedEndAt'],
    },
  )

export type CreateSdTicketDTO = z.infer<typeof CreateSdTicketSchema>

export const UpdateSdTicketSchema = z
  .object({
    title: z.string().trim().min(1, 'Título é obrigatório').max(200).optional(),
    description: z.string().max(100_000).nullable().optional(),
    channel: z.enum(SD_TICKET_CHANNELS).optional(),
    solution: clearableText(20_000),
    solutionClassificationId: nullableId,
    csatScore: z.number().int().min(1).max(5).nullable().optional(),
    csatComment: clearableText(2000),
    ...editable,
  })
  .refine((d) => Object.keys(d).length > 0, {
    message: 'Informe ao menos um campo',
  })
  .refine(
    (d) =>
      !d.plannedStartAt ||
      !d.plannedEndAt ||
      d.plannedEndAt.getTime() >= d.plannedStartAt.getTime(),
    {
      message: 'O fim planejado deve ser após o início',
      path: ['plannedEndAt'],
    },
  )

export type UpdateSdTicketDTO = z.infer<typeof UpdateSdTicketSchema>

export const MoveSdTicketPhaseSchema = z.object({
  phaseId: id,
  /** Preenche a solução junto (útil ao mover para RESOLVED). */
  solution: z.string().trim().min(1).max(20_000).optional(),
  solutionClassificationId: id.optional(),
  /** Motivo/comentário registrado no evento de rastreabilidade. */
  comment: z.string().trim().max(2000).optional(),
})

export type MoveSdTicketPhaseDTO = z.infer<typeof MoveSdTicketPhaseSchema>

export const SetSdTicketParentSchema = z.object({ parentId: id.nullable() })
export type SetSdTicketParentDTO = z.infer<typeof SetSdTicketParentSchema>

export const BulkUpdateSdTicketsSchema = z
  .object({
    ids: z.array(id).min(1).max(200),
    assigneeId: nullableId,
    departmentId: nullableId,
    priorityId: nullableId,
    phaseId: id.optional(),
  })
  .refine(
    (d) =>
      d.assigneeId !== undefined ||
      d.departmentId !== undefined ||
      d.priorityId !== undefined ||
      d.phaseId !== undefined,
    { message: 'Informe o que alterar' },
  )

export type BulkUpdateSdTicketsDTO = z.infer<typeof BulkUpdateSdTicketsSchema>

/* ------------------------------------------------------------------ */
/* Listagem                                                             */
/* ------------------------------------------------------------------ */

export const SD_TICKET_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'lastActivityAt',
  'number',
  'title',
  'priority',
  'resolutionDueAt',
  'firstResponseDueAt',
] as const

/** Aceita `a,b` ou lista (query repetida). Vazio → ausente. */
function csv(value: unknown): unknown {
  if (value === undefined || value === null || value === '') return undefined
  const items = (Array.isArray(value) ? value : [value])
    .flatMap((v) => String(v).split(','))
    .map((v) => v.trim())
    .filter(Boolean)
  return items.length > 0 ? items : undefined
}

function blank(value: unknown): unknown {
  return value === '' || value === null ? undefined : value
}

function bool(value: unknown): unknown {
  if (value === 'true' || value === '1') return true
  if (value === 'false' || value === '0') return false
  return blank(value)
}

const idList = z.preprocess(csv, z.array(id).max(100).optional())
const optionalId = z.preprocess(blank, id.optional())
const optionalDate = z.preprocess(blank, z.coerce.date().optional())

export const ListSdTicketsSchema = z.object({
  view: z.preprocess(blank, z.enum(['list', 'kanban']).default('list')),
  type: z.preprocess(blank, SdTicketTypeEnum.optional()),
  types: z.preprocess(csv, z.array(SdTicketTypeEnum).optional()),
  phaseIds: idList,
  phaseCategories: z.preprocess(
    csv,
    z.array(z.enum(SD_PHASE_CATEGORIES)).optional(),
  ),
  priorityIds: idList,
  severityIds: idList,
  impactIds: idList,
  urgencyIds: idList,
  departmentIds: idList,
  /** Ids de usuário, `me` (o próprio) e/ou `unassigned` (sem responsável). */
  assigneeIds: idList,
  requesterId: optionalId,
  /** Participante: id de usuário ou `me` (chamados em que participo). */
  participantId: optionalId,
  customerId: optionalId,
  companyId: optionalId,
  contactId: optionalId,
  configItemId: optionalId,
  categoryId: optionalId,
  subcategoryId: optionalId,
  serviceId: optionalId,
  classificationId: optionalId,
  channel: z.preprocess(blank, z.enum(SD_TICKET_CHANNELS).optional()),
  tags: z.preprocess(csv, z.array(tag).max(30).optional()),
  sla: z.preprocess(blank, z.enum(['at_risk', 'breached']).optional()),
  createdFrom: optionalDate,
  createdTo: optionalDate,
  dueFrom: optionalDate,
  dueTo: optionalDate,
  /** Id do pai (itens filhos) ou `none` (só chamados sem pai). */
  parentId: optionalId,
  q: z.preprocess(blank, z.string().trim().max(200).optional()),
  /** Inclui RESOLVED/CLOSED/CANCELED (padrão: só abertos). */
  includeClosed: z.preprocess(bool, z.boolean().default(false)),
  sort: z.preprocess(blank, z.enum(SD_TICKET_SORT_FIELDS).default('createdAt')),
  order: z.preprocess(blank, z.enum(['asc', 'desc']).default('desc')),
  page: z.preprocess(blank, z.coerce.number().int().min(1).default(1)),
  pageSize: z.preprocess(
    blank,
    z.coerce.number().int().min(1).max(200).default(50),
  ),
  /** Paginação por cursor (id do último item). Tem precedência sobre `page`. */
  cursor: optionalId,
  /** Kanban: itens por coluna. */
  columnLimit: z.preprocess(
    blank,
    z.coerce.number().int().min(1).max(200).default(50),
  ),
})

export type ListSdTicketsDTO = z.infer<typeof ListSdTicketsSchema>

const LIST_KEYS = Object.keys(ListSdTicketsSchema.shape)

/**
 * Monta o objeto de entrada a partir da query string: chaves repetidas
 * viram lista (`?phaseIds=a&phaseIds=b`), CSV também é aceito.
 */
export function sdTicketListQuery(
  params: URLSearchParams,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of LIST_KEYS) {
    const values = params.getAll(key)
    if (values.length === 0) continue
    out[key] = values.length === 1 ? values[0] : values
  }
  return out
}

export const ListSdTicketEventsSchema = z.object({
  cursor: optionalId,
  limit: z.preprocess(
    blank,
    z.coerce.number().int().min(1).max(200).default(50),
  ),
})

export type ListSdTicketEventsDTO = z.infer<typeof ListSdTicketEventsSchema>
