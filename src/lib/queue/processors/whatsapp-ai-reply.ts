import type { WhatsAppMessage } from '@prisma/client'
import type { Job } from 'bullmq'
import OpenAI, { toFile } from 'openai'
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from 'openai/resources/chat/completions'
import { auditMutation } from '@/lib/axiom/audit'
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
const TRANSCRIPTION_MODEL = 'whisper-1'

// Convenção de handoff: a IA inclui esse marcador na resposta quando decide
// transferir para um humano; o processor remove antes de enviar ao cliente.
// Não depende de tool-calling (o processor usa a Chat Completions API crua,
// sem streamChat) — é o jeito de menor risco de adicionar handoff decidido
// pela IA sem reescrever o fluxo de geração já em produção.
const HANDOFF_MARKER = '[[TRANSFERIR_ATENDENTE]]'
const HANDOFF_SYSTEM_INSTRUCTION = `\n\nSe o cliente pedir para falar com uma pessoa/atendente, ou se você não conseguir ajudar com o que ele precisa, inclua o marcador exato ${HANDOFF_MARKER} em algum ponto da sua resposta — o sistema o remove automaticamente antes de enviar a mensagem.`
const HANDOFF_FALLBACK_MESSAGE =
  'Vou te transferir para um de nossos atendentes, só um momento.'

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

async function transcribeAudio(
  client: OpenAI,
  mediaUrl: string,
): Promise<string | null> {
  try {
    const response = await fetch(mediaUrl)
    if (!response.ok) return null
    const buffer = Buffer.from(await response.arrayBuffer())
    const file = await toFile(buffer, 'audio.ogg')
    const transcription = await client.audio.transcriptions.create({
      file,
      model: TRANSCRIPTION_MODEL,
    })
    return transcription.text?.trim() || null
  } catch (error) {
    logger.error('queue.whatsapp_ai_reply.transcription_failed', {
      component: 'WhatsappAiReply',
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

// Only the message that triggered this job gets the full (costly) media
// read — older history entries stay as cheap text placeholders. Only
// customer-sent (IN) messages are eligible: past assistant image/audio
// output doesn't need re-reading to stay in context.
async function describeMessageContent(
  client: OpenAI,
  message: WhatsAppMessage,
  triggerMessageId: string,
  readMedia: boolean,
): Promise<string | ChatCompletionContentPart[]> {
  const isTrigger = message.id === triggerMessageId
  if (
    !readMedia ||
    !isTrigger ||
    message.direction !== 'IN' ||
    !message.mediaUrl
  ) {
    return message.text ?? previewForNonText(message.type)
  }

  if (message.type === 'IMAGE') {
    return [
      { type: 'text', text: message.text || 'Imagem enviada pelo cliente' },
      { type: 'image_url', image_url: { url: message.mediaUrl } },
    ]
  }

  if (message.type === 'AUDIO') {
    const transcribed = await transcribeAudio(client, message.mediaUrl)
    return transcribed
      ? `[áudio transcrito] ${transcribed}`
      : previewForNonText(message.type)
  }

  return message.text ?? previewForNonText(message.type)
}

async function processGenerateAiReply(
  job: Job<WhatsappAiReplyJobPayload['generate-ai-reply']>,
): Promise<void> {
  const { conversationId, messageId } = job.data

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

  const orderedHistory = history.slice().reverse()
  const historyMessages = await Promise.all(
    orderedHistory.map(async (message) => {
      const content = await describeMessageContent(
        client,
        message,
        messageId,
        aiConfig.readMedia,
      )
      // Vision content parts only ever come back for IN messages (see
      // describeMessageContent), so the 'assistant' branch is always a
      // plain string at runtime.
      return message.direction === 'IN'
        ? ({ role: 'user', content } as ChatCompletionMessageParam)
        : ({
            role: 'assistant',
            content: content as string,
          } as ChatCompletionMessageParam)
    }),
  )
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: aiConfig.systemPrompt + HANDOFF_SYSTEM_INSTRUCTION,
    },
    ...historyMessages,
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

  const shouldHandoff = replyText.includes(HANDOFF_MARKER)
  const textToSend = shouldHandoff
    ? replyText.replaceAll(HANDOFF_MARKER, '').trim() ||
      HANDOFF_FALLBACK_MESSAGE
    : replyText

  const contact = await prisma.whatsAppContact.findUnique({
    where: { id: conversation.contactId },
  })
  if (!contact) return

  const sendResult = await WhatsAppSend.text(conversation.connection, {
    to: contact.waId,
    text: textToSend,
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
      text: textToSend,
      providerMessageId: sendResult.value.providerMessageId,
      status: 'SENT',
      sentByAi: true,
    },
  })

  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: {
      lastMessageAt: new Date(),
      ...(shouldHandoff
        ? { aiActive: false, aiHandoff: true, status: 'IN_PROGRESS' as const }
        : {}),
    },
  })

  if (shouldHandoff) {
    auditMutation({
      entity: 'whatsapp_conversation',
      action: 'update',
      actorId: null,
      targetId: conversationId,
      meta: { aiHandoff: true, trigger: 'ai' },
    })
    logger.info('queue.whatsapp_ai_reply.handoff', {
      component: 'WhatsappAiReply',
      jobId: job.id,
      conversationId,
    })
  }

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
