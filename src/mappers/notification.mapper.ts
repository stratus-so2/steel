import type { Notification } from '@prisma/client'
import type { NotificationDTO } from '@/types/notification'

export function toNotificationDTO(notification: Notification): NotificationDTO {
  return {
    id: notification.id,
    workspaceId: notification.workspaceId,
    kind: notification.kind,
    title: notification.title,
    body: notification.body,
    href: notification.href,
    read: notification.readAt !== null,
    createdAt: notification.createdAt.toISOString(),
  }
}
