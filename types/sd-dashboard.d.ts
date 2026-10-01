/**
 * Linhas das fontes de dashboard do ServiceDesk
 * (`GET /api/workspaces/[id]/servicedesk/dashboards/sources/[source]`).
 * Rótulos já em pt-BR (o motor de widgets agrupa/filtra por texto). Campos
 * `*Pct` valem 0 ou 100 (ou `null` quando não se aplicam): a **média** deles
 * é a taxa. Tempos em minutos corridos (não úteis).
 */

export type SdSlaStateLabel =
  | 'No prazo'
  | 'Em risco'
  | 'Violado'
  | 'Cumprido'
  | 'Pausado'
  | 'Sem SLA'

export interface SdTicketDashboardRow {
  id: string
  number: number
  code: string
  title: string
  /** Incidente, Requisição, Mudança, Problema. */
  type: string
  phase: string
  /** Novo, Em andamento, Aguardando, Resolvido, Fechado, Cancelado. */
  phaseCategory: string
  completionPercent: number
  priority: string | null
  priorityLevel: number | null
  severity: string | null
  impact: string | null
  urgency: string | null
  department: string | null
  assignee: string | null
  assigneeId: string | null
  requester: string | null
  customer: string | null
  company: string | null
  contact: string | null
  category: string | null
  subcategory: string | null
  service: string | null
  classification: string | null
  solutionClassification: string | null
  channel: string
  tags: string[]
  isOpen: boolean
  isUnassigned: boolean
  /** Prioridade de maior peso do workspace. */
  isCritical: boolean
  slaFirstResponseState: SdSlaStateLabel
  slaResolutionState: SdSlaStateLabel
  /** Em aberto, algum prazo em risco e nenhum violado. */
  slaAtRisk: boolean
  /** Algum prazo (1ª resposta ou resolução) violado. */
  slaBreached: boolean
  firstResponseBreached: boolean
  resolutionBreached: boolean
  /** 100 = resolvido no prazo, 0 = fora; `null` sem SLA ou em aberto. */
  slaResolutionMetPct: number | null
  slaFirstResponseMetPct: number | null
  resolutionRemainingMinutes: number | null
  /** "em 25 min" / "atrasado 2 h" (minutos úteis). */
  resolutionDueIn: string | null
  firstResponseMinutes: number | null
  resolutionMinutes: number | null
  resolutionHours: number | null
  /** Idade de chamados em aberto (h); `null` para concluídos. */
  ageHours: number | null
  escalationLevel: number
  reopenCount: number
  reopenedPct: number
  csatScore: number | null
  createdAt: string
  firstRespondedAt: string | null
  resolvedAt: string | null
  closedAt: string | null
  resolutionDueAt: string | null
  firstResponseDueAt: string | null
  lastActivityAt: string
  /** Campos customizados como `cf_<chave>` (listas viram texto). */
  [customField: `cf_${string}`]: string | number | boolean | null
}

export interface SdTicketCostDashboardRow {
  id: string
  ticketId: string
  ticketCode: string
  ticketTitle: string
  ticketType: string
  ticketCategory: string | null
  /** Mão de obra, Deslocamento, Material, Serviço, Licença, Outros. */
  category: string
  description: string
  quantity: number
  unitCost: number
  total: number
  billable: boolean
  technician: string | null
  department: string | null
  customer: string | null
  incurredAt: string
  createdAt: string
}

export interface SdTicketEventDashboardRow {
  id: string
  ticketId: string
  ticketCode: string
  ticketType: string
  priority: string | null
  department: string | null
  /** Código técnico (`ticket.created`, `phase.changed`…). */
  action: string
  /** Rótulo pt-BR da ação. */
  actionLabel: string
  /** Criados, Resolvidos, Fechados, Reabertos, Escalonados, SLA violado… */
  flow: string | null
  /** Só "Criados" ou "Resolvidos" (gráfico criados × resolvidos). */
  throughput: 'Criados' | 'Resolvidos' | null
  actor: string | null
  actorKind: string
  createdAt: string
}

export interface SdKbArticleDashboardRow {
  id: string
  title: string
  status: string
  visibility: string
  category: string | null
  tags: string[]
  viewCount: number
  helpfulCount: number
  notHelpfulCount: number
  /** % de votos úteis; `null` sem votos. */
  helpfulPct: number | null
  author: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export type SdDashboardRow =
  | SdTicketDashboardRow
  | SdTicketCostDashboardRow
  | SdTicketEventDashboardRow
  | SdKbArticleDashboardRow

/** Resposta do `POST .../tickets/[ticketId]/csat`. */
export interface SdTicketCsatDTO {
  ticketId: string
  number: number
  csatScore: number
  csatComment: string | null
}
