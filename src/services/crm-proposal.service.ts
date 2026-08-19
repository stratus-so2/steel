import { createHash } from 'node:crypto'
import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toCrmProposalDTO,
  toCrmProposalMetricsDTO,
  toCrmProposalPublicDTO,
} from '@/src/mappers/crm-proposal.mapper'
import { CrmCompanyRepository } from '@/src/repositories/crm-company.repository'
import { CrmOpportunityRepository } from '@/src/repositories/crm-opportunity.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '@/src/repositories/crm-proposal.repository'
import { CrmProposalTemplateRepository } from '@/src/repositories/crm-proposal-template.repository'
import type {
  CreateCrmProposalDTO,
  RecordCrmProposalViewDTO,
  UpdateCrmProposalDTO,
} from '@/src/schemas/crm-proposal.schema'
import type {
  CrmProposalDTO,
  CrmProposalMetricsDTO,
  CrmProposalPublicDTO,
} from '@/types/crm-proposal'
import { assertMember } from './authz'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

/** Confere que company/contact/opportunity (quando informados) pertencem à workspace. */
async function assertRelatedEntities(
  workspaceId: string,
  refs: {
    companyId?: string | null
    contactId?: string | null
    opportunityId?: string | null
    responsibleId?: string
  },
): Promise<Result<true>> {
  if (refs.companyId) {
    const company = await CrmCompanyRepository.findById(
      refs.companyId,
      workspaceId,
    )
    if (!company.ok) return company
  }
  if (refs.contactId) {
    const contact = await CrmPersonRepository.findById(
      refs.contactId,
      workspaceId,
    )
    if (!contact.ok) return contact
  }
  if (refs.opportunityId) {
    const opportunity = await CrmOpportunityRepository.findById(
      refs.opportunityId,
      workspaceId,
    )
    if (!opportunity.ok) return opportunity
  }
  if (refs.responsibleId) {
    const membership = await assertMember(refs.responsibleId, workspaceId)
    if (!membership.ok) return membership
  }
  return ok(true)
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

    const related = await assertRelatedEntities(workspaceId, dto)
    if (!related.ok) return related

    let sections = dto.sections

    // Criação a partir de um template: copia as seções habilitadas por padrão
    // quando o payload não trouxe seções próprias.
    if (dto.templateId && sections.length === 0) {
      const template = await CrmProposalTemplateRepository.findById(
        dto.templateId,
        workspaceId,
      )
      if (!template.ok) return template

      sections = template.value.sections
        .filter(
          (section): section is typeof section & { defaultContent: object } =>
            section.enabled && section.defaultContent !== null,
        )
        .map((section) => ({
          type: section.type,
          order: section.order,
          enabled: true,
          content:
            section.defaultContent as CreateCrmProposalDTO['sections'][number]['content'],
        }))
    }

    const result = await CrmProposalRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      templateId: dto.templateId,
      companyId: dto.companyId,
      contactId: dto.contactId,
      opportunityId: dto.opportunityId,
      responsibleId: dto.responsibleId,
      validUntil: dto.validUntil,
      sections,
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

    const related = await assertRelatedEntities(workspaceId, {
      companyId: dto.companyId ?? undefined,
      contactId: dto.contactId ?? undefined,
      opportunityId: dto.opportunityId ?? undefined,
      responsibleId: dto.responsibleId,
    })
    if (!related.ok) return related

    const result = await CrmProposalRepository.update(proposalId, {
      name: dto.name,
      companyId: dto.companyId,
      contactId: dto.contactId,
      opportunityId: dto.opportunityId,
      responsibleId: dto.responsibleId,
      validUntil: dto.validUntil,
      status: dto.status,
      sections: dto.sections,
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

  async getMetrics(
    actorId: string,
    workspaceId: string,
    proposalId: string,
  ): Promise<Result<CrmProposalMetricsDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalRepository.findById(
      proposalId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const metrics = await CrmProposalViewRepository.metricsFor(proposalId)
    if (!metrics.ok) return metrics

    return ok(toCrmProposalMetricsDTO(metrics.value))
  },

  async getPublicByShareToken(
    shareToken: string,
  ): Promise<Result<CrmProposalPublicDTO>> {
    const result = await CrmProposalRepository.findByShareToken(shareToken)
    if (!result.ok) return result

    // A 1ª visualização pública marca a proposta como vista.
    if (result.value.status === 'SENT') {
      await CrmProposalRepository.setStatus(result.value.id, 'VIEWED')
    }

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

  async send(
    actorId: string,
    workspaceId: string,
    proposalId: string,
  ): Promise<Result<CrmProposalDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmProposalRepository.findById(
      proposalId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmProposalRepository.setStatus(proposalId, 'SENT')
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_proposal',
      action: 'update',
      actorId,
      targetId: proposalId,
      meta: { status: 'SENT' },
    })

    return ok(toCrmProposalDTO(result.value))
  },
}
