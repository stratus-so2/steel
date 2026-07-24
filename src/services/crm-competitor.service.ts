import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmCompetitorDTO } from '@/src/mappers/crm-competitor.mapper'
import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import type {
  CreateCrmCompetitorDTO,
  UpdateCrmCompetitorDTO,
} from '@/src/schemas/crm-competitor.schema'
import type { CrmCompetitorDTO } from '@/types/crm-competitor'
import { assertMember } from './authz'

export const CrmCompetitorService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmCompetitorDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompetitorRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmCompetitorDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmCompetitorDTO,
  ): Promise<Result<CrmCompetitorDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmCompetitorRepository.create({
      workspaceId,
      createdById: actorId,
      platform: dto.platform,
      handle: dto.handle,
      profileUrl: dto.profileUrl,
      followersCount: dto.followersCount,
      notes: dto.notes,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_tracked_competitor',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_tracked_competitor',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmCompetitorDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    competitorId: string,
    dto: UpdateCrmCompetitorDTO,
  ): Promise<Result<CrmCompetitorDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCompetitorRepository.findById(
      competitorId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmCompetitorRepository.update(competitorId, {
      updatedById: actorId,
      platform: dto.platform,
      handle: dto.handle,
      profileUrl: dto.profileUrl,
      followersCount: dto.followersCount,
      notes: dto.notes,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_tracked_competitor',
      action: 'update',
      actorId,
      targetId: competitorId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmCompetitorDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    competitorId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmCompetitorRepository.findById(
      competitorId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmCompetitorRepository.softDelete(
      competitorId,
      actorId,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_tracked_competitor',
      action: 'delete',
      actorId,
      targetId: competitorId,
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

    return CrmCompetitorRepository.reorder(workspaceId, orderedIds)
  },
}
