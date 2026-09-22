export type SdTicketTypeDTO =
  | 'INCIDENT'
  | 'SERVICE_REQUEST'
  | 'CHANGE'
  | 'PROBLEM'

export type SdPhaseCategoryDTO =
  | 'NEW'
  | 'IN_PROGRESS'
  | 'WAITING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'CANCELED'

export type SdTicketChannelDTO =
  | 'AGENT'
  | 'PORTAL'
  | 'EMAIL'
  | 'WHATSAPP'
  | 'PHONE'
  | 'AI'
  | 'API'

export type SdSlaTimerStateDTO =
  | 'ok'
  | 'at_risk'
  | 'breached'
  | 'met'
  | 'paused'
  | 'none'

export interface SdSlaTimerDTO {
  dueAt: string | null
  remainingMinutes: number | null
  percentUsed: number | null
  state: SdSlaTimerStateDTO
}

export interface SdSlaStateDTO {
  firstResponse: SdSlaTimerDTO
  resolution: SdSlaTimerDTO
}

export interface SdUserSummaryDTO {
  id: string
  name: string
  email: string
  image: string | null
}

export interface SdPhaseSummaryDTO {
  id: string
  name: string
  color: string | null
  category: SdPhaseCategoryDTO
  completionPercent: number
  position: number
  wipLimit: number
}

/** Item de lista configurável (impacto, urgência, prioridade, severidade). */
export interface SdLevelRefDTO {
  id: string
  name: string
  level: number
  color: string | null
}

export interface SdNamedRefDTO {
  id: string
  name: string
  color?: string | null
}

export interface SdCustomerRefDTO {
  id: string
  name: string
  tradeName: string | null
  /** CPF/CNPJ (só dígitos) — omitido (`null`) para solicitantes. */
  document: string | null
}

export interface SdContactRefDTO {
  id: string
  name: string
  email: string | null
  phone: string | null
  userId: string | null
}

export interface SdConfigItemRefDTO {
  id: string
  name: string
  code: string | null
}

export interface SdTicketParentDTO {
  id: string
  number: number
  code: string
  title: string
  type: SdTicketTypeDTO
}

export interface SdTicketDTO {
  id: string
  workspaceId: string
  number: number
  /** `INC-000123` (prefixo do tipo em `SdSettings.ticketPrefixes`). */
  code: string
  type: SdTicketTypeDTO
  title: string
  /** HTML sanitizado. */
  description: string | null
  channel: SdTicketChannelDTO
  phaseId: string
  phase: SdPhaseSummaryDTO
  completionPercent: number
  impact: SdLevelRefDTO | null
  urgency: SdLevelRefDTO | null
  priority: SdLevelRefDTO | null
  severity: SdLevelRefDTO | null
  category: SdNamedRefDTO | null
  subcategory: SdNamedRefDTO | null
  service: SdNamedRefDTO | null
  classification: SdNamedRefDTO | null
  solutionClassification: SdNamedRefDTO | null
  solution: string | null
  customer: SdCustomerRefDTO | null
  company: SdCustomerRefDTO | null
  contact: SdContactRefDTO | null
  configItem: SdConfigItemRefDTO | null
  department: SdNamedRefDTO | null
  assignee: SdUserSummaryDTO | null
  requester: SdUserSummaryDTO | null
  createdBy: SdUserSummaryDTO | null
  participants: SdUserSummaryDTO[]
  parent: SdTicketParentDTO | null
  childrenCount: number
  templateId: string | null
  whatsappConversationId: string | null
  escalationLevel: number
  tags: string[]
  customFields: Record<string, unknown>
  slaPolicyId: string | null
  firstResponseDueAt: string | null
  resolutionDueAt: string | null
  firstRespondedAt: string | null
  slaPausedAt: string | null
  slaPausedMinutes: number
  firstResponseBreached: boolean
  resolutionBreached: boolean
  /** Estado calculado no momento da resposta (`computeSlaState`). */
  sla: SdSlaStateDTO
  resolvedAt: string | null
  closedAt: string | null
  reopenCount: number
  changeType: 'STANDARD' | 'NORMAL' | 'EMERGENCY' | null
  changeRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH' | null
  plannedStartAt: string | null
  plannedEndAt: string | null
  implementationPlan: string | null
  rollbackPlan: string | null
  testPlan: string | null
  rootCause: string | null
  workaround: string | null
  knownError: boolean
  /** Só agentes (`null` para solicitantes). */
  aiSummary: string | null
  aiTriage: unknown
  csatScore: number | null
  csatComment: string | null
  lastActivityAt: string
  createdAt: string
  updatedAt: string
}

export interface SdTicketPageDTO {
  items: SdTicketDTO[]
  total: number
  page: number
  pageSize: number
  /** Id para `?cursor=` da próxima página (`null` = fim). */
  nextCursor: string | null
}

export interface SdKanbanColumnDTO {
  phase: SdPhaseSummaryDTO
  /** Total de chamados na fase (com os filtros), além dos `items` exibidos. */
  count: number
  items: SdTicketDTO[]
}

export interface SdTicketKanbanDTO {
  type: SdTicketTypeDTO
  columns: SdKanbanColumnDTO[]
}

export interface SdTicketSummaryDTO {
  /** Chamados (não excluídos) por categoria de fase. */
  byPhaseCategory: Record<SdPhaseCategoryDTO, number>
  /** Abertos atribuídos a mim. */
  myOpen: number
  /** Abertos sem responsável. */
  unassigned: number
  /** Abertos com SLA em risco (aviso do worker) e ainda não violados. */
  atRisk: number
  /** Abertos com SLA violado (1ª resposta ou resolução). */
  breached: number
  /** Criados hoje (fuso America/Sao_Paulo). */
  createdToday: number
}

export interface SdBulkUpdateResultDTO {
  updated: string[]
  failed: { id: string; code: string; message: string }[]
}

export type SdTicketEventActorKindDTO =
  | 'AGENT'
  | 'REQUESTER'
  | 'CONTACT'
  | 'AI'
  | 'SYSTEM'

export interface SdTicketEventDTO {
  id: string
  ticketId: string
  actorKind: SdTicketEventActorKindDTO
  actor: SdUserSummaryDTO | null
  /** ex.: ticket.created, field.changed, phase.changed, escalated… */
  action: string
  field: string | null
  /** Valor anterior: escalar, ou `{ id, label }` para relações. */
  fromValue: unknown
  toValue: unknown
  meta: Record<string, unknown> | null
  createdAt: string
}

export interface SdTicketEventPageDTO {
  items: SdTicketEventDTO[]
  nextCursor: string | null
}

export interface SdTicketEscalationDTO {
  id: string
  ticketId: string
  kind: 'FUNCTIONAL' | 'HIERARCHICAL'
  fromLevel: number
  toLevel: number
  fromDepartmentId: string | null
  toDepartmentId: string | null
  fromAssigneeId: string | null
  toAssigneeId: string | null
  reason: string
  automatic: boolean
  ruleId: string | null
  createdBy: SdUserSummaryDTO | null
  createdAt: string
}

export interface SdSavedViewDTO {
  id: string
  workspaceId: string
  userId: string
  name: string
  ticketType: SdTicketTypeDTO | null
  mode: 'KANBAN' | 'LIST' | 'TABLE'
  filters: Record<string, unknown>
  sort: { field: string; order: 'asc' | 'desc' }[]
  columns: string[]
  shared: boolean
  position: number
  /** O usuário atual pode editar/excluir (dono, ou admin se compartilhada). */
  editable: boolean
  createdAt: string
  updatedAt: string
}
