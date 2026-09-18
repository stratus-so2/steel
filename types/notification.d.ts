export type NotificationKindDTO = 'WHATSAPP_NEGATIVE_SENTIMENT'

export interface NotificationDTO {
  id: string
  workspaceId: string
  kind: NotificationKindDTO
  title: string
  body: string
  href: string | null
  read: boolean
  createdAt: string
}

export interface NotificationListDTO {
  items: NotificationDTO[]
  unreadCount: number
}
