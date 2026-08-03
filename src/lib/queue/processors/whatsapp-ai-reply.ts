import type { WhatsAppMessage } from '@prisma/client'
import type { Job } from 'bullmq'
import OpenAI, { toFile } from 'openai'
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from 'openai/resources/chat/completions'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { toWhatsAppConversationDTO } from '@/src/mappers/whatsapp-conversation.mapper'
import { toWhatsAppMessageDTO } from '@/src/mappers/whatsapp-message.mapper'
import { WhatsAppAiKnowledgeDocumentRepository } from '@/src/repositories/whatsapp-ai-knowledge-document.repository'
import { WhatsAppBroadcastRepository } from '@/src/repositories/whatsapp-broadcast.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsappAiReplyJob, type WhatsappAiReplyJobPayload } from '../jobs'

const HISTORY_LIMIT = 20
const TRANSCRIPTION_MODEL = 'whisper-1'

// Injeção direta no prompt (sem embeddings/busca — decisão registrada no
// plano: poucos documentos por workspace no caso de uso real). Limite de
// caracteres pra não estourar o contexto do modelo com muitos documentos.
const KNOWLEDGE_BASE_CHAR_BUDGET = 20_000

async function buildKnowledgeBaseSection(workspaceId: string): Promise<string> {
  const documents =
    await WhatsAppAiKnowledgeDocumentRepository.listReadyTextsByWorkspace(
      workspaceId,
    )
  if (!documents.ok || documents.value.length === 0) return ''

  let remaining = KNOWLEDGE_BASE_CHAR_BUDGET
  const sections: string[] = []
  for (const doc of documents.value) {
    if (remaining <= 0) break
    const text = doc.extractedText.slice(0, remaining)
    sections.push(`### ${doc.filename}\n${text}`)
    remaining -= text.length
  }
  if (sections.length === 0) return ''

  return `\n\nBase de conhecimento (use como referência para responder; não mencione que são "documentos anexados"):\n${sections.join('\n\n')}`
}

// Convenção de handoff: a IA inclui esse marcador na resposta quando decide
// transferir para um humano; o processor remove antes de enviar ao cliente.
// Continua marcador de texto (não tool call) — é o jeito de menor risco de
// handoff decidido pela IA sem reescrever esse fluxo já em produção. A
// consulta de agendamento abaixo, por outro lado, usa tool calling de
// verdade: o dado não cabe no prompt estático (é por contato, não por
// workspace) e precisa ser buscado sob demanda.
const HANDOFF_MARKER = '[[TRANSFERIR_ATENDENTE]]'
const HANDOFF_SYSTEM_INSTRUCTION = `\n\nSe o cliente pedir para falar com uma pessoa/atendente, ou se você não conseguir ajudar com o que ele precisa, inclua o marcador exato ${HANDOFF_MARKER} em algum ponto da sua resposta — o sistema o remove automaticamente antes de enviar a mensagem.`
const HANDOFF_FALLBACK_MESSAGE =
  'Vou te transferir para um de nossos atendentes, só um momento.'

const CHECK_APPOINTMENT_TOOL_NAME = 'consultar_exame_agendado'
const CHECK_APPOINTMENT_TOOL: ChatCompletionTool = {
  type: 'function',
  function: {
    name: CHECK_APPOINTMENT_TOOL_NAME,
    description:
      'Consulta se o cliente atual tem algum exame ou compromisso agendado, incluindo data e hora. Use sempre que o cliente perguntar se tem algo marcado, quando é o próximo exame, ou pedir para confirmar/saber o horário — não invente ou assuma uma data sem chamar essa ferramenta primeiro.',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
}

interface AppointmentToolResult {
  hasAppointment: boolean
  appointmentAt?: string
  description?: string
}

async function lookupUpcomingAppointment(
  contactId: string,
): Promise<AppointmentToolResult> {
  const result =
    await WhatsAppBroadcastRepository.findUpcomingAppointmentByContact(
      contactId,
    )
  if (!result.ok || !result.value?.appointmentAt) {
    return { hasAppointment: false }
  }
  return {
    hasAppointment: true,
    appointmentAt: result.value.appointmentAt.toISOString(),
    description: result.value.broadcastList.name,
  }
}

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
  const knowledgeBaseSection = await buildKnowledgeBaseSection(
    conversation.workspaceId,
  )
  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content:
        aiConfig.systemPrompt +
        HANDOFF_SYSTEM_INSTRUCTION +
        knowledgeBaseSection,
    },
    ...historyMessages,
  ]

  let replyText: string
  try {
    let completion = await client.chat.completions.create({
      model: aiConfig.model,
      messages,
      tools: [CHECK_APPOINTMENT_TOOL],
    })
    let responseMessage = completion.choices[0]?.message

    if (responseMessage?.tool_calls?.length) {
      messages.push(responseMessage)
      for (const toolCall of responseMessage.tool_calls) {
        if (toolCall.type !== 'function') continue
        const toolResult =
          toolCall.function.name === CHECK_APPOINTMENT_TOOL_NAME
            ? await lookupUpcomingAppointment(conversation.contactId)
            : { error: `Ferramenta desconhecida: ${toolCall.function.name}` }
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        })
      }

      // Segunda chamada sem `tools`: força uma resposta final em texto em
      // vez de permitir outra rodada de tool calls (evita loop).
      completion = await client.chat.completions.create({
        model: aiConfig.model,
        messages,
      })
      responseMessage = completion.choices[0]?.message
    }

    replyText = responseMessage?.content?.trim() ?? ''
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
