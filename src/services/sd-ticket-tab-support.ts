import type { SdMessageAuthorKind } from '@prisma/client'
import { sdNotAgent, sdTicketClosed, sdTicketForbidden } from '@/src/errors'
import type { PermissionAction } from '@/src/lib/permissions'
import { err, ok, type Result } from '@/src/lib/result'
import {
  publishSdTicketEvent,
  type SdTicketAudience,
  type SdTicketRealtimeEventType,
} from '@/src/lib/servicedesk/realtime'
import type { SdTicketWithRelations } from '@/src/repositories/sd-ticket.repository'
import { SdAccess, type SdAccessContext } from './sd-access'
import {
  type SdActor,
  type SdEngineConfig,
  SdTicketEngine,
  sdTicketCode,
  sdUserActor,
} from './sd-ticket-engine'
import { canViewSdTicket } from './sd-ticket-visibility'

/**
 * Base comum dos services das abas do chamado (histórico, anexos, tarefas,
 * custos, peças, aprovações, assinaturas): acesso ao módulo com a
 * permissão `sd-tickets` × ação, papel (agente × solicitante), chamado por
 * id/número/código e visibilidade — mesma regra da fatia de chamados.
 */
export interface SdTicketTabScope {
  ctx: SdAccessContext
  config: SdEngineConfig
  ticket: SdTicketWithRelations
  actor: SdActor
  /** `INC-000123`. */
  code: string
}

export interface SdTicketTabScopeOptions {
  /** Só agentes (tarefas, custos, peças, aprovações). */
  agentOnly?: boolean
  /** Recusa chamados CLOSED/CANCELED (`SD_TICKET_CLOSED`). */
  requireOpen?: boolean
}

const LOCKED = new Set(['CLOSED', 'CANCELED'])

export function isSdTicketLocked(
  ticket: Pick<SdTicketWithRelations, 'phase'>,
): boolean {
  return LOCKED.has(ticket.phase.category)
}

export async function loadSdTicketTab(
  actorId: string,
  workspaceId: string,
  ticketRef: string,
  action: PermissionAction,
  options: SdTicketTabScopeOptions = {},
): Promise<Result<SdTicketTabScope>> {
  const ctx = await SdAccess.resolve(actorId, workspaceId, {
    resource: 'sd-tickets',
    action,
  })
  if (!ctx.ok) return ctx
  if (options.agentOnly && !ctx.value.isAgent) return err(sdNotAgent())

  const config = await SdTicketEngine.loadConfig(workspaceId)
  if (!config.ok) return config
  const ticket = await SdTicketEngine.resolveRef(
    workspaceId,
    ticketRef,
    config.value.prefixes,
  )
  if (!ticket.ok) return ticket
  if (!canViewSdTicket(ctx.value, ticket.value)) return err(sdTicketForbidden())
  if (options.requireOpen && isSdTicketLocked(ticket.value)) {
    return err(sdTicketClosed())
  }

  return ok({
    ctx: ctx.value,
    config: config.value,
    ticket: ticket.value,
    actor: sdUserActor(ctx.value),
    code: sdTicketCode(ticket.value, config.value.prefixes),
  })
}

export function sdTicketAudience(
  ticket: Pick<
    SdTicketWithRelations,
    'requesterId' | 'participants' | 'contact'
  >,
): SdTicketAudience {
  return {
    requesterId: ticket.requesterId,
    participantIds: ticket.participants.map((p) => p.userId),
    contactUserId: ticket.contact?.userId ?? null,
  }
}

/** Aviso de tempo real da aba (o cliente recarrega pela rota). */
export async function publishSdTicketTab(
  ticket: Pick<
    SdTicketWithRelations,
    'id' | 'number' | 'workspaceId' | 'requesterId' | 'participants' | 'contact'
  >,
  type: SdTicketRealtimeEventType,
  actorId: string | null,
  internal = false,
): Promise<void> {
  await publishSdTicketEvent(
    ticket.workspaceId,
    {
      type,
      ticketId: ticket.id,
      number: ticket.number,
      at: new Date().toISOString(),
      actorId,
      ...(internal ? { internal: true } : {}),
    },
    sdTicketAudience(ticket),
  )
}

/** Tipo de autor/ator a partir do contexto de acesso. */
export function sdTabAuthorKind(ctx: SdAccessContext): SdMessageAuthorKind {
  return ctx.isAgent ? 'AGENT' : 'REQUESTER'
}
