import { createHash } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import {
  toCrmFormDTO,
  toCrmFormPublicDTO,
  toCrmFormSubmissionDTO,
} from '@/src/mappers/crm-form.mapper'
import { CrmCompanyRepository } from '@/src/repositories/crm-company.repository'
import {
  CrmFormRepository,
  CrmFormSubmissionRepository,
} from '@/src/repositories/crm-form.repository'
import { CrmLeadRepository } from '@/src/repositories/crm-lead.repository'
import { CrmPersonRepository } from '@/src/repositories/crm-person.repository'
import type {
  CreateCrmFormDTO,
  SubmitCrmFormDTO,
  UpdateCrmFormDTO,
} from '@/src/schemas/crm-form.schema'
import type {
  CrmFormDTO,
  CrmFormPublicDTO,
  CrmFormSubmissionDTO,
} from '@/types/crm-form'
import { assertMember } from './authz'

function hashIp(ip: string): string {
  return createHash('sha256').update(ip).digest('hex')
}

export const CrmFormService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmFormDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmFormRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmFormDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmFormDTO,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmFormRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      description: dto.description,
      action: dto.action,
      fields: dto.fields as unknown as Prisma.InputJsonValue,
      successMessage: dto.successMessage,
      redirectUrl: dto.redirectUrl,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_form',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_form',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmFormDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    formId: string,
    dto: UpdateCrmFormDTO,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmFormRepository.findById(formId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmFormRepository.update(formId, {
      name: dto.name,
      description: dto.description,
      fields: dto.fields as unknown as Prisma.InputJsonValue | undefined,
      successMessage: dto.successMessage,
      redirectUrl: dto.redirectUrl,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_form',
      action: 'update',
      actorId,
      targetId: formId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmFormDTO(result.value))
  },

  async setPublished(
    actorId: string,
    workspaceId: string,
    formId: string,
    published: boolean,
  ): Promise<Result<CrmFormDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmFormRepository.findById(formId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmFormRepository.setPublished(formId, published)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_form',
      action: 'update',
      actorId,
      targetId: formId,
      meta: { published },
    })

    return ok(toCrmFormDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    formId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmFormRepository.findById(formId, workspaceId)
    if (!existing.ok) return existing

    const result = await CrmFormRepository.softDelete(formId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_form',
      action: 'delete',
      actorId,
      targetId: formId,
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

    return CrmFormRepository.reorder(workspaceId, orderedIds)
  },

  async listSubmissions(
    actorId: string,
    workspaceId: string,
    formId: string,
  ): Promise<Result<CrmFormSubmissionDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const form = await CrmFormRepository.findById(formId, workspaceId)
    if (!form.ok) return form

    const result = await CrmFormSubmissionRepository.listByForm(formId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmFormSubmissionDTO))
  },

  async getPublicByToken(
    publicToken: string,
  ): Promise<Result<CrmFormPublicDTO>> {
    const result =
      await CrmFormRepository.findPublishedByPublicToken(publicToken)
    if (!result.ok) return result

    return ok(toCrmFormPublicDTO(result.value))
  },

  async submit(
    publicToken: string,
    ip: string,
    referrer: string | undefined,
    dto: SubmitCrmFormDTO,
  ): Promise<Result<CrmFormSubmissionDTO>> {
    const form = await CrmFormRepository.findPublishedByPublicToken(publicToken)
    if (!form.ok) return form

    const name = dto.values.name ?? dto.values.email ?? 'Sem nome'
    let createdCompanyId: string | undefined
    let createdPersonId: string | undefined
    let createdLeadId: string | undefined

    if (form.value.action === 'COMPANY') {
      const created = await CrmCompanyRepository.create({
        workspaceId: form.value.workspaceId,
        createdById: form.value.createdById,
        name,
        domain: dto.values.domain,
      })
      if (!created.ok) return created
      createdCompanyId = created.value.id
    } else if (form.value.action === 'PERSON') {
      const created = await CrmPersonRepository.create({
        workspaceId: form.value.workspaceId,
        createdById: form.value.createdById,
        name,
        emails: dto.values.email ? [dto.values.email] : [],
        phones: dto.values.phone ? [dto.values.phone] : [],
      })
      if (!created.ok) return created
      createdPersonId = created.value.id
    } else {
      const created = await CrmLeadRepository.create({
        workspaceId: form.value.workspaceId,
        createdById: form.value.createdById,
        name,
        emails: dto.values.email ? [dto.values.email] : [],
        phones: dto.values.phone ? [dto.values.phone] : [],
        score: 0,
      })
      if (!created.ok) return created
      createdLeadId = created.value.id
    }

    const result = await CrmFormSubmissionRepository.create({
      formId: form.value.id,
      values: dto.values as unknown as Prisma.InputJsonValue,
      action: form.value.action,
      createdCompanyId,
      createdPersonId,
      createdLeadId,
      ipHash: hashIp(ip),
      referrer,
    })
    if (!result.ok) return result

    return ok(toCrmFormSubmissionDTO(result.value))
  },
}
