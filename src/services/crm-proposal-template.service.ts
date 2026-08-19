import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmProposalTemplateDTO } from '@/src/mappers/crm-proposal-template.mapper'
import { CrmProposalTemplateRepository } from '@/src/repositories/crm-proposal-template.repository'
import type {
  CreateCrmProposalTemplateDTO,
  UpdateCrmProposalTemplateDTO,
} from '@/src/schemas/crm-proposal-template.schema'
import type { CrmProposalSectionDTO } from '@/types/crm-proposal'
import type { CrmProposalTemplateDTO } from '@/types/crm-proposal-template'
import { assertMember } from './authz'

export const CrmProposalTemplateService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmProposalTemplateDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result =
      await CrmProposalTemplateRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmProposalTemplateDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<Result<CrmProposalTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProposalTemplateRepository.findById(
      templateId,
      workspaceId,
    )
    if (!result.ok) return result

    return ok(toCrmProposalTemplateDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmProposalTemplateDTO,
  ): Promise<Result<CrmProposalTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmProposalTemplateRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      description: dto.description,
      logoUrl: dto.logoUrl,
      sections: dto.sections,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_proposal_template',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_proposal_template',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmProposalTemplateDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    templateId: string,
    dto: UpdateCrmProposalTemplateDTO,
  ): Promise<Result<CrmProposalTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalTemplateRepository.findById(
      templateId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmProposalTemplateRepository.update(templateId, {
      name: dto.name,
      description: dto.description,
      logoUrl: dto.logoUrl,
      sections: dto.sections,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_proposal_template',
      action: 'update',
      actorId,
      targetId: templateId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmProposalTemplateDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalTemplateRepository.findById(
      templateId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmProposalTemplateRepository.softDelete(templateId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_proposal_template',
      action: 'delete',
      actorId,
      targetId: templateId,
    })

    return ok(undefined)
  },

  /** Gera um template a partir de uma proposta existente ("salvar como template"). */
  async createFromProposal(
    actorId: string,
    workspaceId: string,
    proposal: { name: string; sections: CrmProposalSectionDTO[] },
  ): Promise<Result<CrmProposalTemplateDTO>> {
    return CrmProposalTemplateService.create(actorId, workspaceId, {
      name: proposal.name,
      sections: proposal.sections.map((section) => ({
        type: section.type,
        order: section.order,
        enabled: section.enabled,
        defaultContent: section.content,
      })),
    })
  },
}
