import 'server-only'
import { logger } from '@/lib/axiom/logger'
import { getQueueConnection } from '@/src/lib/queue/connection'

/**
 * Tempo real dos chamados do ServiceDesk: Redis pub/sub por workspace
 * (canal `servicedesk:workspace:<id>`), consumido pelo SSE
 * `GET /api/workspaces/[id]/servicedesk/events`.
 *
 * O evento é só um **aviso** (quem mudou, qual chamado) — o cliente
 * recarrega o que precisar pelas rotas normais, que aplicam a autorização.
 * `audience` (ids de usuário que podem ver o chamado sem serem agentes:
 * solicitante, participantes, usuário do contato) viaja junto no Redis e é
 * usado pelo SSE para filtrar solicitantes; nunca é enviado ao navegador.
 * `internal: true` (ex.: nota interna) nunca chega a solicitantes.
 */

export const SD_TICKET_REALTIME_EVENT_TYPES = [
  'ticket.created',
  'ticket.updated',
  'ticket.phase_changed',
  'ticket.assigned',
  'ticket.deleted',
  'ticket.escalated',
  'ticket.sla',
  'ticket.participants',
  'ticket.message',
  'ticket.task',
  'ticket.cost',
  'ticket.part',
  'ticket.attachment',
  'ticket.approval',
  'ticket.signature',
] as const

export type SdTicketRealtimeEventType =
  (typeof SD_TICKET_REALTIME_EVENT_TYPES)[number]

export interface SdTicketRealtimeEvent {
  type: SdTicketRealtimeEventType
  ticketId: string
  number: number
  /** ISO 8601. */
  at: string
  /** Usuário que causou o evento (ausente = sistema/automação). */
  actorId?: string | null
  /** Só agentes recebem (ex.: nota interna, custo). */
  internal?: boolean
}

export interface SdTicketAudience {
  requesterId?: string | null
  participantIds?: string[]
  contactUserId?: string | null
}

interface Envelope {
  event: SdTicketRealtimeEvent
  audience: string[]
}

export function sdChannelForWorkspace(workspaceId: string): string {
  return `servicedesk:workspace:${workspaceId}`
}

export function sdAudienceIds(audience: SdTicketAudience = {}): string[] {
  const ids = [
    audience.requesterId,
    audience.contactUserId,
    ...(audience.participantIds ?? []),
  ].filter((id): id is string => typeof id === 'string' && id.length > 0)
  return Array.from(new Set(ids))
}

/** Publica um evento de chamado. Nunca lança (falha só é logada). */
export async function publishSdTicketEvent(
  workspaceId: string,
  event: SdTicketRealtimeEvent,
  audience: SdTicketAudience = {},
): Promise<void> {
  const envelope: Envelope = { event, audience: sdAudienceIds(audience) }
  try {
    await getQueueConnection().publish(
      sdChannelForWorkspace(workspaceId),
      JSON.stringify(envelope),
    )
  } catch (error) {
    logger.error('servicedesk.realtime.publish_failed', {
      workspaceId,
      eventType: event.type,
      message: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * Assina os eventos do workspace. `onEvent` recebe o evento e a audiência.
 * Devolve a função que cancela a assinatura.
 */
export function subscribeSdTicketEvents(
  workspaceId: string,
  onEvent: (event: SdTicketRealtimeEvent, audience: string[]) => void,
): () => void {
  const subscriber = getQueueConnection().duplicate()
  const channel = sdChannelForWorkspace(workspaceId)

  subscriber.subscribe(channel).catch((error: unknown) => {
    logger.error('servicedesk.realtime.subscribe_failed', {
      workspaceId,
      message: error instanceof Error ? error.message : String(error),
    })
  })

  subscriber.on('message', (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) return
    try {
      const parsed = JSON.parse(payload) as Partial<Envelope>
      if (!parsed.event || typeof parsed.event.ticketId !== 'string') return
      onEvent(
        parsed.event,
        Array.isArray(parsed.audience) ? parsed.audience : [],
      )
    } catch {
      // payload malformado: ignora
    }
  })

  return () => {
    subscriber.unsubscribe(channel).finally(() => {
      subscriber.quit().catch(() => undefined)
    })
  }
}

/** Decide se um usuário conectado ao SSE pode receber o evento. */
export function canReceiveSdTicketEvent(
  viewer: { userId: string; isAgent: boolean },
  event: SdTicketRealtimeEvent,
  audience: string[],
): boolean {
  if (viewer.isAgent) return true
  if (event.internal) return false
  return audience.includes(viewer.userId)
}
