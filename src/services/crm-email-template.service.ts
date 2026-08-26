import { auditMutation } from '@/lib/axiom/audit'
import { renderMarketingTemplate } from '@/src/lib/crm-marketing-templates.render'
import { ok, type Result } from '@/src/lib/result'
import { toCrmEmailTemplateDTO } from '@/src/mappers/crm-email-marketing.mapper'
import { CrmEmailTemplateRepository } from '@/src/repositories/crm-email-template.repository'
import type {
  CreateCrmEmailTemplateDTO,
  UpdateCrmEmailTemplateDTO,
} from '@/src/schemas/crm-email-template.schema'
import type { CrmEmailTemplateDTO } from '@/types/crm-email-marketing'
import { assertMember } from './authz'

/** Layout fixo informado: HTML é sempre recalculado a partir dele, ignorando
 * qualquer `contentHtml` vindo do editor de blocos livre. */
async function resolveContentHtml(dto: {
  contentHtml?: string
  templateId?: string
  templateProps?: Record<string, string>
}): Promise<string> {
  if (dto.templateId) {
    return renderMarketingTemplate(
      dto.templateId as Parameters<typeof renderMarketingTemplate>[0],
      dto.templateProps,
    )
  }
  return dto.contentHtml ?? ''
}

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

    const contentHtml = await resolveContentHtml(dto)

    const result = await CrmEmailTemplateRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      subject: dto.subject,
      contentHtml,
      contentJson: dto.contentJson,
      templateId: dto.templateId,
      templateProps: dto.templateProps,
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

    // Só recalcula o HTML a partir do layout fixo quando o layout ou seus
    // campos mudaram — do contrário, mantém o contentHtml enviado (edição
    // livre) ou não mexe nele (undefined = campo não alterado).
    const nextTemplateId = dto.templateId ?? existing.value.templateId
    const contentHtml =
      dto.templateId || dto.templateProps
        ? await resolveContentHtml({
            templateId: nextTemplateId ?? undefined,
            templateProps:
              (dto.templateProps as Record<string, string> | undefined) ??
              (existing.value.templateProps as
                | Record<string, string>
                | undefined),
          })
        : dto.contentHtml

    const result = await CrmEmailTemplateRepository.update(templateId, {
      name: dto.name,
      subject: dto.subject,
      contentHtml,
      contentJson: dto.contentJson,
      templateId: dto.templateId,
      templateProps: dto.templateProps,
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

  /** Renderiza um layout fixo com os campos em edição, para o preview ao
   * vivo do formulário — sem persistir nada. */
  async previewLayout(
    actorId: string,
    workspaceId: string,
    dto: { templateId: string; templateProps?: Record<string, string> },
  ): Promise<Result<{ html: string }>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const html = await resolveContentHtml(dto)
    return ok({ html })
  },
}
