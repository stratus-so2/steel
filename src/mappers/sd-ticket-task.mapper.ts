import type { SdTicketTaskWithRelations } from '@/src/repositories/sd-ticket-task.repository'
import type {
  SdTicketTaskDTO,
  SdTicketTaskListDTO,
  SdTicketTaskProgressDTO,
} from '@/types/sd-ticket-task'

const OPEN = new Set(['TODO', 'IN_PROGRESS'])

export function toSdTicketTaskDTO(
  row: SdTicketTaskWithRelations,
  now = new Date(),
): SdTicketTaskDTO {
  return {
    id: row.id,
    ticketId: row.ticketId,
    title: row.title,
    description: row.description,
    status: row.status,
    assignee: row.assignee,
    dueDate: row.dueDate?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    position: row.position,
    overdue:
      OPEN.has(row.status) &&
      row.dueDate !== null &&
      row.dueDate.getTime() < now.getTime(),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** Progresso: concluídas / total sem as canceladas. */
export function sdTaskProgress(
  rows: Pick<SdTicketTaskWithRelations, 'status'>[],
): SdTicketTaskProgressDTO {
  const active = rows.filter((r) => r.status !== 'CANCELED')
  const done = active.filter((r) => r.status === 'DONE').length
  const total = active.length
  return {
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
  }
}

export function toSdTicketTaskListDTO(
  rows: SdTicketTaskWithRelations[],
  now = new Date(),
): SdTicketTaskListDTO {
  return {
    items: rows.map((row) => toSdTicketTaskDTO(row, now)),
    progress: sdTaskProgress(rows),
  }
}
