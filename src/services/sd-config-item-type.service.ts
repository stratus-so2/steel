import { auditMutation } from '@/lib/axiom/audit'
import { sdConfigConflict } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { toSdConfigItemTypeDTO } from '@/src/mappers/sd-config-item.mapper'
import { SdConfigItemTypeRepository } from '@/src/repositories/sd-config-item-type.repository'
import type {
  CreateSdConfigItemTypeDTO,
  UpdateSdConfigItemTypeDTO,
} from '@/src/schemas/sd-config-item.schema'
import type { SdConfigItemTypeDTO } from '@/types/sd-config-item'
import { SdAccess } from './sd-access'

async function assertNameFree(
  workspaceId: string,
  name: string | undefined,
  excludeId?: string,
): Promise<Result<void>> {
  if (!name) return ok(undefined)
  const taken = await SdConfigItemTypeRepository.nameTaken(
    workspaceId,
    name,
    excludeId,
  )
  if (!taken.ok) return taken
  if (taken.value) {
    return err(sdConfigConflict('Já existe um tipo de item com este nome'))
  }
  return ok(undefined)
}

/**
 * Tipos de item de configuração (CMDB). Listar: agentes com
 * `sd-config-items:VIEW`. Criar/editar/excluir: admins do ServiceDesk (é
 * configuração do módulo, como as demais tabelas do motor).
 */
export const SdConfigItemTypeService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<SdConfigItemTypeDTO[]>> {
    const ctx = await SdAccess.requireAgent(actorId, workspaceId, {
      resource: 'sd-config-items',
      action: 'VIEW',
    })
    if (!ctx.ok) return ctx

    const types = await SdConfigItemTypeRepository.list(workspaceId)
    if (!types.ok) return types
    return ok(types.value.map(toSdConfigItemTypeDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateSdConfigItemTypeDTO,
  ): Promise<Result<SdConfigItemTypeDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const free = await assertNameFree(workspaceId, dto.name)
    if (!free.ok) return free

    const result = await SdConfigItemTypeRepository.create({
      workspaceId,
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      attributeSchema: dto.attributeSchema,
      position: dto.position,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_config_item_type',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { workspaceId },
    })
    return ok(toSdConfigItemTypeDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    typeId: string,
    dto: UpdateSdConfigItemTypeDTO,
  ): Promise<Result<SdConfigItemTypeDTO>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const existing = await SdConfigItemTypeRepository.findById(
      typeId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const free = await assertNameFree(workspaceId, dto.name, typeId)
    if (!free.ok) return free

    // Mudar o esquema não reescreve os CIs: atributos antigos continuam
    // salvos e são revalidados na próxima edição de cada item.
    const result = await SdConfigItemTypeRepository.update(typeId, {
      name: dto.name,
      icon: dto.icon,
      color: dto.color,
      attributeSchema: dto.attributeSchema,
      position: dto.position,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_config_item_type',
      action: 'update',
      actorId,
      targetId: typeId,
      meta: { workspaceId, fields: Object.keys(dto) },
    })
    return ok(toSdConfigItemTypeDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    typeId: string,
  ): Promise<Result<void>> {
    const ctx = await SdAccess.requireAdmin(actorId, workspaceId)
    if (!ctx.ok) return ctx

    const existing = await SdConfigItemTypeRepository.findById(
      typeId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await SdConfigItemTypeRepository.delete(typeId)
    if (!result.ok) return result

    auditMutation({
      entity: 'sd_config_item_type',
      action: 'delete',
      actorId,
      targetId: typeId,
      meta: { workspaceId, items: existing.value._count.items },
    })
    return ok(undefined)
  },
}
