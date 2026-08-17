import type { Job } from 'bullmq'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { prisma } from '@/src/lib/prisma'
import { ok } from '@/src/lib/result'
import { WhatsappAiReplyJob } from '../../jobs'

vi.mock('@/src/lib/whatsapp/send', () => ({
  WhatsAppSend: { text: vi.fn() },
}))

vi.mock('@/src/lib/crypto', () => ({
  decryptConnectionSecret: vi.fn(async (envelope: string) =>
    envelope.replace(/^enc:/, ''),
  ),
}))

const mockCreate = vi.fn()
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(function MockOpenAI() {
    return { chat: { completions: { create: mockCreate } } }
  }),
  toFile: vi.fn(),
}))

import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { processWhatsappAiReply } from '../whatsapp-ai-reply'

const mockedSend = vi.mocked(WhatsAppSend)

function job(conversationId: string, messageId: string): Job {
  return {
    name: WhatsappAiReplyJob.GenerateAiReply,
    id: 'test-job',
    data: { conversationId, messageId },
  } as unknown as Job
}

async function seedFixtures(overrides?: { systemPrompt?: string }) {
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
      aiActive: true,
    },
  })
  await prisma.whatsAppAiConfig.create({
    data: {
      workspaceId: workspace.id,
      encryptedOpenaiApiKey: 'enc:fake-api-key',
      systemPrompt:
        overrides?.systemPrompt ?? 'Você é o assistente da clínica.',
      active: true,
    },
  })
  const message = await prisma.whatsAppMessage.create({
    data: {
      workspaceId: workspace.id,
      conversationId: conversation.id,
      direction: 'IN',
      type: 'TEXT',
      text: 'Tenho algum exame agendado?',
      providerMessageId: `msg-${crypto.randomUUID()}`,
      status: 'DELIVERED',
    },
  })
  return { workspace, user, connection, contact, conversation, message }
}

describe('processWhatsappAiReply() — tool calling', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should call the appointment tool and answer using its result', async () => {
    const { workspace, user, connection, contact, conversation, message } =
      await seedFixtures()
    const broadcastList = await prisma.whatsAppBroadcastList.create({
      data: {
        workspaceId: workspace.id,
        connectionId: connection.id,
        name: 'Confirmação de exames',
        messageBody: 'placeholder',
        status: 'QUEUED',
        createdById: user.id,
      },
    })
    const appointmentAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await prisma.whatsAppBroadcastRecipient.create({
      data: {
        broadcastListId: broadcastList.id,
        contactId: contact.id,
        appointmentAt,
      },
    })

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'consultar_exame_agendado',
                    arguments: '{}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Sim! Você tem exame marcado para 15/08 às 09h.',
            },
          },
        ],
      })
    mockedSend.text.mockResolvedValue(ok({ providerMessageId: 'sent-1' }))

    await processWhatsappAiReply(job(conversation.id, message.id))

    expect(mockCreate).toHaveBeenCalledTimes(2)

    const secondCallArgs = mockCreate.mock.calls[1][0]
    const toolMessage = secondCallArgs.messages.find(
      (m: { role: string }) => m.role === 'tool',
    )
    expect(toolMessage).toBeDefined()
    const toolPayload = JSON.parse(toolMessage.content)
    expect(toolPayload).toEqual({
      hasAppointment: true,
      appointmentAt: appointmentAt.toISOString(),
      description: 'Confirmação de exames',
    })

    expect(mockedSend.text).toHaveBeenCalledWith(
      expect.objectContaining({ id: connection.id }),
      expect.objectContaining({
        text: 'Sim! Você tem exame marcado para 15/08 às 09h.',
      }),
    )

    const sentMessage = await prisma.whatsAppMessage.findFirst({
      where: { conversationId: conversation.id, direction: 'OUT' },
    })
    expect(sentMessage?.text).toBe(
      'Sim! Você tem exame marcado para 15/08 às 09h.',
    )
  })

  it('should tell the tool there is no appointment when none exists', async () => {
    const { conversation, message } = await seedFixtures()

    mockCreate
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: {
                    name: 'consultar_exame_agendado',
                    arguments: '{}',
                  },
                },
              ],
            },
          },
        ],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              role: 'assistant',
              content: 'Não encontrei nenhum exame agendado no seu nome.',
            },
          },
        ],
      })
    mockedSend.text.mockResolvedValue(ok({ providerMessageId: 'sent-2' }))

    await processWhatsappAiReply(job(conversation.id, message.id))

    const secondCallArgs = mockCreate.mock.calls[1][0]
    const toolMessage = secondCallArgs.messages.find(
      (m: { role: string }) => m.role === 'tool',
    )
    expect(JSON.parse(toolMessage.content)).toEqual({ hasAppointment: false })
  })

  it('should not call the tool when the model answers directly', async () => {
    const { conversation, message } = await seedFixtures()

    mockCreate.mockResolvedValueOnce({
      choices: [
        {
          message: { role: 'assistant', content: 'Olá! Como posso ajudar?' },
        },
      ],
    })
    mockedSend.text.mockResolvedValue(ok({ providerMessageId: 'sent-3' }))

    await processWhatsappAiReply(job(conversation.id, message.id))

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockedSend.text).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ text: 'Olá! Como posso ajudar?' }),
    )
  })
})
