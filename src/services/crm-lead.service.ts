import { auditMutation } from '@/lib/axiom/audit'
import { crmLeadAlreadyConverted } from '@/src/errors'
import {
  computeLeadScore,
  findLeadRoutingOwner,
} from '@/src/lib/crm-lead-rules'
import { err, ok, type Result } from '@/src/lib/result'
import { toCrmLeadDTO } from '@/src/mappers/crm-lead.mapper'
import { toCrmPersonDTO } from '@/src/mappers/crm-person.mapper'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { CrmLeadRoutingRuleRepository } from '@/src/repositories/crm-lead-routing-rule.repository'
import { CrmLeadScoringRuleRepository } from '@/src/repositories/crm-lead-scoring-rule.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import type {
  CreateCrmLeadDTO,
  ListCrmLeadsDTO,
  UpdateCrmLeadDTO,
} from '@/src/schemas/crm-lead.schema'
import type { CrmLeadDTO } from '@/types/crm-lead'
import type { CrmPersonDTO } from '@/types/crm-person'
import { assertMember } from './authz'

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

    const person = await CrmPersonRepository.create({
      workspaceId,
      createdById: actorId,
      name: lead.value.name,
      emails: lead.value.emails,
      phones: lead.value.phones,
      city: lead.value.city ?? undefined,
      jobTitle: lead.value.jobTitle ?? undefined,
      linkedin: lead.value.linkedin ?? undefined,
    })
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
}
