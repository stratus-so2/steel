import { createId } from '@paralleldrive/cuid2'
import type { WhatsAppContact } from '@prisma/client'

export function createFakeWhatsAppContact(
  overrides?: Partial<WhatsAppContact>,
): WhatsAppContact {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    waId: '5511988887777',
    name: 'Maria Silva',
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
