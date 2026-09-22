export type NotificationKindDTO =
  | 'WHATSAPP_NEGATIVE_SENTIMENT'
  | 'SD_TICKET_ASSIGNED'
  | 'SD_TICKET_MESSAGE'
  | 'SD_SLA_AT_RISK'
  | 'SD_SLA_BREACHED'
  | 'SD_TICKET_ESCALATED'
  | 'SD_APPROVAL_RESPONDED'

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
