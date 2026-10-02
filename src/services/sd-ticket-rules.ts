import type {
  Prisma,
  SdCustomFieldDefinition,
  SdPhaseCategory,
  SdTicketType,
} from '@prisma/client'
import { ok, type Result } from '@/src/lib/result'
import type { SdConditionFacts } from '@/src/lib/servicedesk/conditions'
import { validateSdCustomFieldValues } from '@/src/lib/servicedesk/custom-fields'
import { sdHtmlToText } from '@/src/lib/servicedesk/html'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'

/**
 * Regras puras do motor de chamados (sem banco): fatos para condições,
 * valores padrão de modelo, campos obrigatórios, campos customizados e o
 * diff legível para a rastreabilidade.
 */

/** Rótulos pt-BR dos campos do chamado (mensagens e rastreabilidade). */
export const SD_TICKET_FIELD_LABELS: Record<string, string> = {
  title: 'Título',
  description: 'Descrição',
  channel: 'Canal',
  phaseId: 'Fase',
  impactId: 'Impacto',
  urgencyId: 'Urgência',
  priorityId: 'Prioridade',
  severityId: 'Severidade',
  categoryId: 'Categoria',
  subcategoryId: 'Subcategoria',
  serviceId: 'Serviço',
  classificationId: 'Classificação',
  solutionClassificationId: 'Classificação da solução',
  solution: 'Solução',
  customerId: 'Cliente',
  companyId: 'Empresa',
  contactId: 'Contato',
  configItemId: 'Item de configuração',
  departmentId: 'Departamento',
  assigneeId: 'Responsável',
  requesterId: 'Solicitante',
  parentId: 'Item pai',
  tags: 'Tags',
  changeType: 'Tipo de mudança',
  changeRisk: 'Risco',
  plannedStartAt: 'Início planejado',
  plannedEndAt: 'Fim planejado',
  implementationPlan: 'Plano de implantação',
  rollbackPlan: 'Plano de retorno',
  testPlan: 'Plano de testes',
  rootCause: 'Causa raiz',
  workaround: 'Solução de contorno',
  knownError: 'Erro conhecido',
  escalationLevel: 'Nível de escalonamento',
  csatScore: 'Satisfação',
  csatComment: 'Comentário da satisfação',
}

export function sdFieldLabel(field: string): string {
  if (field.startsWith('customFields.')) return field.slice(13)
  return SD_TICKET_FIELD_LABELS[field] ?? field
}

/** Chaves de `SdTicketTemplate.defaults` aplicadas na abertura. */
export const SD_TEMPLATE_DEFAULT_KEYS = [
  'title',
  'description',
  'categoryId',
  'subcategoryId',
  'serviceId',
  'priorityId',
  'impactId',
  'urgencyId',
  'severityId',
  'classificationId',
  'departmentId',
  'changeType',
] as const

type TemplateKey = (typeof SD_TEMPLATE_DEFAULT_KEYS)[number]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

/**
 * Preenche com os padrões do modelo só o que não veio na entrada
 * (`undefined`). Campos customizados: entrada sobrepõe o modelo.
 */
export function applySdTemplateDefaults<
  T extends Partial<Record<TemplateKey, unknown>> & {
    customFields?: Record<string, unknown>
  },
>(input: T, rawDefaults: unknown): T {
  const defaults = asRecord(rawDefaults)
  const out: Record<string, unknown> = { ...input }
  for (const key of SD_TEMPLATE_DEFAULT_KEYS) {
    const value = defaults[key]
    if (out[key] === undefined && typeof value === 'string' && value !== '') {
      out[key] = value
    }
  }
  const templateFields = asRecord(defaults.customFields)
  if (Object.keys(templateFields).length > 0 || input.customFields) {
    out.customFields = { ...templateFields, ...(input.customFields ?? {}) }
  }
  return out as T
}

/** Tarefas do modelo (`[{title, description}]`), descartando malformadas. */
export function sdTemplateTasks(
  raw: unknown,
): { title: string; description: string | null }[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map(asRecord)
    .filter((t) => typeof t.title === 'string' && t.title.trim() !== '')
    .map((t) => ({
      title: String(t.title).trim().slice(0, 200),
      description:
        typeof t.description === 'string' ? t.description.slice(0, 5000) : null,
    }))
}

/** Fonte mínima dos fatos avaliados pelas condições das regras. */
export interface SdFactSource {
  type: SdTicketType
  channel?: string | null
  phaseId?: string | null
  phaseCategory?: SdPhaseCategory | null
  priorityId?: string | null
  priorityLevel?: number | null
  severityId?: string | null
  impactId?: string | null
  urgencyId?: string | null
  categoryId?: string | null
  subcategoryId?: string | null
  serviceId?: string | null
  classificationId?: string | null
  customerId?: string | null
  companyId?: string | null
  contactId?: string | null
  configItemId?: string | null
  departmentId?: string | null
  assigneeId?: string | null
  requesterId?: string | null
  tags?: string[]
  title?: string | null
  description?: string | null
  escalationLevel?: number
  changeType?: string | null
  changeRisk?: string | null
  customFields?: unknown
}

export function buildSdTicketFacts(src: SdFactSource): SdConditionFacts {
  return {
    type: src.type,
    channel: src.channel ?? null,
    phaseId: src.phaseId ?? null,
    phaseCategory: src.phaseCategory ?? null,
    priorityId: src.priorityId ?? null,
    priorityLevel: src.priorityLevel ?? null,
    severityId: src.severityId ?? null,
    impactId: src.impactId ?? null,
    urgencyId: src.urgencyId ?? null,
    categoryId: src.categoryId ?? null,
    subcategoryId: src.subcategoryId ?? null,
    serviceId: src.serviceId ?? null,
    classificationId: src.classificationId ?? null,
    customerId: src.customerId ?? null,
    companyId: src.companyId ?? null,
    contactId: src.contactId ?? null,
    configItemId: src.configItemId ?? null,
    departmentId: src.departmentId ?? null,
    assigneeId: src.assigneeId ?? null,
    requesterId: src.requesterId ?? null,
    tags: src.tags ?? [],
    title: src.title ?? null,
    description: src.description ? sdHtmlToText(src.description) : null,
    escalationLevel: src.escalationLevel ?? 0,
    changeType: src.changeType ?? null,
    changeRisk: src.changeRisk ?? null,
    customFields: asRecord(src.customFields),
  }
}

/** Fatos de um chamado persistido. */
export function sdTicketRowFacts(t: SdTicketWithRelations): SdConditionFacts {
  return buildSdTicketFacts({
    ...t,
    phaseCategory: t.phase.category,
    priorityLevel: t.priority?.level ?? null,
  })
}

function isBlank(value: unknown): boolean {
  if (value === null || value === undefined) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/**
 * `requiredFields` de uma fase que estão vazios no estado dado. Aceita
 * nomes de campo do chamado e `customFields.<key>`.
 */
export function sdMissingRequiredFields(
  required: readonly string[],
  state: Record<string, unknown>,
): string[] {
  const custom = asRecord(state.customFields)
  return required.filter((field) =>
    field.startsWith('customFields.')
      ? isBlank(custom[field.slice(13)])
      : isBlank(state[field]),
  )
}

/**
 * Campos customizados do chamado contra as definições (entidade TICKET),
 * via `validateSdCustomFieldValues` (fatia de configuração).
 *
 * - Abertura (`checkRequired`): aplica valores padrão e exige obrigatórios
 *   aplicáveis ao tipo/categorias.
 * - Edição: valida o objeto já mesclado em modo parcial; limpar (`null`/`''`)
 *   um campo opcional remove a chave, limpar um obrigatório é erro.
 */
export function validateSdTicketCustomFields(
  defs: SdCustomFieldDefinition[],
  values: Record<string, unknown>,
  opts: {
    type: SdTicketType
    categoryIds: (string | null | undefined)[]
    checkRequired: boolean
  },
): Result<Prisma.JsonObject> {
  const result = validateSdCustomFieldValues(defs, values, {
    ticketType: opts.type,
    categoryIds: opts.categoryIds.filter((id): id is string => !!id),
    partial: !opts.checkRequired,
  })
  if (!result.ok) return result
  const out = Object.fromEntries(
    Object.entries(result.value).filter(([, value]) => value !== null),
  )
  return ok(out as Prisma.JsonObject)
}

/* ------------------------------------------------------------------ */
/* Diff para a rastreabilidade                                          */
/* ------------------------------------------------------------------ */

type Ref = { id: string; label: string } | null
type Row = SdTicketWithRelations

const named = (r: { id: string; name: string } | null): Ref =>
  r ? { id: r.id, label: r.name } : null

const RELATIONS: Record<string, (t: Row) => Ref> = {
  phaseId: (t) => ({ id: t.phase.id, label: t.phase.name }),
  impactId: (t) => named(t.impact),
  urgencyId: (t) => named(t.urgency),
  priorityId: (t) => named(t.priority),
  severityId: (t) => named(t.severity),
  categoryId: (t) => named(t.category),
  subcategoryId: (t) => named(t.subcategory),
  serviceId: (t) => named(t.service),
  classificationId: (t) => named(t.classification),
  solutionClassificationId: (t) => named(t.solutionClassification),
  customerId: (t) => named(t.customer),
  companyId: (t) => named(t.company),
  contactId: (t) => named(t.contact),
  configItemId: (t) => named(t.configItem),
  departmentId: (t) => named(t.department),
  assigneeId: (t) => named(t.assignee),
  requesterId: (t) => named(t.requester),
  parentId: (t) =>
    t.parent ? { id: t.parent.id, label: `#${t.parent.number}` } : null,
}

const RICH_TEXT = new Set([
  'description',
  'solution',
  'implementationPlan',
  'rollbackPlan',
  'testPlan',
  'rootCause',
  'workaround',
])

function display(field: string, t: Row): Prisma.InputJsonValue | null {
  const relation = RELATIONS[field]
  if (relation) return relation(t)
  const raw = (t as unknown as Record<string, unknown>)[field]
  if (raw === null || raw === undefined) return null
  if (raw instanceof Date) return raw.toISOString()
  if (RICH_TEXT.has(field)) return sdHtmlToText(String(raw)).slice(0, 280)
  return raw as Prisma.InputJsonValue
}

export interface SdFieldChange {
  field: string
  from: Prisma.InputJsonValue | null
  to: Prisma.InputJsonValue | null
}

/** Campos que mudaram entre `before` e `after` (valores legíveis). */
export function diffSdTickets(
  before: Row,
  after: Row,
  fields: readonly string[],
): SdFieldChange[] {
  const changes: SdFieldChange[] = []
  const rawBefore = before as unknown as Record<string, unknown>
  const rawAfter = after as unknown as Record<string, unknown>
  for (const field of fields) {
    if (field === 'customFields') {
      const a = asRecord(before.customFields)
      const b = asRecord(after.customFields)
      for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (JSON.stringify(a[key]) === JSON.stringify(b[key])) continue
        changes.push({
          field: `customFields.${key}`,
          from: (a[key] ?? null) as Prisma.InputJsonValue | null,
          to: (b[key] ?? null) as Prisma.InputJsonValue | null,
        })
      }
      continue
    }
    if (JSON.stringify(rawBefore[field]) === JSON.stringify(rawAfter[field])) {
      continue
    }
    changes.push({
      field,
      from: display(field, before),
      to: display(field, after),
    })
  }
  return changes
}
