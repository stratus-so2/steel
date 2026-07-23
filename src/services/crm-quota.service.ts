import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmQuotaDTO } from '@/src/mappers/crm-quota.mapper'
import { CrmQuotaRepository } from '@/src/repositories/crm-quota.repository'
import type {
  CreateCrmQuotaDTO,
  ListCrmQuotasDTO,
  UpdateCrmQuotaDTO,
} from '@/src/schemas/crm-quota.schema'
import type { CrmQuotaDTO } from '@/types/crm-quota'
import { assertPrivileged } from './authz'

export const CrmQuotaService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmQuotasDTO,
  ): Promise<Result<CrmQuotaDTO[]>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmQuotaRepository.listByWorkspace(
      workspaceId,
      filters,
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmQuotaDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmQuotaDTO,
  ): Promise<Result<CrmQuotaDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmQuotaRepository.create({
      workspaceId,
      createdById: actorId,
      ownerId: dto.ownerId,
      period: dto.period,
      periodKey: dto.periodKey,
      targetAmount: dto.targetAmount,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_quota',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_quota',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmQuotaDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    quotaId: string,
    dto: UpdateCrmQuotaDTO,
  ): Promise<Result<CrmQuotaDTO>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmQuotaRepository.findById(quotaId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmQuotaRepository.update(quotaId, {
      targetAmount: dto.targetAmount,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_quota',
      action: 'update',
      actorId,
      targetId: quotaId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmQuotaDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    quotaId: string,
  ): Promise<Result<void>> {
    const membership = await assertPrivileged(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmQuotaRepository.findById(quotaId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmQuotaRepository.delete(quotaId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_quota',
      action: 'delete',
      actorId,
      targetId: quotaId,
    })

    return ok(undefined)
  },
}
