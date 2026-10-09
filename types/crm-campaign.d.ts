export type CrmCampaignStatusDTO =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'SENDING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELED'
  | 'FAILED'

export type CrmCampaignDestinationTypeDTO = 'LANDING_PAGE' | 'FORM'

export type CrmCampaignLegalBasisDTO =
  | 'CONSENT'
  | 'LEGITIMATE_INTEREST'
  | 'CONTRACT'

export type CrmCampaignDeliveryStatusDTO =
  | 'NONE'
  | 'PENDING'
  | 'SENDING'
  | 'SENT'
  | 'FAILED'
  | 'SKIPPED'

export type CrmCampaignChannelDTO = 'EMAIL' | 'WHATSAPP'

export type CrmCampaignWizardStep = 'destination' | 'content' | 'audience'

export interface CrmCampaignAudienceDTO {
  mailingListIds: string[]
  allPeople: boolean
  leadStages: string[]
}

export type CrmCampaignVariableSourceKind =
  | 'name'
  | 'first_name'
  | 'link'
  | 'link_code'
  | 'static'

export interface CrmCampaignVariableSourceDTO {
  source: CrmCampaignVariableSourceKind
  value?: string
}

export interface CrmCampaignWhatsAppVariablesDTO {
  header: Record<string, CrmCampaignVariableSourceDTO>
  body: Record<string, CrmCampaignVariableSourceDTO>
  buttons: Record<string, CrmCampaignVariableSourceDTO>
}

/** Something missing before the campaign can be launched. */
export interface CrmCampaignIssueDTO {
  step: CrmCampaignWizardStep
  message: string
}

export interface CrmCampaignLinksDTO {
  /** Destination public URL, without parameters. */
  destination: string | null
  /** Destination URL with the e-mail UTM parameters. */
  email: string | null
  /** Destination URL with the WhatsApp UTM parameters. */
  whatsapp: string | null
}

export interface CrmCampaignDTO {
  id: string
  workspaceId: string
  name: string
  slug: string
  status: CrmCampaignStatusDTO
  destinationType: CrmCampaignDestinationTypeDTO | null
  landingPageId: string | null
  formId: string | null
  utmMedium: string
  emailFrom: string | null
  emailSubject: string | null
  emailPreheader: string | null
  emailTemplateId: string | null
  emailLegalBasis: CrmCampaignLegalBasisDTO | null
  audience: CrmCampaignAudienceDTO
  whatsappEnabled: boolean
  whatsappConnectionId: string | null
  whatsappTemplateId: string | null
  whatsappVariables: CrmCampaignWhatsAppVariablesDTO | null
  whatsappText: string | null
  whatsappMediaUrl: string | null
  whatsappDelayHours: number
  whatsappLegalBasis: CrmCampaignLegalBasisDTO | null
  scheduledAt: string | null
  sendWindowStartHour: number | null
  sendWindowEndHour: number | null
  sendWeekdaysOnly: boolean
  consentConfirmedAt: string | null
  launchedAt: string | null
  startAt: string | null
  completedAt: string | null
  createdById: string
  createdAt: string
  updatedAt: string
  links: CrmCampaignLinksDTO
}

export interface CrmCampaignDetailDTO extends CrmCampaignDTO {
  issues: CrmCampaignIssueDTO[]
}

export interface CrmCampaignKpisDTO {
  recipients: number
  emailSent: number
  emailOpened: number
  emailClicked: number
  whatsappSent: number
  whatsappRead: number
  whatsappReplied: number
  conversions: number
}

export interface CrmCampaignListItemDTO extends CrmCampaignDTO {
  kpis: CrmCampaignKpisDTO
}

export interface CrmCampaignEmailFunnelDTO {
  eligible: number
  pending: number
  sent: number
  delivered: number
  opened: number
  clicked: number
  failed: number
  skipped: number
  bounced: number
  unsubscribed: number
}

export interface CrmCampaignWhatsAppFunnelDTO {
  eligible: number
  pending: number
  sent: number
  delivered: number
  read: number
  clicked: number
  replied: number
  failed: number
  skipped: number
}

export interface CrmCampaignConvertedContactDTO {
  id: string
  kind: 'LANDING_VIEW' | 'FORM_SUBMISSION'
  channel: CrmCampaignChannelDTO | null
  recipientId: string | null
  name: string | null
  leadId: string | null
  personId: string | null
  createdAt: string
}

export interface CrmCampaignStatsDTO {
  recipients: number
  email: CrmCampaignEmailFunnelDTO
  whatsapp: CrmCampaignWhatsAppFunnelDTO
  conversions: {
    total: number
    visits: number
    submissions: number
    byChannel: { email: number; whatsapp: number; unknown: number }
  }
  convertedContacts: CrmCampaignConvertedContactDTO[]
}

export interface CrmCampaignRecipientDTO {
  id: string
  name: string
  email: string | null
  waId: string | null
  personId: string | null
  leadId: string | null
  emailStatus: CrmCampaignDeliveryStatusDTO
  emailSkipReason: string | null
  emailError: string | null
  emailSentAt: string | null
  emailDeliveredAt: string | null
  emailOpenedAt: string | null
  emailClickedAt: string | null
  emailBouncedAt: string | null
  unsubscribedAt: string | null
  whatsappStatus: CrmCampaignDeliveryStatusDTO
  whatsappSkipReason: string | null
  whatsappError: string | null
  whatsappSentAt: string | null
  whatsappDeliveredAt: string | null
  whatsappReadAt: string | null
  whatsappClickedAt: string | null
  whatsappRepliedAt: string | null
  conversationId: string | null
  convertedAt: string | null
}

export interface CrmCampaignRecipientPageDTO {
  items: CrmCampaignRecipientDTO[]
  total: number
  page: number
  pageSize: number
}

export interface CrmCampaignChannelReachDTO {
  reachable: number
  optedOut: number
  missing: number
}

export interface CrmCampaignAudiencePreviewDTO {
  total: number
  email: CrmCampaignChannelReachDTO
  whatsapp: CrmCampaignChannelReachDTO
}

export interface CrmCampaignTemplateFieldsDTO {
  headerVariables: number
  bodyVariables: number
  bodyText: string
  /** Indexes of URL buttons with a dynamic `{{1}}` suffix. */
  urlButtons: number[]
}

export interface CrmCampaignWhatsAppTemplateOptionDTO {
  id: string
  name: string
  language: string
  category: string
  fields: CrmCampaignTemplateFieldsDTO
}

export interface CrmCampaignWhatsAppConnectionOptionDTO {
  id: string
  label: string
  provider: 'META' | 'ZAPI'
  phoneNumber: string
  /** Approved templates (Meta only). */
  templates: CrmCampaignWhatsAppTemplateOptionDTO[]
}

export interface CrmCampaignOptionsDTO {
  baseUrl: string
  landingPages: {
    id: string
    title: string
    published: boolean
    shareToken: string
  }[]
  forms: { id: string; name: string; published: boolean; publicToken: string }[]
  emailTemplates: { id: string; name: string; subject: string }[]
  mailingLists: { id: string; name: string }[]
  whatsapp: {
    available: boolean
    /** pt-BR reason when unavailable. */
    reason: string | null
    connections: CrmCampaignWhatsAppConnectionOptionDTO[]
  }
}

export interface CrmCampaignEmailPreviewDTO {
  subject: string
  html: string
  text: string
}

export type CrmCampaignTestOutcomeDTO = 'sent' | 'failed'

export interface CrmCampaignTestSendResultDTO {
  email: CrmCampaignTestOutcomeDTO | null
  whatsapp: CrmCampaignTestOutcomeDTO | null
  errors: string[]
}
