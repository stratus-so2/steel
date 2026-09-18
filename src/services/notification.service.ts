import type { NotificationKind } from '@prisma/client'
import { ok, type Result } from '@/src/lib/result'
import { toNotificationDTO } from '@/src/mappers/notification.mapper'
import { NotificationRepository } from '@/src/repositories/notification.repository'
import type { MarkNotificationsReadDTO } from '@/src/schemas/notification.schema'
import type { NotificationListDTO } from '@/types/notification'
import { assertMember } from './authz'

const LIST_LIMIT = 50

export const NotificationService = {
  /** Caixa de entrada do usuário no workspace (mais recentes primeiro). */
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<NotificationListDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const [items, unread] = await Promise.all([
      NotificationRepository.listByUser(workspaceId, actorId, LIST_LIMIT),
      NotificationRepository.countUnread(workspaceId, actorId),
    ])
    if (!items.ok) return items
    if (!unread.ok) return unread

    return ok({
      items: items.value.map(toNotificationDTO),
      unreadCount: unread.value,
    })
  },

  /** Marca como lidas as próprias notificações (todas, ou só `ids`). */
  async markRead(
    actorId: string,
    workspaceId: string,
    dto: MarkNotificationsReadDTO,
  ): Promise<Result<{ updated: number }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const updated = await NotificationRepository.markRead(
      workspaceId,
      actorId,
      dto.ids,
    )
    if (!updated.ok) return updated
    return ok({ updated: updated.value })
  },

  /**
   * Cria a mesma notificação para vários usuários. Fluxo de sistema: quem
   * chama já decidiu os destinatários (membros do workspace).
   */
  async notifyUsers(input: {
    workspaceId: string
    userIds: string[]
    kind: NotificationKind
    title: string
    body: string
    href?: string
  }): Promise<Result<number>> {
    const userIds = Array.from(new Set(input.userIds))
    return NotificationRepository.createMany(
      userIds.map((userId) => ({
        workspaceId: input.workspaceId,
        userId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        href: input.href ?? null,
      })),
    )
  },
}
