import type { NotificationKind } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { NotificationAudienceRepository } from '@/src/repositories/notification-audience.repository'
import { NotificationService } from './notification.service'

/**
 * Inbox notices of the Comunicação (WhatsApp) module. Thin layer over
 * `NotificationService.notifyUsers` that resolves the workspace slug for the
 * link, never notifies whoever caused the event and **never fails the
 * caller**: every problem is only logged, so a notice can't break the
 * business operation that triggered it.
 */

/** Admins told about a module-wide event, at most (no fan-out storm). */
export const WHATSAPP_NOTIFY_ADMIN_CAP = 20

export interface WhatsAppNotifyInput {
  workspaceId: string
  kind: NotificationKind
  userIds: (string | null | undefined)[]
  /** Who caused the event — never notified. */
  actorId?: string | null
  title: string
  body: string
  /** Internal path, built with the workspace slug. */
  hrefFor: (slug: string) => string
  /** Extra context for the log. */
  meta?: Record<string, unknown>
}

/** Delivers the notice; returns how many inbox rows were created. */
export async function notifyWhatsAppUsers(
  input: WhatsAppNotifyInput,
): Promise<number> {
  const userIds = Array.from(
    new Set(
      input.userIds.filter(
        (id): id is string =>
          typeof id === 'string' && id !== '' && id !== input.actorId,
      ),
    ),
  )
  if (userIds.length === 0) return 0

  const fail = (reason: string) => {
    logger.warn('whatsapp.notify.failed', {
      workspaceId: input.workspaceId,
      kind: input.kind,
      reason,
      ...input.meta,
    })
    return 0
  }

  const slug = await NotificationAudienceRepository.findWorkspaceSlug(
    input.workspaceId,
  )
  if (!slug.ok) return fail(slug.error.code)
  if (!slug.value) return fail('WORKSPACE_MISSING')

  const created = await NotificationService.notifyUsers({
    workspaceId: input.workspaceId,
    userIds,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.hrefFor(slug.value),
  })
  if (!created.ok) return fail(created.error.code)

  logger.info('whatsapp.notify.delivered', {
    workspaceId: input.workspaceId,
    kind: input.kind,
    recipients: created.value,
    ...input.meta,
  })
  return created.value
}

/** OWNER/ADMIN members (capped). Empty on failure, which is only logged. */
export async function whatsAppAdminIds(workspaceId: string): Promise<string[]> {
  const admins = await NotificationAudienceRepository.listPrivilegedUserIds(
    workspaceId,
    WHATSAPP_NOTIFY_ADMIN_CAP,
  )
  if (admins.ok) return admins.value
  logger.warn('whatsapp.notify.admins_failed', {
    workspaceId,
    reason: admins.error.code,
  })
  return []
}

/** Link to a conversation in the Comunicação inbox. */
export function whatsAppConversationHref(
  slug: string,
  conversationId: string,
): string {
  return `/${slug}/zap?conversa=${conversationId}`
}
