import type {
  CrmEmailCampaign,
  CrmEmailCampaignRecipient,
  CrmEmailTemplate,
  CrmMailingList,
  CrmMailingListMember,
} from '@prisma/client'
import type {
  CrmEmailCampaignDTO,
  CrmEmailCampaignRecipientDTO,
  CrmEmailTemplateDTO,
  CrmMailingListDTO,
  CrmMailingListMemberDTO,
} from '@/types/crm-email-marketing'

export function toCrmEmailTemplateDTO(
  template: CrmEmailTemplate,
): CrmEmailTemplateDTO {
  return {
    id: template.id,
    name: template.name,
    subject: template.subject,
    contentHtml: template.contentHtml,
    contentJson: template.contentJson,
    workspaceId: template.workspaceId,
    createdById: template.createdById,
    updatedById: template.updatedById,
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  }
}

export function toCrmEmailCampaignDTO(
  campaign: CrmEmailCampaign & {
    _count?: { recipients: number }
    recipients?: { status: string }[]
  },
): CrmEmailCampaignDTO {
  return {
    id: campaign.id,
    subject: campaign.subject,
    contentHtml: campaign.contentHtml,
    contentJson: campaign.contentJson,
    fromAddress: campaign.fromAddress,
    status: campaign.status,
    recipientScope: campaign.recipientScope,
    recipientCount: campaign._count?.recipients ?? 0,
    sentCount:
      campaign.recipients?.filter((r) => r.status === 'SENT').length ?? 0,
    failedCount:
      campaign.recipients?.filter((r) => r.status === 'FAILED').length ?? 0,
    scheduledAt: campaign.scheduledAt
      ? campaign.scheduledAt.toISOString()
      : null,
    sentAt: campaign.sentAt ? campaign.sentAt.toISOString() : null,
    workspaceId: campaign.workspaceId,
    createdById: campaign.createdById,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  }
}

export function toCrmEmailCampaignRecipientDTO(
  recipient: CrmEmailCampaignRecipient,
): CrmEmailCampaignRecipientDTO {
  return {
    id: recipient.id,
    campaignId: recipient.campaignId,
    personId: recipient.personId,
    email: recipient.email,
    name: recipient.name,
    status: recipient.status,
    providerMessageId: recipient.providerMessageId,
    errorMessage: recipient.errorMessage,
    sentAt: recipient.sentAt ? recipient.sentAt.toISOString() : null,
    createdAt: recipient.createdAt.toISOString(),
  }
}

export function toCrmMailingListDTO(
  list: CrmMailingList & { _count?: { members: number } },
): CrmMailingListDTO {
  return {
    id: list.id,
    name: list.name,
    description: list.description,
    memberCount: list._count?.members ?? 0,
    workspaceId: list.workspaceId,
    createdById: list.createdById,
    createdAt: list.createdAt.toISOString(),
    updatedAt: list.updatedAt.toISOString(),
  }
}

export function toCrmMailingListMemberDTO(
  member: CrmMailingListMember,
): CrmMailingListMemberDTO {
  return {
    id: member.id,
    mailingListId: member.mailingListId,
    email: member.email,
    name: member.name,
    personId: member.personId,
    createdAt: member.createdAt.toISOString(),
  }
}
