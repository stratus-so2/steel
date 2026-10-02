export type NotificationKindDTO =
  | 'WHATSAPP_NEGATIVE_SENTIMENT'
  | 'SD_TICKET_ASSIGNED'
  | 'SD_TICKET_MESSAGE'
  | 'SD_SLA_AT_RISK'
  | 'SD_SLA_BREACHED'
  | 'SD_TICKET_ESCALATED'
  | 'SD_APPROVAL_RESPONDED'
  | 'SD_TICKET_CREATED'
  | 'SD_TICKET_MENTIONED'
  | 'SD_TICKET_PHASE_CHANGED'
  | 'SD_TICKET_RESOLVED'
  | 'SD_TICKET_REOPENED'
  | 'SD_APPROVAL_REQUESTED'
  | 'SD_TASK_ASSIGNED'
  | 'SD_TICKET_CSAT'
  | 'SD_DIGEST'
  | 'SD_SLA_BREACH_PREDICTED'
  | 'SD_PROBLEM_SUGGESTED'
  | 'SD_KB_REVIEW'
  | 'SD_REPORT_READY'

export type NotificationModuleDTO =
  | 'SERVICE_DESK'
  | 'COMMUNICATION'
  | 'CRM'
  | 'OTHER'

export interface NotificationDTO {
  id: string
  workspaceId: string
  kind: NotificationKindDTO
  title: string
  body: string
  href: string | null
  read: boolean
  /** ISO 8601, ou `null` quando não lida. */
  readAt: string | null
  archived: boolean
  /** ISO 8601, ou `null` quando não arquivada. */
  archivedAt: string | null
  /** Módulo de origem, derivado do `kind` (`src/lib/notification-kind.ts`). */
  module: NotificationModuleDTO
  /** Nome do módulo em pt-BR — o "remetente" da linha. */
  moduleLabel: string
  /** O que aconteceu, em pt-BR (ex.: "SLA em risco"). */
  kindLabel: string
  /** Chave de ícone resolvida pela interface. */
  icon: string
  /** Cor base Tailwind do marcador (ex.: `amber`). */
  color: string
  createdAt: string
}

/** Contagem por pasta, para os marcadores das abas. */
export interface NotificationFolderCountsDTO {
  all: number
  unread: number
  archived: number
}

export interface NotificationListDTO {
  items: NotificationDTO[]
  unreadCount: number
  /** Id para a próxima página, ou `null` no fim da lista. */
  nextCursor: string | null
  counts: NotificationFolderCountsDTO
}

/** Resultado de uma ação (individual ou em lote). */
export interface NotificationActionResultDTO {
  updated: number
}
