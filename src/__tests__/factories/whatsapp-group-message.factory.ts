import { createId } from '@paralleldrive/cuid2'
import type { WhatsAppGroupMessage } from '@prisma/client'

export function createFakeWhatsAppGroupMessage(
  overrides?: Partial<WhatsAppGroupMessage>,
): WhatsAppGroupMessage {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    groupId: createId(),
    direction: 'IN',
    type: 'TEXT',
    text: 'Bom dia, time!',
    mediaUrl: null,
    providerMessageId: createId(),
    status: 'DELIVERED',
    senderUserId: null,
    senderWaId: '5511988887777',
    senderName: 'Maria Silva',
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
