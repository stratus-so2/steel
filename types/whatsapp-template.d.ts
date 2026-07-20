export type WhatsAppTemplateStatusDTO = 'APPROVED' | 'PENDING' | 'REJECTED'

export interface WhatsAppTemplateDTO {
  id: string
  workspaceId: string
  connectionId: string
  name: string
  language: string
  category: string
  status: WhatsAppTemplateStatusDTO
  components: unknown[]
  createdAt: string
  updatedAt: string
}
