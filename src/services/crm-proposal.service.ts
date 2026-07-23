import { createHash } from 'node:crypto'
import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toCrmProposalDTO,
  toCrmProposalPublicDTO,
} from '@/src/mappers/crm-proposal.mapper'
import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '@/src/repositories/crm-proposal.repository'
import type {
  CreateCrmProposalDTO,
  RecordCrmProposalViewDTO,
  UpdateCrmProposalDTO,
} from '@/src/schemas/crm-proposal.schema'
import type { CrmProposalDTO, CrmProposalPublicDTO } from '@/types/crm-proposal'
import { assertMember } from './authz'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export const CrmProposalService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmProposalDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProposalRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmProposalDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    proposalId: string,
  ): Promise<Result<CrmProposalDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProposalRepository.findById(proposalId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmProposalDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmProposalDTO,
  ): Promise<Result<CrmProposalDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProposalRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
      content: dto.content,
      type: dto.type,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_proposal',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_proposal',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmProposalDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    proposalId: string,
    dto: UpdateCrmProposalDTO,
  ): Promise<Result<CrmProposalDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalRepository.findById(
      proposalId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmProposalRepository.update(proposalId, {
      title: dto.title,
      content: dto.content,
      type: dto.type,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_proposal',
      action: 'update',
      actorId,
      targetId: proposalId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmProposalDTO(result.value))
  },

  async setPublished(
    actorId: string,
    workspaceId: string,
    proposalId: string,
    published: boolean,
  ): Promise<Result<CrmProposalDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalRepository.findById(
      proposalId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmProposalRepository.setPublished(
      proposalId,
      published,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_proposal',
      action: 'update',
      actorId,
      targetId: proposalId,
      meta: { published },
    })

    return ok(toCrmProposalDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    proposalId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalRepository.findById(
      proposalId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmProposalRepository.softDelete(proposalId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_proposal',
      action: 'delete',
      actorId,
      targetId: proposalId,
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

    return CrmProposalRepository.reorder(workspaceId, orderedIds)
  },

  async getPublicByShareToken(
    shareToken: string,
  ): Promise<Result<CrmProposalPublicDTO>> {
    const result = await CrmProposalRepository.findByShareToken(shareToken)
    if (!result.ok) return result

    return ok(toCrmProposalPublicDTO(result.value))
  },

  async recordView(
    shareToken: string,
    ip: string,
    dto: RecordCrmProposalViewDTO,
  ): Promise<Result<void>> {
    const proposal = await CrmProposalRepository.findByShareToken(shareToken)
    if (!proposal.ok) return proposal

    const result = await CrmProposalViewRepository.record({
      proposalId: proposal.value.id,
      viewId: dto.viewId,
      ipHash: hashIp(ip),
      durationMs: dto.durationMs,
      reachedEnd: dto.reachedEnd,
      scrolledPct: dto.scrolledPct,
      referrer: dto.referrer,
    })
    if (!result.ok) return result

    return ok(undefined)
  },
}
