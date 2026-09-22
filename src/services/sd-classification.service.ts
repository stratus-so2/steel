import { ok, type Result } from '@/src/lib/result'
import { toSdClassificationDTO } from '@/src/mappers/sd-classification.mapper'
import { SdClassificationRepository } from '@/src/repositories/sd-classification.repository'
import type {
  CreateSdClassificationDTO,
  ListSdClassificationsDTO,
  UpdateSdClassificationDTO,
} from '@/src/schemas/sd-classification.schema'
import type { SdClassificationDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { sdAdminMutation } from './sd-config-support'

export const SdClassificationService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdClassificationsDTO = { includeInactive: false },
  ): Promise<Result<SdClassificationDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdClassificationRepository.list(workspaceId, filters)
    if (!rows.ok) return rows
    return ok(rows.value.map(toSdClassificationDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdClassificationDTO,
  ): Promise<Result<SdClassificationDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_classification',
      action: 'create',
      targetId: (value) => value.id,
      run: async () => {
        const created = await SdClassificationRepository.create(
          workspaceId,
          dto,
        )
        if (!created.ok) return created
        return ok(toSdClassificationDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    classificationId: string,
    dto: UpdateSdClassificationDTO,
  ): Promise<Result<SdClassificationDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_classification',
      action: 'update',
      targetId: classificationId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdClassificationRepository.findById(
          classificationId,
          workspaceId,
        )
        if (!existing.ok) return existing
        const updated = await SdClassificationRepository.update(
          classificationId,
          workspaceId,
          dto,
        )
        if (!updated.ok) return updated
        return ok(toSdClassificationDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    classificationId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_classification',
      action: 'delete',
      targetId: classificationId,
      run: async () => {
        const existing = await SdClassificationRepository.findById(
          classificationId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdClassificationRepository.delete(classificationId, workspaceId)
      },
    })
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_classification',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdClassificationRepository.reorder(workspaceId, orderedIds),
    })
  },
}
