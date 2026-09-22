import { sdCategoryLevelInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  pruneSdCategoryOrphans,
  toSdCategoryDTO,
} from '@/src/mappers/sd-category.mapper'
import { SdCategoryRepository } from '@/src/repositories/sd-category.repository'
import {
  type CreateSdCategoryDTO,
  expectedSdCategoryLevel,
  type ListSdCategoriesDTO,
  type SdCategoryLevelValue,
  type UpdateSdCategoryDTO,
} from '@/src/schemas/sd-category.schema'
import type { SdCategoryDTO } from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

const LEVEL_LABEL: Record<SdCategoryLevelValue, string> = {
  CATEGORY: 'categoria',
  SUBCATEGORY: 'subcategoria',
  SERVICE: 'serviço',
}

/** Confere o nível pedido contra o nível do pai. */
async function assertLevel(
  workspaceId: string,
  parentId: string | null,
  level: SdCategoryLevelValue,
): Promise<Result<true>> {
  let parentLevel: SdCategoryLevelValue | null = null
  if (parentId) {
    const parent = await SdCategoryRepository.findById(parentId, workspaceId)
    if (!parent.ok) return parent
    parentLevel = parent.value.level
  }
  const expected = expectedSdCategoryLevel(parentLevel)
  if (expected === null) {
    return err(sdCategoryLevelInvalid('Um serviço não pode ter filhos'))
  }
  if (expected !== level) {
    return err(
      sdCategoryLevelInvalid(
        `Neste ponto da árvore o item precisa ser ${LEVEL_LABEL[expected]}`,
      ),
    )
  }
  return ok(true)
}

export const SdCategoryService = {
  /**
   * Catálogo (lista plana ordenada). Solicitantes veem só os nós ativos e
   * visíveis no portal (com todos os ancestrais visíveis).
   */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdCategoriesDTO = { includeInactive: false },
  ): Promise<Result<SdCategoryDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const rows = await SdCategoryRepository.list(workspaceId, {
      ticketType: filters.ticketType,
      includeInactive: ctx.value.isAgent && filters.includeInactive,
    })
    if (!rows.ok) return rows

    const all = rows.value.map(toSdCategoryDTO)
    if (ctx.value.isAgent) return ok(all)
    return ok(pruneSdCategoryOrphans(all.filter((c) => c.portalVisible)))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdCategoryDTO,
  ): Promise<Result<SdCategoryDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_category',
      action: 'create',
      targetId: (value) => value.id,
      run: async () => {
        const level = await assertLevel(
          workspaceId,
          dto.parentId ?? null,
          dto.level,
        )
        if (!level.ok) return level
        const refs = await assertSdRefs(workspaceId, {
          departmentIds: [dto.departmentId],
          slaPolicyIds: [dto.slaPolicyId],
        })
        if (!refs.ok) return refs

        const created = await SdCategoryRepository.create(workspaceId, dto)
        if (!created.ok) return created
        return ok(toSdCategoryDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    categoryId: string,
    dto: UpdateSdCategoryDTO,
  ): Promise<Result<SdCategoryDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_category',
      action: 'update',
      targetId: categoryId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdCategoryRepository.findById(
          categoryId,
          workspaceId,
        )
        if (!existing.ok) return existing

        if (dto.parentId !== undefined || dto.level !== undefined) {
          const parentId =
            dto.parentId !== undefined ? dto.parentId : existing.value.parentId
          const level = dto.level ?? existing.value.level
          if (parentId === categoryId) {
            return err(
              sdCategoryLevelInvalid('Um item não pode ser pai de si mesmo'),
            )
          }
          const valid = await assertLevel(workspaceId, parentId, level)
          if (!valid.ok) return valid
          if (level !== existing.value.level) {
            const children =
              await SdCategoryRepository.countChildren(categoryId)
            if (!children.ok) return children
            if (children.value > 0) {
              return err(
                sdCategoryLevelInvalid(
                  'Um item com filhos não pode mudar de nível',
                ),
              )
            }
          }
        }
        const refs = await assertSdRefs(workspaceId, {
          departmentIds: [dto.departmentId],
          slaPolicyIds: [dto.slaPolicyId],
        })
        if (!refs.ok) return refs

        const updated = await SdCategoryRepository.update(
          categoryId,
          workspaceId,
          dto,
        )
        if (!updated.ok) return updated
        return ok(toSdCategoryDTO(updated.value))
      },
    })
  },

  async remove(
    actorId: string,
    workspaceId: string,
    categoryId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_category',
      action: 'delete',
      targetId: categoryId,
      run: async () => {
        const existing = await SdCategoryRepository.findById(
          categoryId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdCategoryRepository.delete(categoryId, workspaceId)
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
      entity: 'sd_category',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdCategoryRepository.reorder(workspaceId, orderedIds),
    })
  },
}
