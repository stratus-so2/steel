import type {
  SdCategoryTreeDTO,
  SdClassificationDTO,
  SdClassificationKindDTO,
  SdConfigBootstrapDTO,
  SdDepartmentTreeDTO,
  SdPhaseDTO,
  SdPriorityMatrixCellDTO,
  SdScaleItemDTO,
} from '@/types/sd-config'
import type { SdTicketDTO, SdTicketTypeDTO } from '@/types/sd-ticket'
import type { SdSelectOption } from './sd-option-select'

/**
 * Opções dos campos do chamado a partir do bootstrap de configuração
 * (`useSdConfig`) e leitura dos valores de um `SdTicketDTO`. Funções puras.
 */

function forType<T extends { ticketTypes: SdTicketTypeDTO[] }>(
  item: T,
  type: SdTicketTypeDTO | undefined,
): boolean {
  return (
    !type || item.ticketTypes.length === 0 || item.ticketTypes.includes(type)
  )
}

/** Itens ativos + o selecionado (mesmo inativo, para exibir). */
function keepSelected<T extends { id: string; active: boolean }>(
  items: T[],
  selected: string | null | undefined,
): T[] {
  return items.filter((i) => i.active || i.id === selected)
}

export function sdScaleOptions(items: SdScaleItemDTO[]): SdSelectOption[] {
  return [...items]
    .sort((a, b) => a.level - b.level)
    .map((i) => ({
      value: i.id,
      label: i.name,
      color: i.color,
      hint: `N${i.level}`,
    }))
}

export function sdCategoryOptions(
  tree: SdCategoryTreeDTO[],
  type: SdTicketTypeDTO | undefined,
  selected?: string | null,
): SdSelectOption[] {
  return keepSelected(tree, selected)
    .filter((c) => forType(c, type) || c.id === selected)
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ value: c.id, label: c.name }))
}

function findNode(
  tree: SdCategoryTreeDTO[],
  id: string | null | undefined,
): SdCategoryTreeDTO | undefined {
  if (!id) return undefined
  for (const node of tree) {
    if (node.id === id) return node
    const inner = findNode(node.children, id)
    if (inner) return inner
  }
  return undefined
}

/** Filhos de um nó (subcategorias de uma categoria, serviços de uma sub). */
export function sdCategoryChildOptions(
  tree: SdCategoryTreeDTO[],
  parentId: string | null | undefined,
  type: SdTicketTypeDTO | undefined,
  selected?: string | null,
): SdSelectOption[] {
  const parent = findNode(tree, parentId)
  if (!parent) return []
  return sdCategoryOptions(parent.children, type, selected)
}

/** Nome de um nó do catálogo (qualquer nível). */
export function sdCategoryName(
  tree: SdCategoryTreeDTO[],
  id: string | null | undefined,
): string | null {
  return findNode(tree, id)?.name ?? null
}

export function sdClassificationOptions(
  list: SdClassificationDTO[],
  kind: SdClassificationKindDTO,
  type: SdTicketTypeDTO | undefined,
  selected?: string | null,
): SdSelectOption[] {
  return keepSelected(list, selected)
    .filter((c) => c.kind === kind && (forType(c, type) || c.id === selected))
    .sort((a, b) => a.position - b.position)
    .map((c) => ({ value: c.id, label: c.name, color: c.color }))
}

export function sdDepartmentOptions(
  tree: SdDepartmentTreeDTO[],
  selected?: string | null,
): SdSelectOption[] {
  const out: SdSelectOption[] = []
  for (const root of [...tree].sort((a, b) => a.position - b.position)) {
    if (!root.active && root.id !== selected) continue
    out.push({ value: root.id, label: root.name, color: root.color })
    for (const child of [...root.children].sort(
      (a, b) => a.position - b.position,
    )) {
      if (!child.active && child.id !== selected) continue
      out.push({
        value: child.id,
        label: child.name,
        color: child.color,
        depth: 1,
      })
    }
  }
  return out
}

/** Fases ativas do tipo, em ordem. */
export function sdTypePhases(
  config: Pick<SdConfigBootstrapDTO, 'phases'> | undefined,
  type: SdTicketTypeDTO,
): SdPhaseDTO[] {
  const flow = config?.phases.find((f) => f.ticketType === type)
  return (flow?.phases ?? [])
    .filter((p) => p.active)
    .sort((a, b) => a.position - b.position)
}

/** Prioridade resultante da matriz impacto × urgência. */
export function sdMatrixPriority(
  matrix: SdPriorityMatrixCellDTO[],
  impactId: string | null | undefined,
  urgencyId: string | null | undefined,
): string | null {
  if (!impactId || !urgencyId) return null
  return (
    matrix.find((c) => c.impactId === impactId && c.urgencyId === urgencyId)
      ?.priorityId ?? null
  )
}

/** Relações do DTO → chave `<campo>Id`. */
const RELATION_FIELDS: Record<string, keyof SdTicketDTO> = {
  impactId: 'impact',
  urgencyId: 'urgency',
  priorityId: 'priority',
  severityId: 'severity',
  categoryId: 'category',
  subcategoryId: 'subcategory',
  serviceId: 'service',
  classificationId: 'classification',
  solutionClassificationId: 'solutionClassification',
  customerId: 'customer',
  companyId: 'company',
  contactId: 'contact',
  configItemId: 'configItem',
  departmentId: 'department',
  assigneeId: 'assignee',
  requesterId: 'requester',
  parentId: 'parent',
}

/**
 * Valor "de API" de um campo a partir do DTO: `priorityId` → id da
 * prioridade, `customFields.x` → valor do campo customizado, demais →
 * a própria propriedade.
 */
export function sdTicketFieldValue(
  ticket: SdTicketDTO,
  field: string,
): unknown {
  if (field.startsWith('customFields.')) {
    return ticket.customFields[field.slice(13)]
  }
  const relation = RELATION_FIELDS[field]
  if (relation) {
    const ref = ticket[relation] as { id: string } | null
    return ref?.id ?? null
  }
  return (ticket as unknown as Record<string, unknown>)[field]
}

/** Rótulo do valor relacional já conhecido (pickers assíncronos). */
export function sdTicketFieldLabel(
  ticket: SdTicketDTO,
  field: string,
): string | null {
  const relation = RELATION_FIELDS[field]
  if (!relation) return null
  const ref = ticket[relation] as { name?: string; title?: string } | null
  return ref?.name ?? ref?.title ?? null
}

function blank(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0)
  )
}

/**
 * O que falta para mover o chamado para `phase` (espelha as regras do
 * motor): `requiredFields` vazios e, ao resolver com
 * `requireSolutionOnResolve`, solução e classificação da solução (esta só
 * quando existe alguma para o tipo). Aprovação/assinatura não entram aqui.
 */
export function sdMissingPhaseFields(
  ticket: SdTicketDTO,
  phase: Pick<SdPhaseDTO, 'requiredFields' | 'category'>,
  config: Pick<SdConfigBootstrapDTO, 'settings' | 'classifications'>,
): string[] {
  const missing = phase.requiredFields.filter((field) =>
    blank(sdTicketFieldValue(ticket, field)),
  )
  if (
    phase.category === 'RESOLVED' &&
    config.settings.requireSolutionOnResolve
  ) {
    if (blank(ticket.solution) && !missing.includes('solution')) {
      missing.push('solution')
    }
    const hasSolutionClassifications = config.classifications.some(
      (c) => c.kind === 'SOLUTION' && c.active && forType(c, ticket.type),
    )
    if (
      hasSolutionClassifications &&
      !ticket.solutionClassification &&
      !missing.includes('solutionClassificationId')
    ) {
      missing.push('solutionClassificationId')
    }
  }
  return missing
}
