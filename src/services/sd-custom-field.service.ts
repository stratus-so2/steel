import { Prisma } from '@prisma/client'
import { sdCustomFieldInvalid } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  isSdCustomFieldEmpty,
  validateSdCustomFieldValue,
} from '@/src/lib/servicedesk/custom-fields'
import {
  toSdCustomFieldDTO,
  toSdCustomFieldOptions,
} from '@/src/mappers/sd-custom-field.mapper'
import { SdCustomFieldRepository } from '@/src/repositories/sd-custom-field.repository'
import type {
  CreateSdCustomFieldDTO,
  ListSdCustomFieldsDTO,
  UpdateSdCustomFieldDTO,
} from '@/src/schemas/sd-custom-field.schema'
import type {
  SdCustomFieldDefinitionDTO,
  SdCustomFieldOptionDTO,
  SdCustomFieldTypeDTO,
} from '@/types/sd-config'
import { SdAccess } from './sd-access'
import { assertSdRefs, sdAdminMutation } from './sd-config-support'

/** Valida o padrão contra o tipo/opções e devolve o valor a gravar. */
function normalizeDefault(
  type: SdCustomFieldTypeDTO,
  options: SdCustomFieldOptionDTO[],
  value: unknown,
): Result<Prisma.InputJsonValue | typeof Prisma.JsonNull> {
  if (isSdCustomFieldEmpty(value)) return ok(Prisma.JsonNull)
  const checked = validateSdCustomFieldValue({ type, options }, value)
  if (!checked.ok) {
    return err(sdCustomFieldInvalid(`Valor padrão ${checked.message}`))
  }
  return ok(checked.value as Prisma.InputJsonValue)
}

export const SdCustomFieldService = {
  /** Solicitantes veem só os campos ativos marcados como visíveis no portal. */
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListSdCustomFieldsDTO = { includeInactive: false },
  ): Promise<Result<SdCustomFieldDefinitionDTO[]>> {
    const ctx = await SdAccess.resolve(actorId, workspaceId)
    if (!ctx.ok) return ctx
    const rows = await SdCustomFieldRepository.list(workspaceId, {
      entity: filters.entity,
      includeInactive: ctx.value.isAgent && filters.includeInactive,
    })
    if (!rows.ok) return rows
    const all = rows.value.map(toSdCustomFieldDTO)
    return ok(ctx.value.isAgent ? all : all.filter((f) => f.visibleInPortal))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdCustomFieldDTO,
  ): Promise<Result<SdCustomFieldDefinitionDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_custom_field_definition',
      action: 'create',
      targetId: (value) => value.id,
      meta: { entity: dto.entity, key: dto.key, type: dto.type },
      run: async () => {
        const defaultValue = normalizeDefault(
          dto.type,
          dto.options,
          dto.defaultValue,
        )
        if (!defaultValue.ok) return defaultValue
        const refs = await assertSdRefs(workspaceId, {
          categoryIds: dto.categoryIds,
        })
        if (!refs.ok) return refs

        const created = await SdCustomFieldRepository.create(workspaceId, {
          ...dto,
          defaultValue: defaultValue.value,
        })
        if (!created.ok) return created
        return ok(toSdCustomFieldDTO(created.value))
      },
    })
  },

  async update(
    actorId: string,
    workspaceId: string,
    fieldId: string,
    dto: UpdateSdCustomFieldDTO,
  ): Promise<Result<SdCustomFieldDefinitionDTO>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_custom_field_definition',
      action: 'update',
      targetId: fieldId,
      meta: { fields: Object.keys(dto) },
      run: async () => {
        const existing = await SdCustomFieldRepository.findById(
          fieldId,
          workspaceId,
        )
        if (!existing.ok) return existing

        const options =
          dto.options ?? toSdCustomFieldOptions(existing.value.options)
        if (
          (existing.value.type === 'SELECT' ||
            existing.value.type === 'MULTI_SELECT') &&
          options.length === 0
        ) {
          return err(
            sdCustomFieldInvalid(
              'Campos de seleção precisam de ao menos uma opção',
            ),
          )
        }
        const defaultValue = normalizeDefault(
          existing.value.type,
          options,
          dto.defaultValue !== undefined
            ? dto.defaultValue
            : existing.value.defaultValue,
        )
        if (!defaultValue.ok) return defaultValue

        const refs = await assertSdRefs(workspaceId, {
          categoryIds: dto.categoryIds,
        })
        if (!refs.ok) return refs

        const updated = await SdCustomFieldRepository.update(
          fieldId,
          workspaceId,
          { ...dto, defaultValue: defaultValue.value },
        )
        if (!updated.ok) return updated
        return ok(toSdCustomFieldDTO(updated.value))
      },
    })
  },

  /** Remove a definição (valores já gravados ficam no JSON, sem rótulo). */
  async remove(
    actorId: string,
    workspaceId: string,
    fieldId: string,
  ): Promise<Result<void>> {
    return sdAdminMutation({
      actorId,
      workspaceId,
      entity: 'sd_custom_field_definition',
      action: 'delete',
      targetId: fieldId,
      run: async () => {
        const existing = await SdCustomFieldRepository.findById(
          fieldId,
          workspaceId,
        )
        if (!existing.ok) return existing
        return SdCustomFieldRepository.delete(fieldId, workspaceId)
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
      entity: 'sd_custom_field_definition',
      action: 'update',
      meta: { reorder: orderedIds.length },
      run: () => SdCustomFieldRepository.reorder(workspaceId, orderedIds),
    })
  },
}
