import type { CrmLead, CrmLeadStage } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import {
  crmLeadAlreadyClosed,
  crmLeadAlreadyConverted,
  crmLeadProposalNotFound,
  crmLeadStageRequirementsNotMet,
  crmLeadStageTransitionInvalid,
} from '@/src/errors'
import {
  computeLeadScore,
  findLeadRoutingOwner,
} from '@/src/lib/crm-lead-rules'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmLeadContactAttemptDTO,
  toCrmLeadDTO,
  toCrmLeadMeetingDTO,
  toCrmLeadProposalPresentationDTO,
  toCrmLeadQualificationDTO,
} from '@/src/mappers/crm-lead.mapper'
import { toCrmPersonDTO } from '@/src/mappers/crm-person.mapper'
import { toCrmProposalDTO } from '@/src/mappers/crm-proposal.mapper'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { CrmLeadRoutingRuleRepository } from '@/src/repositories/crm-lead-routing-rule.repository'
import { CrmLeadScoringRuleRepository } from '@/src/repositories/crm-lead-scoring-rule.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import { CrmProposalRepository } from '@/src/repositories/crm-proposal.repository'
import type {
  CloseCrmLeadLostDTO,
  CloseCrmLeadWonDTO,
  CreateCrmLeadDTO,
  CreateCrmLeadProposalDTO,
  ListCrmLeadsDTO,
  RegisterCrmLeadContactAttemptDTO,
  RegisterCrmLeadMeetingDTO,
  RegisterCrmLeadProposalPresentationDTO,
  UpdateCrmLeadDTO,
  UpsertCrmLeadQualificationDTO,
} from '@/src/schemas/crm-lead.schema'
import type {
  CrmLeadContactAttemptDTO,
  CrmLeadDTO,
  CrmLeadMeetingDTO,
  CrmLeadProposalPresentationDTO,
  CrmLeadQualificationDTO,
} from '@/types/crm-lead'
import type { CrmPersonDTO } from '@/types/crm-person'
import type { CrmProposalDTO } from '@/types/crm-proposal'
import { assertMember } from './authz'

async function createPersonFromLead(
  workspaceId: string,
  actorId: string,
  lead: CrmLead,
) {
  return CrmPersonRepository.create({
    workspaceId,
    createdById: actorId,
    name: lead.name,
    emails: lead.emails,
    phones: lead.phones,
    city: lead.city ?? undefined,
    jobTitle: lead.jobTitle ?? undefined,
    linkedin: lead.linkedin ?? undefined,
  })
}

export const CrmLeadService = {
  async list(
    actorId: string,
    workspaceId: string,
    filters: ListCrmLeadsDTO,
  ): Promise<Result<CrmLeadDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLeadRepository.listByWorkspace(workspaceId, {
      stage: filters.stage,
    })
    if (!result.ok) return result

    return ok(result.value.map(toCrmLeadDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmLeadDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmLeadDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmLeadDTO,
  ): Promise<Result<CrmLeadDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const subject = {
      name: dto.name,
      emails: dto.emails,
      phones: dto.phones,
      company: dto.company ?? null,
      jobTitle: dto.jobTitle ?? null,
      source: dto.source ?? null,
      city: dto.city ?? null,
    }

    const [scoringRules, routingRules] = await Promise.all([
      CrmLeadScoringRuleRepository.listActiveByWorkspace(workspaceId),
      CrmLeadRoutingRuleRepository.listActiveByWorkspace(workspaceId),
    ])
    if (!scoringRules.ok) return scoringRules
    if (!routingRules.ok) return routingRules

    const score = computeLeadScore(subject, scoringRules.value)
    const ownerId = findLeadRoutingOwner(subject, routingRules.value)

    const result = await CrmLeadRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      emails: dto.emails,
      phones: dto.phones,
      company: dto.company,
      jobTitle: dto.jobTitle,
      city: dto.city,
      linkedin: dto.linkedin,
      source: dto.source,
      channel: dto.channel,
      score,
      ownerId,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_lead',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_lead',
      action: 'create',
      actorId,
      targetId: result.value.id,
      meta: { score, ownerId },
    })

    return ok(toCrmLeadDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: UpdateCrmLeadDTO,
  ): Promise<Result<CrmLeadDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!existing.ok) return existing

    let score: number | undefined
    const scoreRelevantFields =
      dto.name !== undefined ||
      dto.emails !== undefined ||
      dto.phones !== undefined ||
      dto.company !== undefined ||
      dto.jobTitle !== undefined ||
      dto.source !== undefined ||
      dto.city !== undefined

    if (scoreRelevantFields) {
      const scoringRules =
        await CrmLeadScoringRuleRepository.listActiveByWorkspace(workspaceId)
      if (!scoringRules.ok) return scoringRules

      score = computeLeadScore(
        {
          name: dto.name ?? existing.value.name,
          emails: dto.emails ?? existing.value.emails,
          phones: dto.phones ?? existing.value.phones,
          company: dto.company ?? existing.value.company,
          jobTitle: dto.jobTitle ?? existing.value.jobTitle,
          source: dto.source ?? existing.value.source,
          city: dto.city ?? existing.value.city,
        },
        scoringRules.value,
      )
    }

    const result = await CrmLeadRepository.update(leadId, {
      name: dto.name,
      emails: dto.emails,
      phones: dto.phones,
      company: dto.company,
      jobTitle: dto.jobTitle,
      city: dto.city,
      linkedin: dto.linkedin,
      source: dto.source,
      channel: dto.channel,
      ownerId: dto.ownerId,
      score,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmLeadDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmLeadRepository.softDelete(leadId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead',
      action: 'delete',
      actorId,
      targetId: leadId,
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

    return CrmLeadRepository.reorder(workspaceId, orderedIds)
  },

  async convert(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmPersonDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    if (lead.value.convertedPersonId) {
      return err(crmLeadAlreadyConverted())
    }

    const person = await createPersonFromLead(workspaceId, actorId, lead.value)
    if (!person.ok) return person

    const updated = await CrmLeadRepository.update(leadId, {
      convertedPersonId: person.value.id,
      updatedById: actorId,
    })
    if (!updated.ok) return updated

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { converted: true, personId: person.value.id },
    })

    return ok(toCrmPersonDTO(person.value))
  },

  async getActiveProposal(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmProposalDTO | null>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    const result = await CrmProposalRepository.findLatestByLeadId(
      leadId,
      workspaceId,
    )
    if (!result.ok) return result

    return ok(result.value ? toCrmProposalDTO(result.value) : null)
  },

  // --- 01 Recebido -> 02 Em Contato / 02 -> 03 Qualificado ---

  async registerContactAttempt(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: RegisterCrmLeadContactAttemptDTO,
  ): Promise<Result<{ lead: CrmLeadDTO; attempt: CrmLeadContactAttemptDTO }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage === 'CLOSED') return err(crmLeadAlreadyClosed())

    const attempt = await CrmLeadRepository.createContactAttempt({
      leadId,
      workspaceId,
      createdById: actorId,
      contactedWith: dto.contactedWith,
      channel: dto.channel,
      outcome: dto.outcome,
      occurredAt: dto.occurredAt,
      note: dto.note,
    })
    if (!attempt.ok) return attempt

    let nextStage: CrmLeadStage | undefined
    if (lead.value.stage === 'RECEIVED') nextStage = 'IN_CONTACT'
    else if (lead.value.stage === 'IN_CONTACT' && dto.outcome === 'REACHED')
      nextStage = 'QUALIFIED'

    let updatedLead = lead.value
    if (nextStage) {
      const advanced = await CrmLeadRepository.update(leadId, {
        stage: nextStage,
        updatedById: actorId,
      })
      if (!advanced.ok) return advanced
      updatedLead = advanced.value
    }

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { contactAttempt: dto.outcome, stage: updatedLead.stage },
    })

    return ok({
      lead: toCrmLeadDTO(updatedLead),
      attempt: toCrmLeadContactAttemptDTO(attempt.value),
    })
  },

  async listContactAttempts(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmLeadContactAttemptDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    const result = await CrmLeadRepository.listContactAttempts(leadId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLeadContactAttemptDTO))
  },

  // --- 02: produtos/serviços de interesse ---

  async setInterestProducts(
    actorId: string,
    workspaceId: string,
    leadId: string,
    productIds: string[],
  ): Promise<Result<CrmLeadDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    const result = await CrmLeadRepository.setInterestProducts(
      leadId,
      productIds,
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { interestProducts: productIds.length },
    })

    return ok(toCrmLeadDTO(lead.value))
  },

  // --- 03 Lead Qualificado -> 04 Interesse/Oportunidade ---

  async upsertQualification(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: UpsertCrmLeadQualificationDTO,
  ): Promise<
    Result<{ lead: CrmLeadDTO; qualification: CrmLeadQualificationDTO }>
  > {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage === 'CLOSED') return err(crmLeadAlreadyClosed())

    const existing = await CrmLeadRepository.findQualification(leadId)
    if (!existing.ok) return existing
    if (!existing.value && lead.value.stage !== 'QUALIFIED') {
      return err(
        crmLeadStageTransitionInvalid(
          'Qualifique o lead somente a partir da etapa "Lead Qualificado"',
        ),
      )
    }

    const qualification = await CrmLeadRepository.upsertQualification({
      leadId,
      qualifiedById: actorId,
      expectedCloseAt: dto.expectedCloseAt,
      decisionMakerName: dto.decisionMakerName,
      decisionMakerRole: dto.decisionMakerRole,
    })
    if (!qualification.ok) return qualification

    let updatedLead = lead.value
    if (lead.value.stage === 'QUALIFIED') {
      const advanced = await CrmLeadRepository.update(leadId, {
        stage: 'OPPORTUNITY',
        updatedById: actorId,
      })
      if (!advanced.ok) return advanced
      updatedLead = advanced.value
    }

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { qualification: true, stage: updatedLead.stage },
    })

    return ok({
      lead: toCrmLeadDTO(updatedLead),
      qualification: toCrmLeadQualificationDTO(qualification.value),
    })
  },

  async getQualification(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmLeadQualificationDTO | null>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    const result = await CrmLeadRepository.findQualification(leadId)
    if (!result.ok) return result

    return ok(result.value ? toCrmLeadQualificationDTO(result.value) : null)
  },

  // --- 04 Interesse/Oportunidade ---

  async registerMeeting(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: RegisterCrmLeadMeetingDTO,
  ): Promise<Result<{ lead: CrmLeadDTO; meeting: CrmLeadMeetingDTO }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage !== 'OPPORTUNITY') {
      return err(
        crmLeadStageTransitionInvalid(
          'Registre reuniões somente na etapa "Interesse/Oportunidade"',
        ),
      )
    }

    const meeting = await CrmLeadRepository.createMeeting({
      leadId,
      workspaceId,
      createdById: actorId,
      scheduledAt: dto.scheduledAt,
      format: dto.format,
      contactPersonId: dto.contactPersonId,
      contactPersonName: dto.contactPersonName,
      interestDetails: dto.interestDetails,
      identifiedNeed: dto.identifiedNeed,
    })
    if (!meeting.ok) return meeting

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { meeting: true },
    })

    return ok({
      lead: toCrmLeadDTO(lead.value),
      meeting: toCrmLeadMeetingDTO(meeting.value),
    })
  },

  async listMeetings(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmLeadMeetingDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    const result = await CrmLeadRepository.listMeetings(leadId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLeadMeetingDTO))
  },

  // OPPORTUNITY -> PROPOSAL: criar a proposta é a transição.
  async createProposal(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: CreateCrmLeadProposalDTO,
  ): Promise<Result<{ lead: CrmLeadDTO; proposal: CrmProposalDTO }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage !== 'OPPORTUNITY') {
      return err(
        crmLeadStageTransitionInvalid(
          'Crie a proposta somente a partir da etapa "Interesse/Oportunidade"',
        ),
      )
    }

    const meetings = await CrmLeadRepository.listMeetings(leadId)
    if (!meetings.ok) return meetings
    if (meetings.value.length === 0) {
      return err(
        crmLeadStageRequirementsNotMet(
          'Registre ao menos uma reunião antes de criar a proposta',
        ),
      )
    }

    const proposal = await CrmProposalRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      templateId: dto.templateId,
      leadId,
      responsibleId: actorId,
      validUntil: dto.validUntil,
      sections: [],
    })
    if (!proposal.ok) return proposal

    const advanced = await CrmLeadRepository.update(leadId, {
      stage: 'PROPOSAL',
      updatedById: actorId,
    })
    if (!advanced.ok) return advanced

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { proposalCreated: proposal.value.id },
    })

    return ok({
      lead: toCrmLeadDTO(advanced.value),
      proposal: toCrmProposalDTO(proposal.value),
    })
  },

  // --- 05 Proposta (inclui o Termômetro de Interesse) ---

  async registerProposalPresentation(
    actorId: string,
    workspaceId: string,
    leadId: string,
    proposalId: string,
    dto: RegisterCrmLeadProposalPresentationDTO,
  ): Promise<
    Result<{ lead: CrmLeadDTO; presentation: CrmLeadProposalPresentationDTO }>
  > {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage !== 'PROPOSAL') {
      return err(
        crmLeadStageTransitionInvalid(
          'Registre apresentações somente na etapa "Proposta"',
        ),
      )
    }

    const proposal = await CrmProposalRepository.findById(
      proposalId,
      workspaceId,
    )
    if (!proposal.ok) return proposal
    if (proposal.value.leadId !== leadId) {
      return err(crmLeadProposalNotFound())
    }

    const presentation = await CrmLeadRepository.createProposalPresentation({
      leadId,
      proposalId,
      createdById: actorId,
      presentedAt: dto.presentedAt,
      format: dto.format,
      amount: dto.amount,
      interestLevel: dto.interestLevel,
      interactionsCount: dto.interactionsCount,
    })
    if (!presentation.ok) return presentation

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { proposalPresentation: true, interestLevel: dto.interestLevel },
    })

    return ok({
      lead: toCrmLeadDTO(lead.value),
      presentation: toCrmLeadProposalPresentationDTO(presentation.value),
    })
  },

  async listProposalPresentations(
    actorId: string,
    workspaceId: string,
    leadId: string,
  ): Promise<Result<CrmLeadProposalPresentationDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead

    const result = await CrmLeadRepository.listProposalPresentations(leadId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmLeadProposalPresentationDTO))
  },

  // --- 06 Fechado/Encerrado ---

  async closeWon(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: CloseCrmLeadWonDTO,
  ): Promise<Result<CrmPersonDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage === 'CLOSED') return err(crmLeadAlreadyClosed())
    if (lead.value.stage !== 'PROPOSAL') {
      return err(
        crmLeadStageTransitionInvalid(
          'Só é possível fechar como ganho a partir da etapa "Proposta"',
        ),
      )
    }

    const presentations =
      await CrmLeadRepository.listProposalPresentations(leadId)
    if (!presentations.ok) return presentations
    if (presentations.value.length === 0) {
      return err(
        crmLeadStageRequirementsNotMet(
          'Registre a apresentação da proposta antes de fechar como ganho',
        ),
      )
    }

    const person = await createPersonFromLead(workspaceId, actorId, lead.value)
    if (!person.ok) return person

    const updated = await CrmLeadRepository.update(leadId, {
      stage: 'CLOSED',
      closeResult: 'WON',
      closedAt: new Date(),
      contractSignedAt: dto.contractSignedAt,
      billingType: dto.billingType,
      closedAmount: dto.closedAmount,
      convertedPersonId: person.value.id,
      updatedById: actorId,
    })
    if (!updated.ok) return updated

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { closed: 'WON', personId: person.value.id },
    })

    return ok(toCrmPersonDTO(person.value))
  },

  async closeLost(
    actorId: string,
    workspaceId: string,
    leadId: string,
    dto: CloseCrmLeadLostDTO,
  ): Promise<Result<CrmLeadDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const lead = await CrmLeadRepository.findById(leadId, workspaceId)
    if (!lead.ok) return lead
    if (lead.value.stage === 'CLOSED') return err(crmLeadAlreadyClosed())

    if (lead.value.stage === 'PROPOSAL') {
      const presentations =
        await CrmLeadRepository.listProposalPresentations(leadId)
      if (!presentations.ok) return presentations
      if (presentations.value.length === 0) {
        return err(
          crmLeadStageRequirementsNotMet(
            'Registre a apresentação da proposta antes de registrar o resultado',
          ),
        )
      }
    }

    const updated = await CrmLeadRepository.update(leadId, {
      stage: 'CLOSED',
      closeResult: 'LOST',
      closedAt: new Date(),
      lostReason: dto.lostReason,
      lostNote: dto.lostNote,
      retryAt: dto.retryAt,
      updatedById: actorId,
    })
    if (!updated.ok) return updated

    auditMutation({
      entity: 'crm_lead',
      action: 'update',
      actorId,
      targetId: leadId,
      meta: { closed: 'LOST', reason: dto.lostReason },
    })

    return ok(toCrmLeadDTO(updated.value))
  },
}
