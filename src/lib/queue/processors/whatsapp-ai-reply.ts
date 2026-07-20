import type { Job } from 'bullmq'
import OpenAI from 'openai'
import { logger } from '@/lib/axiom/logger'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { toWhatsAppConversationDTO } from '@/src/mappers/whatsapp-conversation.mapper'
import { toWhatsAppMessageDTO } from '@/src/mappers/whatsapp-message.mapper'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsappAiReplyJob, type WhatsappAiReplyJobPayload } from '../jobs'

const HISTORY_LIMIT = 20

function previewForNonText(type: string): string {
  switch (type) {
    case 'IMAGE':
      return '[imagem]'
    case 'AUDIO':
      return '[áudio]'
    case 'VIDEO':
      return '[vídeo]'
    case 'DOCUMENT':
      return '[documento]'
    default:
      return '[mensagem]'
  }
}

async function processGenerateAiReply(
  job: Job<WhatsappAiReplyJobPayload['generate-ai-reply']>,
): Promise<void> {
  const { conversationId } = job.data

  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: conversationId },
    include: { connection: true },
  })
  if (!conversation?.aiActive) {
    logger.info('queue.whatsapp_ai_reply.skipped', {
      component: 'WhatsappAiReply',
      jobId: job.id,
      conversationId,
      reason: !conversation ? 'conversation_not_found' : 'ai_inactive',
    })
    return
  }

  const aiConfig = await prisma.whatsAppAiConfig.findUnique({
    where: { workspaceId: conversation.workspaceId },
  })
  if (!aiConfig?.active) {
    logger.info('queue.whatsapp_ai_reply.skipped', {
      component: 'WhatsappAiReply',
      jobId: job.id,
      conversationId,
      reason: 'ai_config_inactive',
    })
    return
  }

  const history = await prisma.whatsAppMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: HISTORY_LIMIT,
  })

  const apiKey = await decryptConnectionSecret(aiConfig.encryptedOpenaiApiKey)
  const client = new OpenAI({ apiKey })

  const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] =
    [
      { role: 'system', content: aiConfig.systemPrompt },
      ...history
        .slice()
        .reverse()
        .map((message) => ({
          role: (message.direction === 'IN' ? 'user' : 'assistant') as
            | 'user'
            | 'assistant',
          content: message.text ?? previewForNonText(message.type),
        })),
    ]

  let replyText: string
  try {
    const completion = await client.chat.completions.create({
      model: aiConfig.model,
      messages,
    })
    replyText = completion.choices[0]?.message?.content?.trim() ?? ''
  } catch (error) {
    logger.error('queue.whatsapp_ai_reply.openai_failed', {
      component: 'WhatsappAiReply',
      jobId: job.id,
      conversationId,
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }

  if (!replyText) {
    logger.warn('queue.whatsapp_ai_reply.empty_completion', {
      component: 'WhatsappAiReply',
      jobId: job.id,
      conversationId,
    })
    return
  }

  const contact = await prisma.whatsAppContact.findUnique({
    where: { id: conversation.contactId },
  })
  if (!contact) return

  const sendResult = await WhatsAppSend.text(conversation.connection, {
    to: contact.waId,
    text: replyText,
  })
  if (!sendResult.ok) {
    logger.error('queue.whatsapp_ai_reply.send_failed', {
      component: 'WhatsappAiReply',
      jobId: job.id,
      conversationId,
      reason: sendResult.error.code,
    })
    return
  }

  const message = await prisma.whatsAppMessage.create({
    data: {
      workspaceId: conversation.workspaceId,
      conversationId,
      direction: 'OUT',
      type: 'TEXT',
      text: replyText,
      providerMessageId: sendResult.value.providerMessageId,
      status: 'SENT',
      sentByAi: true,
    },
  })

  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date() },
  })

  await publishWhatsAppEvent(conversation.workspaceId, {
    type: 'message.created',
    conversationId,
    message: toWhatsAppMessageDTO(message),
  })

  const fresh = await WhatsAppConversationRepository.findById(
    conversationId,
    conversation.workspaceId,
  )
  if (fresh.ok && fresh.value) {
    await publishWhatsAppEvent(conversation.workspaceId, {
      type: 'conversation.updated',
      conversation: toWhatsAppConversationDTO(fresh.value),
    })
  }

  logger.info('queue.whatsapp_ai_reply.sent', {
    component: 'WhatsappAiReply',
    jobId: job.id,
    conversationId,
  })
}

export async function processWhatsappAiReply(job: Job): Promise<void> {
  switch (job.name) {
    case WhatsappAiReplyJob.GenerateAiReply:
      return processGenerateAiReply(
        job as Job<WhatsappAiReplyJobPayload['generate-ai-reply']>,
      )
    default:
      throw new Error(
        `Unknown whatsapp-ai-reply job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
