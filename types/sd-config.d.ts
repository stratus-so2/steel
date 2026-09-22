import type {
  SdAutomationAction,
  SdCondition,
  SdEscalationActions,
} from '@/src/schemas/sd-rule.schema'
import type { SdTicketTemplateDefaults } from '@/src/schemas/sd-ticket-template.schema'
import type {
  SdPublicSettingsDTO,
  SdSettingsDTO,
  SdTicketTypeDTO,
} from './sd-settings'

export type { SdPublicSettingsDTO, SdSettingsDTO, SdTicketTypeDTO }

export type SdPhaseCategoryDTO =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELED'

// ── Departamentos ──────────────────────────────────────────────────────────

export interface SdDepartmentMemberDTO {
  userId: string
  name: string
  email: string
  image: string | null
  isLead: boolean
  lastAssignedAt: string | null
}

/** Departamento (lista plana; `parentId` monta a árvore de 2 níveis). */
export interface SdDepartmentDTO {
  id: string
  parentId: string | null
  name: string
  description: string | null
  email: string | null
  color: string | null
  calendarId: string | null
  active: boolean
  position: number
  members: SdDepartmentMemberDTO[]
  createdAt: string
  updatedAt: string
}

/** Departamento raiz com os sub-departamentos (bootstrap). */
export interface SdDepartmentTreeDTO extends SdDepartmentDTO {
  children: SdDepartmentDTO[]
}

// ── Catálogo ───────────────────────────────────────────────────────────────

export type SdCategoryLevelDTO = 'CATEGORY' | 'SUBCATEGORY' | 'SERVICE'

export interface SdCategoryDTO {
  id: string
  parentId: string | null
  level: SdCategoryLevelDTO
  name: string
  description: string | null
  icon: string | null
  ticketTypes: SdTicketTypeDTO[]
  departmentId: string | null
  slaPolicyId: string | null
  portalVisible: boolean
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface SdCategoryTreeDTO extends SdCategoryDTO {
  children: SdCategoryTreeDTO[]
}

// ── Classificações ─────────────────────────────────────────────────────────

export type SdClassificationKindDTO = 'TICKET' | 'SOLUTION'

export interface SdClassificationDTO {
  id: string
  kind: SdClassificationKindDTO
  name: string
  description: string | null
  color: string | null
  ticketTypes: SdTicketTypeDTO[]
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

// ── Impacto, urgência, prioridade, severidade, matriz ──────────────────────

export type SdScaleKindDTO = 'impact' | 'urgency' | 'priority' | 'severity'

/**
 * Item de escala ITIL. `description` não existe em prioridade; `color` não
 * existe em impacto/urgência; `isDefault` só em prioridade (demais: `false`).
 */
export interface SdScaleItemDTO {
  id: string
  kind: SdScaleKindDTO
  name: string
  description: string | null
  color: string | null
  level: number
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

export interface SdPriorityMatrixCellDTO {
  impactId: string
  urgencyId: string
  priorityId: string
}

// ── Fases e transições ─────────────────────────────────────────────────────

export interface SdPhaseDTO {
  id: string
  ticketType: SdTicketTypeDTO
  name: string
  description: string | null
  color: string | null
  category: SdPhaseCategoryDTO
  completionPercent: number
  position: number
  isInitial: boolean
  pausesSla: boolean
  requiresApproval: boolean
  requiredFields: string[]
  wipLimit: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface SdPhaseTransitionDTO {
  id: string
  fromPhaseId: string
  toPhaseId: string
  allowedDepartmentIds: string[]
}

/** Fluxo de um tipo: fases ordenadas + transições (vazio = fluxo livre). */
export interface SdPhaseFlowDTO {
  ticketType: SdTicketTypeDTO
  phases: SdPhaseDTO[]
  transitions: SdPhaseTransitionDTO[]
}

// ── Calendários ────────────────────────────────────────────────────────────

export type SdWeekDayDTO = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun'

export type SdWeeklyScheduleDTO = Record<SdWeekDayDTO, [string, string][]>

export interface SdHolidayDTO {
  date: string
  name: string
  recurring: boolean
}

export interface SdBusinessCalendarDTO {
  id: string
  name: string
  timezone: string
  schedule: SdWeeklyScheduleDTO
  holidays: SdHolidayDTO[]
  is24x7: boolean
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

// ── SLA/OLA ────────────────────────────────────────────────────────────────

export type SdSlaKindDTO = 'SLA' | 'OLA'

export interface SdSlaTargetDTO {
  priorityId: string
  firstResponseMinutes: number
  resolutionMinutes: number
}

export interface SdSlaPolicyDTO {
  id: string
  kind: SdSlaKindDTO
  name: string
  description: string | null
  calendarId: string | null
  conditions: SdCondition[]
  isDefault: boolean
  active: boolean
  position: number
  targets: SdSlaTargetDTO[]
  createdAt: string
  updatedAt: string
}

/** Recorte do bootstrap (nome da política no chamado). */
export type SdSlaPolicySummaryDTO = Pick<
  SdSlaPolicyDTO,
  'id' | 'kind' | 'name' | 'isDefault' | 'active' | 'calendarId'
>

// ── Regras ─────────────────────────────────────────────────────────────────

export type SdEscalationTriggerDTO =
  | 'FIRST_RESPONSE_AT_RISK'
  | 'FIRST_RESPONSE_BREACHED'
  | 'RESOLUTION_AT_RISK'
  | 'RESOLUTION_BREACHED'
  | 'NO_UPDATE'

export interface SdEscalationRuleDTO {
  id: string
  name: string
  trigger: SdEscalationTriggerDTO
  thresholdMinutes: number | null
  conditions: SdCondition[]
  actions: SdEscalationActions
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export type SdAutomationEventDTO =
  | 'TICKET_CREATED'
  | 'TICKET_UPDATED'
  | 'PHASE_CHANGED'
  | 'MESSAGE_RECEIVED'
  | 'APPROVAL_RESPONDED'
  | 'SLA_AT_RISK'
  | 'SLA_BREACHED'

export interface SdAutomationRuleDTO {
  id: string
  name: string
  description: string | null
  event: SdAutomationEventDTO
  conditions: SdCondition[]
  actions: SdAutomationAction[]
  stopProcessing: boolean
  active: boolean
  position: number
  runCount: number
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

// ── Campos customizados ────────────────────────────────────────────────────

export type SdCustomFieldEntityDTO =
  | 'TICKET'
  | 'CUSTOMER'
  | 'CONTACT'
  | 'CONFIG_ITEM'

export type SdCustomFieldTypeDTO =
  | 'TEXT'
  | 'TEXTAREA'
  | 'NUMBER'
  | 'CURRENCY'
  | 'DATE'
  | 'DATETIME'
  | 'CHECKBOX'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'USER'
  | 'EMAIL'
  | 'URL'
  | 'PHONE'

export interface SdCustomFieldOptionDTO {
  value: string
  label: string
  color?: string | null
}

export interface SdCustomFieldDefinitionDTO {
  id: string
  entity: SdCustomFieldEntityDTO
  key: string
  label: string
  description: string | null
  type: SdCustomFieldTypeDTO
  options: SdCustomFieldOptionDTO[]
  ticketTypes: SdTicketTypeDTO[]
  categoryIds: string[]
  required: boolean
  visibleInPortal: boolean
  defaultValue: unknown
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

// ── Modelos, respostas prontas, peças ──────────────────────────────────────

export interface SdTicketTemplateTaskDTO {
  title: string
  description?: string
}

export interface SdTicketTemplateDTO {
  id: string
  ticketType: SdTicketTypeDTO
  name: string
  description: string | null
  defaults: SdTicketTemplateDefaults
  tasks: SdTicketTemplateTaskDTO[]
  portalVisible: boolean
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface SdCannedResponseDTO {
  id: string
  title: string
  shortcut: string | null
  body: string
  departmentId: string | null
  createdById: string
  createdByName: string | null
  createdAt: string
  updatedAt: string
}

export interface SdPartDTO {
  id: string
  name: string
  sku: string | null
  description: string | null
  /** Decimal(14,2) serializado (ex.: `"129.90"`). */
  unitCost: string
  stock: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

// ── Bootstrap, contexto do usuário e agentes ───────────────────────────────

export interface SdMeDTO {
  userId: string
  isAgent: boolean
  isAdmin: boolean
  departmentIds: string[]
  leadDepartmentIds: string[]
}

/** Membro do workspace visto pelo ServiceDesk (seletores de responsável). */
export interface SdAgentDTO {
  id: string
  name: string
  email: string
  image: string | null
  isAdmin: boolean
  /** Admin ou membro de ao menos um departamento ativo. */
  isAgent: boolean
  departments: { departmentId: string; isLead: boolean }[]
}

/**
 * Tudo o que a UI de chamados precisa num pedido só. Para solicitantes, só o
 * que é visível no portal (categorias/modelos/campos) e sem respostas prontas.
 * Itens inativos vêm junto (com `active: false`) para exibir valores antigos.
 */
export interface SdConfigBootstrapDTO {
  me: SdMeDTO
  settings: SdPublicSettingsDTO
  departments: SdDepartmentTreeDTO[]
  categories: SdCategoryTreeDTO[]
  classifications: SdClassificationDTO[]
  impacts: SdScaleItemDTO[]
  urgencies: SdScaleItemDTO[]
  priorities: SdScaleItemDTO[]
  severities: SdScaleItemDTO[]
  priorityMatrix: SdPriorityMatrixCellDTO[]
  phases: SdPhaseFlowDTO[]
  customFields: SdCustomFieldDefinitionDTO[]
  templates: SdTicketTemplateDTO[]
  cannedResponses: SdCannedResponseDTO[]
  slaPolicies: SdSlaPolicySummaryDTO[]
}
