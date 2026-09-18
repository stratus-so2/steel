import type { Job } from 'bullmq'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  seedAiUsage,
  seedWorkspaceAiSettings,
} from '@/src/__tests__/factories/ai-settings.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import type { AiChatRequest, AiChatResponse } from '@/src/lib/ai/types'
import { prisma } from '@/src/lib/prisma'
import { WhatsappSentimentJob } from '../../jobs'

const mockChat = vi.fn<(request: AiChatRequest) => Promise<AiChatResponse>>()
vi.mock('@/src/lib/ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/src/lib/ai')>()
  return {
    ...actual,
    isAiProviderConfigured: () => true,
    getAiProvider: (id: 'openai' | 'anthropic') => ({ id, chat: mockChat }),
  }
})

import { processWhatsappSentiment } from '../whatsapp-sentiment'

function job(messageId: string): Job {
  return {
    name: WhatsappSentimentJob.AnalyzeMessage,
    id: 'test-job',
    data: { messageId },
  } as unknown as Job
}

async function seedFixtures() {
  const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId: workspace.id,
      provider: 'META',
      label: 'Principal',
      phoneNumber: '5511999990000',
      metaPhoneNumberId: 'phone-id',
      metaWabaId: 'waba-id',
      encryptedMetaAccessToken: 'enc:token',
      createdById: user.id,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: { workspaceId: workspace.id, waId: '5511988887777' },
  })
  const conversation = await prisma.whatsAppConversation.create({
    data: {
      workspaceId: workspace.id,
      connectionId: connection.id,
      contactId: contact.id,
    },
  })
  await prisma.whatsAppAiConfig.create({
    data: { workspaceId: workspace.id, systemPrompt: 'x', active: false },
  })
  const message = await prisma.whatsAppMessage.create({
    data: {
      workspaceId: workspace.id,
      conversationId: conversation.id,
      direction: 'IN',
      type: 'TEXT',
      text: 'Adorei o atendimento, muito obrigado!',
      providerMessageId: `msg-${crypto.randomUUID()}`,
      status: 'DELIVERED',
    },
  })
  return { workspace, conversation, message }
}

describe('processWhatsappSentiment()', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should classify with the workspace sentiment model and charge the ledger', async () => {
    const { workspace, conversation, message } = await seedFixtures()
    await seedWorkspaceAiSettings(workspace.id, {
      enabledModels: ['openai:gpt-4o-mini', 'anthropic:claude-haiku-4-5'],
      whatsappSentimentModel: 'anthropic:claude-haiku-4-5',
    })
    mockChat.mockResolvedValueOnce({
      text: '{"sentiment":"POSITIVE","score":0.9}',
      toolCalls: [],
      message: { role: 'assistant', content: '' },
      usage: { inputTokens: 80, outputTokens: 20 },
      stopReason: 'end',
    })

    await processWhatsappSentiment(job(message.id))

    const request = mockChat.mock.calls[0][0]
    expect(request.model).toBe('claude-haiku-4-5')
    expect(request.jsonSchema?.name).toBe('sentiment')

    const updated = await prisma.whatsAppMessage.findUnique({
      where: { id: message.id },
    })
    expect(updated?.sentiment).toBe('POSITIVE')
    expect(updated?.sentimentScore).toBe(0.9)
    const fresh = await prisma.whatsAppConversation.findUnique({
      where: { id: conversation.id },
    })
    expect(fresh?.avgSentimentScore).toBe(0.9)

    const usage = await prisma.aiUsage.findFirst({
      where: { workspaceId: workspace.id },
    })
    expect(usage?.feature).toBe('WHATSAPP_SENTIMENT')
    expect(usage?.costUsd.toNumber()).toBe(0.4)
  })

  it('should skip without calling the AI when the quota is exhausted', async () => {
    const { workspace, message } = await seedFixtures()
    await seedWorkspaceAiSettings(workspace.id, { monthlyQuotaUsd: 5 })
    await seedAiUsage(workspace.id, { costUsd: 7.5 })

    await processWhatsappSentiment(job(message.id))

    expect(mockChat).not.toHaveBeenCalled()
    const untouched = await prisma.whatsAppMessage.findUnique({
      where: { id: message.id },
    })
    expect(untouched?.sentiment).toBeNull()
  })

  it('should not throw when the provider fails', async () => {
    const { message } = await seedFixtures()
    mockChat.mockRejectedValueOnce(new Error('overloaded'))

    await expect(processWhatsappSentiment(job(message.id))).resolves.toBe(
      undefined,
    )
  })
})
