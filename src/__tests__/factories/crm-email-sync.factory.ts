import { createId } from '@paralleldrive/cuid2'
import type {
  CrmCalendarEvent,
  CrmEmailAccount,
  CrmEmailMessage,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'

export function createFakeCrmEmailAccount(
  overrides?: Partial<CrmEmailAccount>,
): CrmEmailAccount {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    userId: createId(),
    provider: 'GMAIL',
    email: 'jane@acme.com',
    lastSyncedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmEmailAccount(
  workspaceId: string,
  userId: string,
  overrides?: Partial<Pick<CrmEmailAccount, 'provider' | 'email'>>,
) {
  return prisma.crmEmailAccount.create({
    data: {
      provider: 'GMAIL',
      email: 'jane@acme.com',
      workspaceId,
      userId,
      ...overrides,
    },
  })
}

export function createFakeCrmEmailMessage(
  overrides?: Partial<CrmEmailMessage>,
): CrmEmailMessage {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    accountId: null,
    createdById: createId(),
    direction: 'OUTBOUND',
    subject: 'Oi',
    snippet: null,
    fromEmail: 'me@acme.com',
    toEmails: ['jane@acme.com'],
    personId: null,
    opportunityId: null,
    sentAt: now,
    createdAt: now,
    ...overrides,
  }
}

export async function seedCrmEmailMessage(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmEmailMessage, 'direction' | 'fromEmail' | 'personId'>
  >,
) {
  return prisma.crmEmailMessage.create({
    data: {
      direction: 'OUTBOUND',
      fromEmail: 'me@acme.com',
      sentAt: new Date(),
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export function createFakeCrmCalendarEvent(
  overrides?: Partial<CrmCalendarEvent>,
): CrmCalendarEvent {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    accountId: null,
    createdById: createId(),
    title: 'Reunião',
    description: null,
    startsAt: now,
    endsAt: now,
    attendees: [],
    personId: null,
    opportunityId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmCalendarEvent(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Pick<CrmCalendarEvent, 'title' | 'personId'>>,
) {
  const now = new Date()
  return prisma.crmCalendarEvent.create({
    data: {
      title: 'Reunião',
      startsAt: now,
      endsAt: now,
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}
