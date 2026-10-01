import { Prisma } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { sdChangeWindowInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  sdPeriodsOverlap,
  sdWindowApplies,
} from '@/src/lib/servicedesk/change-calendar'
import {
  sdExpandWindows,
  toSdChangeCalendarEntryDTO,
  toSdChangeOccurrenceDTO,
  toSdChangeWindowDTO,
} from '@/src/mappers/sd-change-window.mapper'
import { SdChangeScheduleRepository } from '@/src/repositories/sd-change-schedule.repository'
import {
  type SdChangeWindowData,
  SdChangeWindowRepository,
} from '@/src/repositories/sd-change-window.repository'
import type {
  CreateSdChangeWindowDTO,
  SdChangeCalendarQueryDTO,
  UpdateSdChangeWindowDTO,
} from '@/src/schemas/sd-change-window.schema'
import type {
  SdChangeCalendarDTO,
  SdChangeWindowDTO,
  SdChangeWindowOccurrenceDTO,
} from '@/types/sd-change'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'
import { SdTicketEngine, sdTicketCode } from './sd-ticket-engine'

/**
 * Janelas do calendário de mudanças: manutenção (quando pode mexer) e
 * congelamento (quando não pode).
 *
 * Leitura: qualquer agente (o calendário é operação). Escrita: só admins do
 * ServiceDesk, como toda configuração. O período é validado aqui e devolve
 * `SD_CHANGE_WINDOW_INVALID`; a expansão da recorrência é delegada à lib pura
 * `src/lib/servicedesk/change-calendar.ts`.
 */

/** Duração máxima de uma janela (um ano). */
const MAX_DURATION_MS = 366 * 24 * 60 * 60 * 1000

/** Maior intervalo que o calendário aceita consultar de uma vez. */
const MAX_RANGE_MS = 400 * 24 * 60 * 60 * 1000

function assertPeriod(startsAt: Date, endsAt: Date): Result<true> {
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    return err(sdChangeWindowInvalid('Datas inválidas'))
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    return err(
      sdChangeWindowInvalid('O fim da janela precisa ser depois do início'),
    )
  }
  if (endsAt.getTime() - startsAt.getTime() > MAX_DURATION_MS) {
    return err(sdChangeWindowInvalid('A janela não pode passar de um ano'))
  }
  return ok(true)
}

/** `recurrence.until` precisa ser depois do início da janela. */
function assertRecurrence(
  startsAt: Date,
  recurrence: CreateSdChangeWindowDTO['recurrence'],
): Result<true> {
  if (!recurrence?.until) return ok(true)
  const until = Date.parse(`${recurrence.until}T23:59:59.999Z`)
  if (until <= startsAt.getTime()) {
    return err(
      sdChangeWindowInvalid('A repetição termina antes da primeira ocorrência'),
    )
  }
  return ok(true)
}

/** DTO de entrada → dados do repositório (`Prisma.DbNull` limpa o JSON). */
function toData(
  dto: CreateSdChangeWindowDTO | UpdateSdChangeWindowDTO,
): SdChangeWindowData {
  const data: SdChangeWindowData = {}
  if (dto.name !== undefined) data.name = dto.name
  if (dto.kind !== undefined) data.kind = dto.kind
  if (dto.startsAt !== undefined) data.startsAt = dto.startsAt
  if (dto.endsAt !== undefined) data.endsAt = dto.endsAt
  if (dto.timezone !== undefined) data.timezone = dto.timezone
  if (dto.configItemIds !== undefined) data.configItemIds = dto.configItemIds
  if (dto.departmentIds !== undefined) data.departmentIds = dto.departmentIds
  if (dto.description !== undefined) data.description = dto.description ?? null
  if (dto.recurrence !== undefined) {
    data.recurrence = dto.recurrence
      ? (dto.recurrence as Prisma.InputJsonValue)
      : Prisma.DbNull
  }
  return data
}

export const SdChangeWindowService = {
  /** Lista as janelas cadastradas (agentes; a configuração é só de admin). */
  async list(
    actorId: string,
    workspaceId: string,
    options: { kind?: 'MAINTENANCE' | 'FREEZE' } = {},
  ): Promise<Result<SdChangeWindowDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-change-calendar',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    const rows = await SdChangeWindowRepository.list(workspaceId, options)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdChangeWindowDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdChangeWindowDTO,
  ): Promise<Result<SdChangeWindowDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_change_window',
      action: 'create',
      targetId: (value) => value.id,
      meta: { kind: dto.kind },
      run: async () => {
        const period = assertPeriod(dto.startsAt, dto.endsAt)
        if (!period.ok) return period
        const recurrence = assertRecurrence(dto.startsAt, dto.recurrence)
        if (!recurrence.ok) return recurrence
        const refs = await assertSdRefs(workspaceId, {
          departmentIds: dto.departmentIds,
        })
        if (!refs.ok) return refs

        const created = await SdChangeWindowRepository.create(
          workspaceId,
          actorId,
          {
            ...toData(dto),
            name: dto.name,
            startsAt: dto.startsAt,
            endsAt: dto.endsAt,
          },
        )
        if (!created.ok) return created
        logger.info('servicedesk.change_window.created', {
          workspaceId,
          windowId: created.value.id,
          kind: created.value.kind,
          recurring: created.value.recurrence !== null,
        })
        return ok(toSdChangeWindowDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    windowId: string,
    dto: UpdateSdChangeWindowDTO,
  ): Promise<Result<SdChangeWindowDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_change_window',
      action: 'update',
      targetId: windowId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdChangeWindowRepository.findById(
          windowId,
          workspaceId,
        )
        if (!existing.ok) return existing

        const startsAt = dto.startsAt ?? existing.value.startsAt
        const endsAt = dto.endsAt ?? existing.value.endsAt
        const period = assertPeriod(startsAt, endsAt)
        if (!period.ok) return period
        const recurrence = assertRecurrence(startsAt, dto.recurrence)
        if (!recurrence.ok) return recurrence
        if (dto.departmentIds) {
          const refs = await assertSdRefs(workspaceId, {
            departmentIds: dto.departmentIds,
          })
          if (!refs.ok) return refs
        }

        const updated = await SdChangeWindowRepository.update(
          windowId,
          workspaceId,
          toData(dto),
        )
        if (!updated.ok) return updated
        return ok(toSdChangeWindowDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    windowId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_change_window',
      action: 'delete',
      targetId: windowId,
      run: async () => {
        const existing = await SdChangeWindowRepository.findById(
          windowId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdChangeWindowRepository.softDelete(windowId, workspaceId)
      },
    })
  },

  /**
   * Calendário do intervalo: as ocorrências das janelas (faixas de fundo) e
   * as mudanças agendadas, cada uma já com os congelamentos que a cobrem e os
   * conflitos de item de configuração detectados no mesmo intervalo.
   */
  async calendar(
    actorId: string,
    workspaceId: string,
    query: SdChangeCalendarQueryDTO,
  ): Promise<Result<SdChangeCalendarDTO>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-change-calendar',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx
    if (query.to.getTime() - query.from.getTime() > MAX_RANGE_MS) {
      return err(
        sdChangeWindowInvalid('Consulte no máximo 400 dias de calendário'),
      )
    }

    const range = { from: query.from, to: query.to }
    const [windows, changes, config] = await Promise.all([
      SdChangeWindowRepository.listForRange(workspaceId, range, {
        kind: query.kind,
      }),
      SdChangeScheduleRepository.listInRange(workspaceId, range),
      SdTicketEngine.loadConfig(workspaceId),
    ])
    if (!windows.ok) return windows
    if (!changes.ok) return changes
    if (!config.ok) return config

    const occurrences = sdExpandWindows(windows.value, range)
    const windowDTOs: SdChangeWindowOccurrenceDTO[] = occurrences.map((o) =>
      toSdChangeOccurrenceDTO(
        {
          windowId: o.window.id,
          startsAt: o.startsAt,
          endsAt: o.endsAt,
          recurring: o.recurring,
        },
        o.window,
      ),
    )

    const entries = changes.value.map((change) => {
      const frozenWindowIds = occurrences
        .filter(
          (o) =>
            o.window.kind === 'FREEZE' &&
            sdWindowApplies(o.window, change) &&
            sdPeriodsOverlap(
              o.startsAt,
              o.endsAt,
              change.plannedStartAt,
              change.plannedEndAt,
            ),
        )
        .map((o) => o.window.id)
      const conflictTicketIds = change.configItemId
        ? changes.value
            .filter(
              (other) =>
                other.id !== change.id &&
                other.configItemId === change.configItemId &&
                other.phase.category !== 'CLOSED' &&
                other.phase.category !== 'CANCELED' &&
                change.phase.category !== 'CLOSED' &&
                change.phase.category !== 'CANCELED' &&
                sdPeriodsOverlap(
                  other.plannedStartAt,
                  other.plannedEndAt,
                  change.plannedStartAt,
                  change.plannedEndAt,
                ),
            )
            .map((other) => other.id)
        : []
      return toSdChangeCalendarEntryDTO(change, {
        code: sdTicketCode(change, config.value.prefixes),
        conflictTicketIds,
        frozenWindowIds: [...new Set(frozenWindowIds)],
      })
    })

    return ok({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      windows: windowDTOs,
      changes: entries,
    })
  },
}
