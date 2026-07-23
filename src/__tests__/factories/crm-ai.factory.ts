import { createId } from '@paralleldrive/cuid2'
import type {
  CrmAiAttachment,
  CrmAiConversation,
  CrmAiMessage,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmAiConversationDTO, CrmAiMessageDTO } from '@/types/crm-ai'

export function createFakeCrmAiConversation(
  overrides?: Partial<CrmAiConversation>,
): CrmAiConversation {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    userId: createId(),
    title: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmAiConversationDTO(
  overrides?: Partial<CrmAiConversationDTO>,
): CrmAiConversationDTO {
  const now = new Date().toISOString()
  return {
    id: createId(),
    workspaceId: createId(),
    userId: createId(),
    title: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmAiConversation(
  workspaceId: string,
  userId: string,
  overrides?: Partial<Pick<CrmAiConversation, 'title' | 'deletedAt'>>,
) {
  return prisma.crmAiConversation.create({
    data: { workspaceId, userId, ...overrides },
  })
}

export function createFakeCrmAiMessage(
  overrides?: Partial<CrmAiMessage>,
): CrmAiMessage {
  return {
    id: createId(),
    conversationId: createId(),
    role: 'USER',
    content: 'Olá',
    createdAt: new Date(),
    ...overrides,
  }
}

export function createFakeCrmAiMessageDTO(
  overrides?: Partial<CrmAiMessageDTO>,
): CrmAiMessageDTO {
  return {
    id: createId(),
    conversationId: createId(),
    role: 'USER',
    content: 'Olá',
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

export async function seedCrmAiMessage(
  conversationId: string,
  overrides?: Partial<Pick<CrmAiMessage, 'role' | 'content'>>,
) {
  return prisma.crmAiMessage.create({
    data: { conversationId, content: 'Olá', role: 'USER', ...overrides },
  })
}

export function createFakeCrmAiAttachment(
  overrides?: Partial<CrmAiAttachment>,
): CrmAiAttachment {
  return {
    id: createId(),
    conversationId: createId(),
    messageId: null,
    kind: 'IMAGE',
    filename: 'foto.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 1024,
    storageKey: `${createId()}/${createId()}.jpg`,
    createdAt: new Date(),
    ...overrides,
  }
}

export async function seedCrmAiAttachment(
  conversationId: string,
  overrides?: Partial<Pick<CrmAiAttachment, 'kind' | 'messageId'>>,
) {
  return prisma.crmAiAttachment.create({
    data: {
      conversationId,
      kind: 'IMAGE',
      filename: 'foto.jpg',
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      storageKey: `${conversationId}/${createId()}.jpg`,
      ...overrides,
    },
  })
}
