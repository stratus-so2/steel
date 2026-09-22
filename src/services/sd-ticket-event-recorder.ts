import type { SdMessageAuthorKind } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { ok, type Result } from '@/src/lib/result'
import {
  type SdTicketEventInput,
  SdTicketEventRepository,
} from '@/src/repositories/sd-ticket-event.repository'

export type { SdTicketEventInput }

/**
 * Grava eventos de rastreabilidade (`SdTicketEvent`, append-only). Usado
 * por toda mutação de chamado — também pelas outras fatias (mensagens,
 * tarefas, custos, aprovações, assinaturas). Nunca derruba o fluxo de quem
 * chamou: falha só é logada (devolve `ok(0)`).
 *
 * Convenção de `action`: `ticket.created`, `field.changed`,
 * `phase.changed`, `ticket.reopened`, `participant.added`,
 * `participant.removed`, `escalated`, `sla.at_risk`,
 * `sla.first_response_breached`, `sla.resolution_breached`,
 * `automation.applied`, `automation.failed`, `message.posted`,
 * `task.created`, `parent.changed`, `ticket.deleted`, `ticket.auto_closed`…
 * Relações vão em `fromValue`/`toValue` como `{ id, label }`.
 */
export async function recordSdTicketEvent(
  events: SdTicketEventInput | SdTicketEventInput[],
): Promise<Result<number>> {
  const list = Array.isArray(events) ? events : [events]
  const result = await SdTicketEventRepository.createMany(list)
  if (!result.ok) {
    logger.error('servicedesk.ticket_event.record_failed', {
      count: list.length,
      actions: list.map((e) => e.action).join(','),
      reason: result.error.code,
    })
    return ok(0)
  }
  return result
}

/** `actorKind` do evento a partir de quem agiu. */
export function sdEventActorKind(actor: {
  kind: 'user' | 'system'
  isAgent?: boolean
}): SdMessageAuthorKind {
  if (actor.kind === 'system') return 'SYSTEM'
  return actor.isAgent ? 'AGENT' : 'REQUESTER'
}
