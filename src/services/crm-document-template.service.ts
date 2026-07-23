import type { CrmDocumentType } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { ok, type Result } from '@/src/lib/result'
import { toCrmDocumentTemplateDTO } from '@/src/mappers/crm-document-template.mapper'
import { CrmDocumentTemplateRepository } from '@/src/repositories/crm-document-template.repository'
import type { CreateCrmDocumentTemplateDTO } from '@/src/schemas/crm-document-template.schema'
import type { CrmDocumentTemplateDTO } from '@/types/crm-document-template'
import { assertMember } from './authz'

export const CrmDocumentTemplateService = {
  async list(
    actorId: string,
    workspaceId: string,
    type?: CrmDocumentType,
  ): Promise<Result<CrmDocumentTemplateDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmDocumentTemplateRepository.listByWorkspace(
      workspaceId,
      type,
    )
    if (!result.ok) return result

    return ok(result.value.map(toCrmDocumentTemplateDTO))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmDocumentTemplateDTO,
  ): Promise<Result<CrmDocumentTemplateDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmDocumentTemplateRepository.create({
      workspaceId,
      createdById: actorId,
      title: dto.title,
      content: dto.content,
      contentJson: dto.contentJson,
      type: dto.type,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_document_template',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_document_template',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmDocumentTemplateDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    templateId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmDocumentTemplateRepository.findById(
      templateId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmDocumentTemplateRepository.softDelete(templateId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_document_template',
      action: 'delete',
      actorId,
      targetId: templateId,
    })

    return ok(undefined)
  },
}
