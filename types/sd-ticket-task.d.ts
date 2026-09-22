import type { SdUserSummaryDTO } from './sd-ticket'

export type SdTaskStatusDTO = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'

export interface SdTicketTaskDTO {
  id: string
  ticketId: string
  title: string
  description: string | null
  status: SdTaskStatusDTO
  assignee: SdUserSummaryDTO | null
  dueDate: string | null
  completedAt: string | null
  position: number
  /** Prazo vencido e ainda não concluída/cancelada. */
  overdue: boolean
  createdBy: SdUserSummaryDTO | null
  createdAt: string
  updatedAt: string
}

export interface SdTicketTaskProgressDTO {
  done: number
  /** Sem as canceladas. */
  total: number
  /** 0–100 (inteiro). */
  percent: number
}

export interface SdTicketTaskListDTO {
  items: SdTicketTaskDTO[]
  progress: SdTicketTaskProgressDTO
}
