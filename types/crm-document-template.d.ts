import type { CrmDocumentTypeDTO } from '@/types/crm-proposal'

export interface CrmDocumentTemplateDTO {
  id: string
  title: string
  content: string
  contentJson: string | null
  type: CrmDocumentTypeDTO
  workspaceId: string
  createdById: string
  createdAt: string
  updatedAt: string
}
