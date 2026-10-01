import {
  expandSdChangeWindow,
  type SdChangeOccurrence,
  type SdChangeWindowSource,
} from '@/src/lib/servicedesk/change-calendar'
import type { SdScheduledChange } from '@/src/repositories/sd-change-schedule.repository'
import type { SdChangeWindowWithAuthor } from '@/src/repositories/sd-change-window.repository'
import {
  type SdChangeRecurrenceInput,
  SdChangeRecurrenceSchema,
} from '@/src/schemas/sd-change-window.schema'
import type {
  SdChangeCalendarEntryDTO,
  SdChangeRecurrenceDTO,
  SdChangeWindowDTO,
  SdChangeWindowOccurrenceDTO,
} from '@/types/sd-change'

/**
 * `SdChangeWindow` → DTO do calendário. A recorrência salva em JSON é relida
 * pelo schema: JSON inválido (migração manual, ajuste direto no banco) vira
 * `null` em vez de derrubar a tela.
 */

/** JSON salvo → recorrência válida, ou `null`. */
export function toSdChangeRecurrence(
  value: unknown,
): SdChangeRecurrenceInput | null {
  if (value === null || value === undefined) return null
  const parsed = SdChangeRecurrenceSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function toSdChangeWindowDTO(
  window: SdChangeWindowWithAuthor,
): SdChangeWindowDTO {
  const recurrence = toSdChangeRecurrence(window.recurrence)
  return {
    id: window.id,
    name: window.name,
    kind: window.kind,
    startsAt: window.startsAt.toISOString(),
    endsAt: window.endsAt.toISOString(),
    recurrence: recurrence as SdChangeRecurrenceDTO | null,
    timezone: window.timezone,
    configItemIds: window.configItemIds,
    departmentIds: window.departmentIds,
    description: window.description,
    createdBy: window.createdBy,
    createdAt: window.createdAt.toISOString(),
    updatedAt: window.updatedAt.toISOString(),
  }
}

/** Janela do banco → entrada da lib de expansão (só o que ela precisa). */
export function toSdChangeWindowSource(
  window: SdChangeWindowWithAuthor,
): SdChangeWindowSource {
  return {
    id: window.id,
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    recurrence: toSdChangeRecurrence(window.recurrence),
  }
}

/** Ocorrência expandida + os dados da janela → DTO. */
export function toSdChangeOccurrenceDTO(
  occurrence: SdChangeOccurrence,
  window: SdChangeWindowWithAuthor,
): SdChangeWindowOccurrenceDTO {
  return {
    windowId: window.id,
    name: window.name,
    kind: window.kind,
    startsAt: occurrence.startsAt.toISOString(),
    endsAt: occurrence.endsAt.toISOString(),
    timezone: window.timezone,
    configItemIds: window.configItemIds,
    departmentIds: window.departmentIds,
    description: window.description,
    recurring: occurrence.recurring,
  }
}

export function toSdChangeCalendarEntryDTO(
  change: SdScheduledChange,
  extra: {
    code: string
    conflictTicketIds?: string[]
    frozenWindowIds?: string[]
  },
): SdChangeCalendarEntryDTO {
  return {
    ticketId: change.id,
    number: change.number,
    code: extra.code,
    title: change.title,
    type: change.type,
    plannedStartAt: change.plannedStartAt.toISOString(),
    plannedEndAt: change.plannedEndAt.toISOString(),
    phaseName: change.phase.name,
    phaseCategory: change.phase.category,
    changeType: change.changeType,
    changeRisk: change.changeRisk,
    configItemId: change.configItemId,
    configItemName: change.configItem?.name ?? null,
    departmentId: change.departmentId,
    assignee: change.assignee,
    conflictTicketIds: extra.conflictTicketIds ?? [],
    frozenWindowIds: extra.frozenWindowIds ?? [],
  }
}

interface SdWindowOccurrence {
  window: SdChangeWindowWithAuthor
  startsAt: Date
  endsAt: Date
  recurring: boolean
}

/**
 * Expande as janelas candidatas e devolve as ocorrências do intervalo, já
 * emparelhadas com a janela de origem (o que o calendário e a checagem de
 * agenda consomem).
 */
export function sdExpandWindows(
  windows: SdChangeWindowWithAuthor[],
  range: { from: Date; to: Date },
): SdWindowOccurrence[] {
  return windows
    .flatMap((window) =>
      expandSdChangeWindow(toSdChangeWindowSource(window), range).map(
        (occurrence) => ({
          window,
          startsAt: occurrence.startsAt,
          endsAt: occurrence.endsAt,
          recurring: occurrence.recurring,
        }),
      ),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
