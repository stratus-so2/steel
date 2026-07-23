import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmEmailTemplateDTO } from '@/src/mappers/crm-email-marketing.mapper'
import { CrmEmailTemplateRepository } from '@/src/repositories/crm-email-template.repository'
import type {
  CreateCrmEmailTemplateDTO,
  UpdateCrmEmailTemplateDTO,
} from '@/src/schemas/crm-email-template.schema'
import type { CrmEmailTemplateDTO } from '@/types/crm-email-marketing'
import { assertMember } from './authz'

export const CrmEmailTemplateService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmEmailTemplateDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmEmailTemplateRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmEmailTemplateDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmEmailTemplateDTO,
  ): Promise<Result<CrmEmailTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmEmailTemplateRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      subject: dto.subject,
      contentHtml: dto.contentHtml,
      contentJson: dto.contentJson,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_email_template',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_email_template',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmEmailTemplateDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    templateId: string,
    dto: UpdateCrmEmailTemplateDTO,
  ): Promise<Result<CrmEmailTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmEmailTemplateRepository.findById(
      templateId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmEmailTemplateRepository.update(templateId, {
      name: dto.name,
      subject: dto.subject,
      contentHtml: dto.contentHtml,
      contentJson: dto.contentJson,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_email_template',
      action: 'update',
      actorId,
      targetId: templateId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmEmailTemplateDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmEmailTemplateRepository.findById(
      templateId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmEmailTemplateRepository.softDelete(templateId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_email_template',
      action: 'delete',
      actorId,
      targetId: templateId,
    })

    return ok(undefined)
  },
}
