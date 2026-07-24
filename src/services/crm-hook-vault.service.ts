import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmHookVaultItemDTO } from '@/src/mappers/crm-hook-vault.mapper'
import { CrmHookVaultRepository } from '@/src/repositories/crm-hook-vault.repository'
import type {
  CreateCrmHookVaultItemDTO,
  UpdateCrmHookVaultItemDTO,
} from '@/src/schemas/crm-hook-vault.schema'
import type { CrmHookVaultItemDTO } from '@/types/crm-hook-vault'
import { assertMember } from './authz'

export const CrmHookVaultService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmHookVaultItemDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmHookVaultRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmHookVaultItemDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmHookVaultItemDTO,
  ): Promise<Result<CrmHookVaultItemDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmHookVaultRepository.create({
      workspaceId,
      createdById: actorId,
      text: dto.text,
      platform: dto.platform,
      usageCount: dto.usageCount,
      notes: dto.notes,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_hook_vault_item',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_hook_vault_item',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmHookVaultItemDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    itemId: string,
    dto: UpdateCrmHookVaultItemDTO,
  ): Promise<Result<CrmHookVaultItemDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmHookVaultRepository.findById(itemId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmHookVaultRepository.update(itemId, {
      updatedById: actorId,
      text: dto.text,
      platform: dto.platform,
      usageCount: dto.usageCount,
      notes: dto.notes,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_hook_vault_item',
      action: 'update',
      actorId,
      targetId: itemId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmHookVaultItemDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    itemId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmHookVaultRepository.findById(itemId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmHookVaultRepository.softDelete(itemId, actorId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_hook_vault_item',
      action: 'delete',
      actorId,
      targetId: itemId,
    })

    return ok(undefined)
  },

  async reorder(
    actorId: string,
    workspaceId: string,
    orderedIds: string[],
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    return CrmHookVaultRepository.reorder(workspaceId, orderedIds)
  },
}
