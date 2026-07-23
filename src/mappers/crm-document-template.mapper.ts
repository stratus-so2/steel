import type { CrmDocumentTemplate } from '@prisma/client'
import type { CrmDocumentTemplateDTO } from '@/types/crm-document-template'

export function toCrmDocumentTemplateDTO(
  template: CrmDocumentTemplate,
): CrmDocumentTemplateDTO {
  return {
    id: template.id,
    title: template.title,
    content: template.content,
    contentJson: template.contentJson,
    type: template.type,
    workspaceId: template.workspaceId,
    createdById: template.createdById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}
