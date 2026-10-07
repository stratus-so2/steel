import {
  notificationConversationRef,
  notificationModuleOf,
  notificationTicketRef,
} from '@/src/lib/notification-kind'
import type { NotificationDTO } from '@/types/notification'

/**
 * Per-kind quick actions of the inbox, as pure functions of the
 * notification (no I/O), so the reading panel and the tests share them.
 */

/** Kinds where "Responder" makes sense: someone wrote or mentioned you. */
const REPLY_KINDS = new Set([
  'SD_TICKET_MESSAGE',
  'SD_TICKET_MENTIONED',
  'SD_TICKET_ASSIGNED',
  'SD_TICKET_REOPENED',
  'SD_KB_COMMENT',
  'WHATSAPP_CONVERSATION_ASSIGNED',
  'WHATSAPP_AI_HANDOFF',
  'WHATSAPP_NEGATIVE_SENTIMENT',
])

function withParams(href: string, params: Record<string, string>): string {
  const [beforeHash, hash] = href.split('#')
  const [path, search = ''] = beforeHash.split('?')
  const query = new URLSearchParams(search)
  for (const [key, value] of Object.entries(params)) query.set(key, value)
  return `${path}?${query.toString()}${hash ? `#${hash}` : ''}`
}

/**
 * Where "Responder" goes: the ticket history with the composer focused
 * (`?tab=history&reply=1`) or the WhatsApp conversation (its composer is
 * always open). `null` when the kind has nothing to reply to.
 */
export function notificationReplyHref(
  notification: Pick<NotificationDTO, 'kind' | 'href'>,
): string | null {
  const { href } = notification
  if (!href || !REPLY_KINDS.has(notification.kind)) return null
  if (notificationTicketRef(href)) {
    return withParams(href, { tab: 'history', reply: '1' })
  }
  if (notificationConversationRef(href)) return href
  return null
}

/**
 * "Silenciar este tipo": the ServiceDesk keeps its own per-event
 * preferences; everything else is on Settings → Notificações.
 */
export function notificationMuteHref(slug: string, kind: string): string {
  return notificationModuleOf(kind) === 'SERVICE_DESK'
    ? `/${slug}/servicedesk/settings?tab=notifications`
    : `/${slug}/settings/notifications`
}

/** What "Atribuir a mim" would act on, from the notification link. */
export function notificationAssignRef(
  href: string | null | undefined,
): { type: 'ticket' | 'conversation' } | null {
  if (notificationTicketRef(href)) return { type: 'ticket' }
  if (notificationConversationRef(href)) return { type: 'conversation' }
  return null
}

/** Snooze state for the badges: hidden until later, or already back. */
export function notificationSnoozeState(
  snoozedUntil: string | null,
  now: number,
): 'snoozed' | 'resurfaced' | null {
  if (!snoozedUntil) return null
  return Date.parse(snoozedUntil) > now ? 'snoozed' : 'resurfaced'
}
