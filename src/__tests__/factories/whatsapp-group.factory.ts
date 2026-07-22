import { createId } from '@paralleldrive/cuid2'
import type { WhatsAppGroup, WhatsAppGroupParticipant } from '@prisma/client'
import type { WhatsAppGroupWithParticipants } from '@/src/repositories/whatsapp-group.repository'
import type { createFakeWhatsAppGroupMessage } from './whatsapp-group-message.factory'

export function createFakeWhatsAppGroup(
  overrides?: Partial<WhatsAppGroup>,
): WhatsAppGroup {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    connectionId: createId(),
    groupJid: '120363000000000000@g.us',
    name: 'Time de Suporte',
    imageUrl: null,
    description: null,
    inviteLink: null,
    lastMessageAt: null,
    archivedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeWhatsAppGroupParticipant(
  overrides?: Partial<WhatsAppGroupParticipant>,
): WhatsAppGroupParticipant {
  return {
    id: createId(),
    groupId: createId(),
    waId: '5511988887777',
    name: 'Maria Silva',
    role: 'MEMBER',
    createdAt: new Date(),
    ...overrides,
  }
}

export function createFakeWhatsAppGroupWithParticipants(
  overrides?: Partial<WhatsAppGroup> & {
    participants?: WhatsAppGroupParticipant[]
    messages?: ReturnType<typeof createFakeWhatsAppGroupMessage>[]
  },
): WhatsAppGroupWithParticipants {
  const { participants, messages, ...groupOverrides } = overrides ?? {}
  const group = createFakeWhatsAppGroup(groupOverrides)

  return {
    ...group,
    participants: participants ?? [],
    messages: messages ?? [],
  }
}
