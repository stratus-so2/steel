export type CrmEmailProviderDTO = 'GMAIL' | 'OUTLOOK'
export type CrmMailDirectionDTO = 'INBOUND' | 'OUTBOUND'

export interface CrmEmailAccountDTO {
  id: string
  provider: CrmEmailProviderDTO
  email: string
  lastSyncedAt: string | null
  workspaceId: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface CrmEmailMessageDTO {
  id: string
  workspaceId: string
  accountId: string | null
  createdById: string
  direction: CrmMailDirectionDTO
  subject: string | null
  snippet: string | null
  fromEmail: string
  toEmails: string[]
  personId: string | null
  opportunityId: string | null
  sentAt: string
  createdAt: string
}

export interface CrmCalendarEventDTO {
  id: string
  workspaceId: string
  accountId: string | null
  createdById: string
  title: string
  description: string | null
  startsAt: string
  endsAt: string
  attendees: string[]
  personId: string | null
  opportunityId: string | null
  createdAt: string
  updatedAt: string
}
