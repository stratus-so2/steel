import { createId } from '@paralleldrive/cuid2'
import type { WhatsAppAiConfig } from '@prisma/client'

export function createFakeWhatsAppAiConfig(
  overrides?: Partial<WhatsAppAiConfig>,
): WhatsAppAiConfig {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    encryptedOpenaiApiKey: 'enc:sk-test',
    model: 'gpt-4o-mini',
    systemPrompt: 'Você é um assistente de atendimento via WhatsApp.',
    active: false,
    readMedia: false,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
