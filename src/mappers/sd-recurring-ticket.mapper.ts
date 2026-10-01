import {
  firstSdOccurrence,
  nextSdOccurrences,
  type SdRecurrenceSchedule,
} from '@/src/lib/servicedesk/recurrence'
import { toSdTemplateDefaults } from '@/src/mappers/sd-ticket-template.mapper'
import type {
  SdRecurringTicketRunWithTicket,
  SdRecurringTicketWithRelations,
} from '@/src/repositories/sd-recurring-ticket.repository'
import type {
  SdRecurringTicketDTO,
  SdRecurringTicketRunDTO,
} from '@/types/sd-recurring-ticket'

/**
 * `SdRecurringTicket`/`SdRecurringTicketRun` → DTO. `upcoming` é calculado
 * na leitura pela lib de agenda (`src/lib/servicedesk/recurrence.ts`), então
 * a tela mostra as próximas ocorrências mesmo numa rotina que acabou de ser
 * criada e ainda não rodou.
 */

/** A agenda da regra no formato que a lib de recorrência entende. */
export function toSdRecurrenceSchedule(
  row: Pick<
    SdRecurringTicketWithRelations,
    | 'frequency'
    | 'interval'
    | 'byWeekday'
    | 'byMonthday'
    | 'atTime'
    | 'timezone'
    | 'startsAt'
    | 'endsAt'
    | 'leadTimeMinutes'
  >,
): SdRecurrenceSchedule {
  return {
    frequency: row.frequency,
    interval: row.interval,
    byWeekday: row.byWeekday,
    byMonthday: row.byMonthday,
    atTime: row.atTime,
    timezone: row.timezone,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    leadTimeMinutes: row.leadTimeMinutes,
  }
}

const UPCOMING = 5

export function toSdRecurringTicketDTO(
  row: SdRecurringTicketWithRelations,
  now = new Date(),
): SdRecurringTicketDTO {
  const schedule = toSdRecurrenceSchedule(row)
  const first = row.active ? firstSdOccurrence(schedule, now) : null
  const upcoming = first
    ? [
        first,
        ...nextSdOccurrences(schedule, first.scheduledFor, UPCOMING - 1),
      ].map((occurrence) => occurrence.scheduledFor.toISOString())
    : []

  return {
    id: row.id,
    workspaceId: row.workspaceId,
    name: row.name,
    description: row.description,
    active: row.active,
    ticketType: row.ticketType,
    templateId: row.templateId,
    template: row.template ? { ...row.template } : null,
    defaults: toSdTemplateDefaults(row.defaults),
    customerId: row.customerId,
    customer: row.customer ? { ...row.customer } : null,
    configItemId: row.configItemId,
    configItem: row.configItem ? { ...row.configItem } : null,
    departmentId: row.departmentId,
    assigneeId: row.assigneeId,
    frequency: row.frequency,
    interval: row.interval,
    byWeekday: row.byWeekday,
    byMonthday: row.byMonthday,
    atTime: row.atTime,
    timezone: row.timezone,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt?.toISOString() ?? null,
    leadTimeMinutes: row.leadTimeMinutes,
    skipIfOpen: row.skipIfOpen,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    nextRunAt: row.nextRunAt?.toISOString() ?? null,
    upcoming,
    runCount: row._count.runs,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toSdRecurringTicketRunDTO(
  row: SdRecurringTicketRunWithTicket,
): SdRecurringTicketRunDTO {
  return {
    id: row.id,
    recurringId: row.recurringId,
    scheduledFor: row.scheduledFor.toISOString(),
    status: row.status,
    ticketId: row.ticketId,
    ticket: row.ticket ? { ...row.ticket } : null,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  }
}
