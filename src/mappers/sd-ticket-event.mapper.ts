import type { SdTicketEscalationWithActor } from '@/src/repositories/sd-ticket-escalation.repository'
import type { SdTicketEventWithActor } from '@/src/repositories/sd-ticket-event.repository'
import type {
  SdTicketEscalationDTO,
  SdTicketEventDTO,
  SdUserSummaryDTO,
} from '@/types/sd-ticket'

function actor(
  u: { id: string; name: string; email: string; image: string | null } | null,
): SdUserSummaryDTO | null {
  return u ? { id: u.id, name: u.name, email: u.email, image: u.image } : null
}

export function toSdTicketEventDTO(
  e: SdTicketEventWithActor,
): SdTicketEventDTO {
  return {
    id: e.id,
    ticketId: e.ticketId,
    actorKind: e.actorKind,
    actor: actor(e.actor),
    action: e.action,
    field: e.field,
    fromValue: e.fromValue ?? null,
    toValue: e.toValue ?? null,
    meta:
      e.meta && typeof e.meta === 'object' && !Array.isArray(e.meta)
        ? (e.meta as Record<string, unknown>)
        : null,
    createdAt: e.createdAt.toISOString(),
  }
}

export function toSdTicketEscalationDTO(
  e: SdTicketEscalationWithActor,
): SdTicketEscalationDTO {
  return {
    id: e.id,
    ticketId: e.ticketId,
    kind: e.kind,
    fromLevel: e.fromLevel,
    toLevel: e.toLevel,
    fromDepartmentId: e.fromDepartmentId,
    toDepartmentId: e.toDepartmentId,
    fromAssigneeId: e.fromAssigneeId,
    toAssigneeId: e.toAssigneeId,
    reason: e.reason,
    automatic: e.automatic,
    ruleId: e.ruleId,
    createdBy: actor(e.createdBy),
    createdAt: e.createdAt.toISOString(),
  }
}
