import type { Notification } from '@prisma/client'
import { notificationKindInfo } from '@/src/lib/notification-kind'
import type { NotificationDTO } from '@/types/notification'

/**
 * Prisma → DTO. O módulo/rótulo/ícone vêm da tabela pura
 * (`src/lib/notification-kind.ts`) para a interface não precisar conhecer os
 * tipos de cada módulo.
 */
export function toNotificationDTO(notification: Notification): NotificationDTO {
  const info = notificationKindInfo(notification.kind)
  return {
    id: notification.id,
    workspaceId: notification.workspaceId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    read: notification.readAt !== null,
    readAt: notification.readAt?.toISOString() ?? null,
    archived: notification.archivedAt !== null,
    archivedAt: notification.archivedAt?.toISOString() ?? null,
    module: info.module,
    moduleLabel: info.moduleLabel,
    kindLabel: info.label,
    icon: info.icon,
    color: info.color,
    createdAt: notification.createdAt.toISOString(),
  }
}
