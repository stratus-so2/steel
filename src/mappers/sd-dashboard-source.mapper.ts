import type {
  SdCostCategory,
  SdKbArticleStatus,
  SdKbVisibility,
  SdMessageAuthorKind,
  SdPhaseCategory,
  SdTicketChannel,
  SdTicketType,
} from '@prisma/client'
import {
  computeSlaState,
  parseSdCalendar,
  type SdSlaTimerState,
} from '@/src/lib/servicedesk/sla'
import {
  formatSdTicketCode,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import type {
  SdDashboardCost,
  SdDashboardEvent,
  SdDashboardKbArticle,
  SdDashboardTicket,
} from '@/src/repositories/sd-dashboard-source.repository'
import type {
  SdKbArticleDashboardRow,
  SdSlaStateLabel,
  SdTicketCostDashboardRow,
  SdTicketDashboardRow,
  SdTicketEventDashboardRow,
} from '@/types/sd-dashboard'

/* --------------------------------- rótulos --------------------------------- */

export const SD_TYPE_LABELS: Record<SdTicketType, string> = {
  INCIDENT: 'Incidente',
  SERVICE_REQUEST: 'Requisição',
  CHANGE: 'Mudança',
  PROBLEM: 'Problema',
}

export const SD_PHASE_CATEGORY_LABELS: Record<SdPhaseCategory, string> = {
  NEW: 'Novo',
  IN_PROGRESS: 'Em andamento',
  WAITING: 'Aguardando',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELED: 'Cancelado',
}

export const SD_CHANNEL_LABELS: Record<SdTicketChannel, string> = {
  AGENT: 'Agente',
  PORTAL: 'Portal',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
  PHONE: 'Telefone',
  AI: 'IA',
  API: 'API',
}

export const SD_COST_CATEGORY_LABELS: Record<SdCostCategory, string> = {
  LABOR: 'Mão de obra',
  TRAVEL: 'Deslocamento',
  MATERIAL: 'Material',
  SERVICE: 'Serviço',
  LICENSE: 'Licença',
  OTHER: 'Outros',
}

const ACTOR_KIND_LABELS: Record<SdMessageAuthorKind, string> = {
  AGENT: 'Agente',
  REQUESTER: 'Solicitante',
  CONTACT: 'Contato',
  AI: 'IA',
  SYSTEM: 'Sistema',
}

const KB_STATUS_LABELS: Record<SdKbArticleStatus, string> = {
  DRAFT: 'Rascunho',
  IN_REVIEW: 'Em revisão',
  PUBLISHED: 'Publicado',
}

const KB_VISIBILITY_LABELS: Record<SdKbVisibility, string> = {
  INTERNAL: 'Interno',
  PORTAL: 'Portal',
}

const SLA_LABELS: Record<SdSlaTimerState, SdSlaStateLabel> = {
  ok: 'No prazo',
  at_risk: 'Em risco',
  breached: 'Violado',
  met: 'Cumprido',
  paused: 'Pausado',
  none: 'Sem SLA',
}

const EVENT_LABELS: Record<string, string> = {
  'ticket.created': 'Chamado aberto',
  'phase.changed': 'Mudança de fase',
  'ticket.reopened': 'Reaberto',
  'ticket.auto_closed': 'Fechado automaticamente',
  escalated: 'Escalonado',
  'sla.at_risk': 'SLA em risco',
  'sla.first_response_breached': '1ª resposta violada',
  'sla.resolution_breached': 'Resolução violada',
  'csat.submitted': 'Avaliação (CSAT)',
}

const PHASE_FLOW: Partial<Record<string, string>> = {
  RESOLVED: 'Resolvidos',
  CLOSED: 'Fechados',
  CANCELED: 'Cancelados',
}

const ACTION_FLOW: Record<string, string> = {
  'ticket.created': 'Criados',
  'ticket.reopened': 'Reabertos',
  'ticket.auto_closed': 'Fechados',
  escalated: 'Escalonados',
  'sla.at_risk': 'SLA em risco',
  'sla.first_response_breached': 'SLA violado',
  'sla.resolution_breached': 'SLA violado',
  'csat.submitted': 'Avaliados',
}

const OPEN_EXCLUDED = new Set<SdPhaseCategory>([
  'RESOLVED',
  'CLOSED',
  'CANCELED',
])

/* --------------------------------- helpers --------------------------------- */

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

function minutesBetween(from: Date, to: Date | null): number | null {
  if (!to) return null
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000))
}

function oneDecimal(n: number): number {
  return Math.round(n * 10) / 10
}

function span(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60)
    const m = minutes % 60
    return m ? `${h} h ${m} min` : `${h} h`
  }
  return `${Math.floor(minutes / 1440)} d`
}

/** "em 25 min" / "atrasado 2 h" a partir dos minutos (úteis) restantes. */
export function sdDueInLabel(remaining: number | null): string | null {
  if (remaining === null) return null
  return remaining < 0
    ? `atrasado ${span(-remaining)}`
    : `em ${span(remaining)}`
}

/** 100 = cumprido, 0 = violado; `null` enquanto não há veredito. */
function metPct(state: SdSlaTimerState): number | null {
  if (state === 'met') return 100
  if (state === 'breached') return 0
  return null
}

/**
 * Campos customizados como `cf_<chave>`: primitivos como estão, listas
 * juntadas por vírgula; objetos são ignorados.
 */
export function flattenSdCustomFields(
  value: unknown,
): Record<`cf_${string}`, string | number | boolean | null> {
  const out: Record<`cf_${string}`, string | number | boolean | null> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (
      raw === null ||
      typeof raw === 'string' ||
      typeof raw === 'number' ||
      typeof raw === 'boolean'
    ) {
      out[`cf_${key}`] = raw
    } else if (Array.isArray(raw)) {
      out[`cf_${key}`] = raw.map((item) => String(item)).join(', ')
    }
  }
  return out
}

/* --------------------------------- mappers --------------------------------- */

export interface SdDashboardTicketContext {
  prefixes: SdTicketPrefixes
  atRiskPercent: number
  topPriorityLevel: number | null
  now: Date
}

/**
 * Chamado → linha do dashboard. O SLA de chamados em aberto usa o
 * calendário da política (minutos úteis); nos concluídos só importa o
 * veredito (concluiu depois do prazo ou tem a flag de violação), então o
 * cálculo é o corrido — bem mais barato para milhares de linhas.
 */
export function toSdTicketDashboardRow(
  t: SdDashboardTicket,
  ctx: SdDashboardTicketContext,
): SdTicketDashboardRow {
  const isOpen = !OPEN_EXCLUDED.has(t.phase.category)
  const sla = computeSlaState(t, ctx.now, {
    atRiskPercent: ctx.atRiskPercent,
    calendar: isOpen ? parseSdCalendar(t.slaPolicy?.calendar ?? null) : null,
  })
  const slaBreached =
    sla.firstResponse.state === 'breached' ||
    sla.resolution.state === 'breached'
  const slaAtRisk =
    isOpen &&
    !slaBreached &&
    (sla.firstResponse.state === 'at_risk' ||
      sla.resolution.state === 'at_risk')
  const resolutionMinutes = minutesBetween(t.createdAt, t.resolvedAt)
  const priorityLevel = t.priority?.level ?? null

  return {
    ...flattenSdCustomFields(t.customFields),
    id: t.id,
    number: t.number,
    code: formatSdTicketCode(t.type, t.number, ctx.prefixes),
    title: t.title,
    type: SD_TYPE_LABELS[t.type],
    phase: t.phase.name,
    phaseCategory: SD_PHASE_CATEGORY_LABELS[t.phase.category],
    completionPercent: t.completionPercent,
    priority: t.priority?.name ?? null,
    priorityLevel,
    severity: t.severity?.name ?? null,
    impact: t.impact?.name ?? null,
    urgency: t.urgency?.name ?? null,
    department: t.department?.name ?? null,
    assignee: t.assignee?.name ?? null,
    assigneeId: t.assigneeId,
    requester: t.requester?.name ?? null,
    customer: t.customer?.name ?? null,
    company: t.company?.name ?? null,
    contact: t.contact?.name ?? null,
    category: t.category?.name ?? null,
    subcategory: t.subcategory?.name ?? null,
    service: t.service?.name ?? null,
    classification: t.classification?.name ?? null,
    solutionClassification: t.solutionClassification?.name ?? null,
    channel: SD_CHANNEL_LABELS[t.channel],
    tags: t.tags,
    isOpen,
    isUnassigned: isOpen && !t.assigneeId,
    isCritical:
      priorityLevel !== null &&
      ctx.topPriorityLevel !== null &&
      priorityLevel >= ctx.topPriorityLevel,
    slaFirstResponseState: SLA_LABELS[sla.firstResponse.state],
    slaResolutionState: SLA_LABELS[sla.resolution.state],
    slaAtRisk,
    slaBreached,
    firstResponseBreached: t.firstResponseBreached,
    resolutionBreached: t.resolutionBreached,
    slaResolutionMetPct: metPct(sla.resolution.state),
    slaFirstResponseMetPct: metPct(sla.firstResponse.state),
    resolutionRemainingMinutes: sla.resolution.remainingMinutes,
    resolutionDueIn: sdDueInLabel(sla.resolution.remainingMinutes),
    firstResponseMinutes: minutesBetween(t.createdAt, t.firstRespondedAt),
    resolutionMinutes,
    resolutionHours:
      resolutionMinutes === null ? null : oneDecimal(resolutionMinutes / 60),
    ageHours: isOpen
      ? oneDecimal(
          Math.max(0, ctx.now.getTime() - t.createdAt.getTime()) / 3_600_000,
        )
      : null,
    escalationLevel: t.escalationLevel,
    reopenCount: t.reopenCount,
    reopenedPct: t.reopenCount > 0 ? 100 : 0,
    csatScore: t.csatScore,
    createdAt: t.createdAt.toISOString(),
    firstRespondedAt: iso(t.firstRespondedAt),
    resolvedAt: iso(t.resolvedAt),
    closedAt: iso(t.closedAt),
    resolutionDueAt: iso(t.resolutionDueAt),
    firstResponseDueAt: iso(t.firstResponseDueAt),
    lastActivityAt: t.lastActivityAt.toISOString(),
  }
}

export function toSdCostDashboardRow(
  c: SdDashboardCost,
  prefixes: SdTicketPrefixes,
): SdTicketCostDashboardRow {
  const quantity = Number(c.quantity)
  const unitCost = Number(c.unitCost)
  return {
    id: c.id,
    ticketId: c.ticketId,
    ticketCode: formatSdTicketCode(c.ticket.type, c.ticket.number, prefixes),
    ticketTitle: c.ticket.title,
    ticketType: SD_TYPE_LABELS[c.ticket.type],
    ticketCategory: c.ticket.category?.name ?? null,
    category: SD_COST_CATEGORY_LABELS[c.category],
    description: c.description,
    quantity,
    unitCost,
    total: Math.round(quantity * unitCost * 100) / 100,
    billable: c.billable,
    technician: c.user?.name ?? null,
    department: c.ticket.department?.name ?? null,
    customer: c.ticket.customer?.name ?? null,
    incurredAt: c.incurredAt.toISOString(),
    createdAt: c.createdAt.toISOString(),
  }
}

function eventFlow(e: SdDashboardEvent): string | null {
  if (e.action === 'phase.changed') {
    const meta =
      e.meta && typeof e.meta === 'object' && !Array.isArray(e.meta)
        ? (e.meta as Record<string, unknown>)
        : {}
    return PHASE_FLOW[String(meta.toCategory)] ?? null
  }
  return ACTION_FLOW[e.action] ?? null
}

export function toSdEventDashboardRow(
  e: SdDashboardEvent,
  prefixes: SdTicketPrefixes,
): SdTicketEventDashboardRow {
  const flow = eventFlow(e)
  return {
    id: e.id,
    ticketId: e.ticketId,
    ticketCode: formatSdTicketCode(e.ticket.type, e.ticket.number, prefixes),
    ticketType: SD_TYPE_LABELS[e.ticket.type],
    priority: e.ticket.priority?.name ?? null,
    department: e.ticket.department?.name ?? null,
    action: e.action,
    actionLabel: EVENT_LABELS[e.action] ?? e.action,
    flow,
    throughput: flow === 'Criados' || flow === 'Resolvidos' ? flow : null,
    actor: e.actor?.name ?? null,
    actorKind: ACTOR_KIND_LABELS[e.actorKind],
    createdAt: e.createdAt.toISOString(),
  }
}

export function toSdKbDashboardRow(
  a: SdDashboardKbArticle,
): SdKbArticleDashboardRow {
  const votes = a.helpfulCount + a.notHelpfulCount
  return {
    id: a.id,
    title: a.title,
    status: KB_STATUS_LABELS[a.status],
    visibility: KB_VISIBILITY_LABELS[a.visibility],
    category: a.category?.name ?? null,
    tags: a.tags,
    viewCount: a.viewCount,
    helpfulCount: a.helpfulCount,
    notHelpfulCount: a.notHelpfulCount,
    helpfulPct: votes === 0 ? null : oneDecimal((a.helpfulCount / votes) * 100),
    author: a.createdBy?.name ?? null,
    publishedAt: iso(a.publishedAt),
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }
}
