import 'server-only'
import { logFields } from '@/lib/axiom/log-fields'
import { logger } from '@/lib/axiom/logger'
import { getQueueConnection } from '@/src/lib/queue/connection'

/**
 * Tempo real da caixa de entrada: Redis pub/sub por workspace (canal
 * `notifications:workspace:<id>`), consumido pelo SSE
 * `GET /api/workspaces/[id]/notifications/events`.
 *
 * Canal **genérico de notificação**, e não do ServiceDesk: quem publica é
 * `NotificationService.notifyUsers`, por onde passa toda notificação in-app
 * de qualquer módulo (hoje ServiceDesk e Comunicação; o CRM entra de graça
 * quando começar a notificar). O evento é só um aviso — o cliente recarrega a
 * lista pelas rotas normais, que aplicam a autorização. `userIds` viaja no
 * Redis para o SSE filtrar por destinatário e **nunca** chega ao navegador:
 * cada conexão só recebe o que é dela.
 */

export interface NotificationRealtimeEvent {
  type: 'notification.created'
  /** Tipo da notificação criada (`Notification.kind`). */
  kind: string
  /** ISO 8601. */
  at: string
}

interface Envelope {
  event: NotificationRealtimeEvent
  userIds: string[]
}

export function notificationChannelForWorkspace(workspaceId: string): string {
  return `notifications:workspace:${workspaceId}`
}

/** Publica a criação de notificações. Nunca lança (falha só é logada). */
export async function publishNotificationEvent(
  workspaceId: string,
  userIds: string[],
  event: NotificationRealtimeEvent,
): Promise<void> {
  if (userIds.length === 0) return
  const envelope: Envelope = { event, userIds }
  try {
    await getQueueConnection().publish(
      notificationChannelForWorkspace(workspaceId),
      JSON.stringify(envelope),
    )
  } catch (error) {
    logger.error(
      'notifications.realtime.publish_failed',
      logFields(
        {
          component: 'NotificationsRealtime',
          workspaceId,
          message: error instanceof Error ? error.message : String(error),
        },
        { kind: event.kind },
      ),
    )
  }
}

/**
 * Assina os eventos do workspace. `onEvent` recebe o evento e os
 * destinatários. Devolve a função que cancela a assinatura.
 */
export function subscribeNotificationEvents(
  workspaceId: string,
  onEvent: (event: NotificationRealtimeEvent, userIds: string[]) => void,
): () => void {
  const subscriber = getQueueConnection().duplicate()
  const channel = notificationChannelForWorkspace(workspaceId)

  subscriber.subscribe(channel).catch((error: unknown) => {
    logger.error(
      'notifications.realtime.subscribe_failed',
      logFields({
        component: 'NotificationsRealtime',
        workspaceId,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  })

  subscriber.on('message', (receivedChannel: string, payload: string) => {
    if (receivedChannel !== channel) return
    try {
      const parsed = JSON.parse(payload) as Partial<Envelope>
      if (!parsed.event || typeof parsed.event.kind !== 'string') return
      onEvent(parsed.event, Array.isArray(parsed.userIds) ? parsed.userIds : [])
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
