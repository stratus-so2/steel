import type {
  CrmCalendarEvent,
  CrmEmailAccount,
  CrmEmailMessage,
} from '@prisma/client'
import type {
  CrmCalendarEventDTO,
  CrmEmailAccountDTO,
  CrmEmailMessageDTO,
} from '@/types/crm-email-sync'

export function toCrmEmailAccountDTO(
  account: CrmEmailAccount,
): CrmEmailAccountDTO {
  return {
    id: account.id,
    provider: account.provider,
    email: account.email,
    lastSyncedAt: account.lastSyncedAt
      ? account.lastSyncedAt.toISOString()
      : null,
    workspaceId: account.workspaceId,
    userId: account.userId,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  }
}

export function toCrmEmailMessageDTO(
  message: CrmEmailMessage,
): CrmEmailMessageDTO {
  return {
    id: message.id,
    workspaceId: message.workspaceId,
    accountId: message.accountId,
    createdById: message.createdById,
    direction: message.direction,
    subject: message.subject,
    snippet: message.snippet,
    fromEmail: message.fromEmail,
    toEmails: message.toEmails,
    personId: message.personId,
    opportunityId: message.opportunityId,
    sentAt: message.sentAt.toISOString(),
    createdAt: message.createdAt.toISOString(),
  }
}

export function toCrmCalendarEventDTO(
  event: CrmCalendarEvent,
): CrmCalendarEventDTO {
  return {
    id: event.id,
    workspaceId: event.workspaceId,
    accountId: event.accountId,
    createdById: event.createdById,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    attendees: event.attendees,
    personId: event.personId,
    opportunityId: event.opportunityId,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}
