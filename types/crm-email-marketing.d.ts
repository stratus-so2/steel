export interface CrmEmailTemplateDTO {
  id: string
  name: string
  subject: string
  contentHtml: string
  contentJson: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

export type CrmCampaignStatusDTO =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
export type CrmCampaignRecipientScopeDTO = 'ALL' | 'SELECTED'
export type CrmCampaignRecipientStatusDTO = 'PENDING' | 'SENT' | 'FAILED'

export interface CrmEmailCampaignDTO {
  id: string
  subject: string
  contentHtml: string
  contentJson: string | null
  fromAddress: string
  status: CrmCampaignStatusDTO
  recipientScope: CrmCampaignRecipientScopeDTO
  recipientCount: number
  sentCount: number
  failedCount: number
  scheduledAt: string | null
  sentAt: string | null
  workspaceId: string
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface CrmEmailCampaignRecipientDTO {
  id: string
  campaignId: string
  personId: string | null
  email: string
  name: string | null
  status: CrmCampaignRecipientStatusDTO
  providerMessageId: string | null
  errorMessage: string | null
  sentAt: string | null
  createdAt: string
}

export interface CrmMailingListDTO {
  id: string
  name: string
  description: string | null
  memberCount: number
  workspaceId: string
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface CrmMailingListMemberDTO {
  id: string
  mailingListId: string
  email: string
  name: string | null
  personId: string | null
  createdAt: string
}
