import { ok, type Result } from '@/src/lib/result'
import { toSdPartDTO } from '@/src/mappers/sd-part.mapper'
import { SdPartRepository } from '@/src/repositories/sd-part.repository'
import type {
  CreateSdPartDTO,
  ListSdPartsDTO,
  UpdateSdPartDTO,
} from '@/src/schemas/sd-part.schema'
import type { SdPartDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { sdAdminMutation } from './sd-config-support'

/** Catálogo de peças: agentes consultam, admins mantêm. */
export const SdPartService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdPartsDTO = { includeInactive: false },
  ): Promise<Result<SdPartDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdPartRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdPartDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdPartDTO,
  ): Promise<Result<SdPartDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_part',
      action: 'create',
      targetId: (value) => value.id,
      run: async () => {
        const created = await SdPartRepository.create(workspaceId, dto)
        if (!created.ok) return created
        return ok(toSdPartDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    partId: string,
    dto: UpdateSdPartDTO,
  ): Promise<Result<SdPartDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_part',
      action: 'update',
      targetId: partId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdPartRepository.findById(partId, workspaceId)
        if (!existing.ok) return existing
        const updated = await SdPartRepository.update(partId, workspaceId, dto)
        if (!updated.ok) return updated
        return ok(toSdPartDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    partId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_part',
      action: 'delete',
      targetId: partId,
      run: async () => {
        const existing = await SdPartRepository.findById(partId, workspaceId)
        if (!existing.ok) return existing
        return SdPartRepository.delete(partId, workspaceId)
      },
    })
  },
}
