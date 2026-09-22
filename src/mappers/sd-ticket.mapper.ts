import { computeSlaState, parseSdCalendar } from '@/src/lib/servicedesk/sla'
import {
  DEFAULT_SD_TICKET_PREFIXES,
  formatSdTicketCode,
  type SdTicketPrefixes,
} from '@/src/lib/servicedesk/ticket-code'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'
import type {
  SdCustomerRefDTO,
  SdTicketDTO,
  SdUserSummaryDTO,
} from '@/types/sd-ticket'

export interface SdTicketMapperContext {
  prefixes?: SdTicketPrefixes
  /** Instante de referência do cálculo de SLA (padrão: agora). */
  now?: Date
  atRiskPercent?: number
  /** Solicitante: omite IA e documento do cliente. */
  audience?: 'agent' | 'requester'
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null)

function user(
  u: { id: string; name: string; email: string; image: string | null } | null,
): SdUserSummaryDTO | null {
  return u ? { id: u.id, name: u.name, email: u.email, image: u.image } : null
}

function customer(
  c: {
    id: string
    name: string
    tradeName: string | null
    document: string | null
  } | null,
  hideDocument: boolean,
): SdCustomerRefDTO | null {
  if (!c) return null
  return {
    id: c.id,
    name: c.name,
    tradeName: c.tradeName,
    document: hideDocument ? null : c.document,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export function toSdTicketDTO(
  t: SdTicketWithRelations,
  ctx: SdTicketMapperContext = {},
): SdTicketDTO {
  const prefixes = ctx.prefixes ?? DEFAULT_SD_TICKET_PREFIXES
  const requester = ctx.audience === 'requester'
  const calendar = t.slaPolicy?.calendar
    ? parseSdCalendar(t.slaPolicy.calendar)
    : null
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    number: t.number,
    code: formatSdTicketCode(t.type, t.number, prefixes),
    type: t.type,
    title: t.title,
    description: t.description,
    channel: t.channel,
    phaseId: t.phaseId,
    phase: {
      id: t.phase.id,
      name: t.phase.name,
      color: t.phase.color,
      category: t.phase.category,
      completionPercent: t.phase.completionPercent,
      position: t.phase.position,
      wipLimit: t.phase.wipLimit,
    },
    completionPercent: t.completionPercent,
    impact: t.impact ? { ...t.impact, color: null } : null,
    urgency: t.urgency ? { ...t.urgency, color: null } : null,
    priority: t.priority,
    severity: t.severity,
    category: t.category,
    subcategory: t.subcategory,
    service: t.service,
    classification: t.classification,
    solutionClassification: t.solutionClassification,
    solution: t.solution,
    customer: customer(t.customer, requester),
    company: customer(t.company, requester),
    contact: t.contact,
    configItem: t.configItem,
    department: t.department,
    assignee: user(t.assignee),
    requester: user(t.requester),
    createdBy: user(t.createdBy),
    participants: t.participants.map((p) => user(p.user) as SdUserSummaryDTO),
    parent: t.parent
      ? {
          id: t.parent.id,
          number: t.parent.number,
          code: formatSdTicketCode(t.parent.type, t.parent.number, prefixes),
          title: t.parent.title,
          type: t.parent.type,
        }
      : null,
    childrenCount: t._count.children,
    templateId: t.templateId,
    whatsappConversationId: t.whatsappConversationId,
    escalationLevel: t.escalationLevel,
    tags: t.tags,
    customFields: asRecord(t.customFields),
    slaPolicyId: t.slaPolicyId,
    firstResponseDueAt: iso(t.firstResponseDueAt),
    resolutionDueAt: iso(t.resolutionDueAt),
    firstRespondedAt: iso(t.firstRespondedAt),
    slaPausedAt: iso(t.slaPausedAt),
    slaPausedMinutes: t.slaPausedMinutes,
    firstResponseBreached: t.firstResponseBreached,
    resolutionBreached: t.resolutionBreached,
    sla: computeSlaState(t, ctx.now ?? new Date(), {
      atRiskPercent: ctx.atRiskPercent,
      calendar,
    }),
    resolvedAt: iso(t.resolvedAt),
    closedAt: iso(t.closedAt),
    reopenCount: t.reopenCount,
    changeType: t.changeType,
    changeRisk: t.changeRisk,
    plannedStartAt: iso(t.plannedStartAt),
    plannedEndAt: iso(t.plannedEndAt),
    implementationPlan: t.implementationPlan,
    rollbackPlan: t.rollbackPlan,
    testPlan: t.testPlan,
    rootCause: t.rootCause,
    workaround: t.workaround,
    knownError: t.knownError,
    aiSummary: requester ? null : t.aiSummary,
    aiTriage: requester ? null : (t.aiTriage ?? null),
    csatScore: t.csatScore,
    csatComment: t.csatComment,
    lastActivityAt: t.lastActivityAt.toISOString(),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}
