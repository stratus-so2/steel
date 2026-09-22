import { sdConfigConflict } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdCalendarDTO } from '@/src/mappers/sd-calendar.mapper'
import { SdCalendarRepository } from '@/src/repositories/sd-calendar.repository'
import type {
  CreateSdCalendarDTO,
  UpdateSdCalendarDTO,
} from '@/src/schemas/sd-calendar.schema'
import type { SdBusinessCalendarDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { sdAdminMutation } from './sd-config-support'

const DEFAULT_REQUIRED =
  'A workspace precisa de um calendário padrão: marque outro como padrão antes'

export const SdCalendarService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdBusinessCalendarDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdCalendarRepository.list(workspaceId)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdCalendarDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdCalendarDTO,
  ): Promise<Result<SdBusinessCalendarDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_business_calendar',
      action: 'create',
      targetId: (value) => value.id,
      run: async () => {
        const defaults = await SdCalendarRepository.countDefaults(workspaceId)
        if (!defaults.ok) return defaults
        const created = await SdCalendarRepository.create(workspaceId, {
          ...dto,
          // O primeiro calendário vira o padrão automaticamente.
          isDefault: dto.isDefault || defaults.value === 0,
        })
        if (!created.ok) return created
        return ok(toSdCalendarDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    calendarId: string,
    dto: UpdateSdCalendarDTO,
  ): Promise<Result<SdBusinessCalendarDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_business_calendar',
      action: 'update',
      targetId: calendarId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdCalendarRepository.findById(
          calendarId,
          workspaceId,
        )
        if (!existing.ok) return existing
        if (dto.isDefault === false && existing.value.isDefault) {
          return err(sdConfigConflict(DEFAULT_REQUIRED))
        }
        const updated = await SdCalendarRepository.update(
          calendarId,
          workspaceId,
          dto,
        )
        if (!updated.ok) return updated
        return ok(toSdCalendarDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    calendarId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_business_calendar',
      action: 'delete',
      targetId: calendarId,
      run: async () => {
        const existing = await SdCalendarRepository.findById(
          calendarId,
          workspaceId,
        )
        if (!existing.ok) return existing
        if (existing.value.isDefault) {
          return err(sdConfigConflict(DEFAULT_REQUIRED))
        }
        return SdCalendarRepository.delete(calendarId, workspaceId)
      },
    })
  },
}
