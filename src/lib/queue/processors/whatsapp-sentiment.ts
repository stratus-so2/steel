import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { prisma } from '@/src/lib/prisma'
import { AiUsageService } from '@/src/services/ai-usage.service'
import { WhatsappSentimentJob, type WhatsappSentimentJobPayload } from '../jobs'

const SENTIMENT_HISTORY_SAMPLE = 50
const SENTIMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    sentiment: { type: 'string', enum: ['NEGATIVE', 'NEUTRAL', 'POSITIVE'] },
    score: { type: 'number' },
  },
  required: ['sentiment', 'score'],
  additionalProperties: false,
}

const SYSTEM_PROMPT = `Classifique o sentimento da mensagem de um cliente em uma conversa de atendimento via WhatsApp. Responda só com um JSON no formato {"sentiment": "NEGATIVE"|"NEUTRAL"|"POSITIVE", "score": number}, onde score vai de -1 (muito negativo) a 1 (muito positivo).`

interface SentimentResult {
  sentiment: 'NEGATIVE' | 'NEUTRAL' | 'POSITIVE'
  score: number
}

function parseSentimentResponse(content: string): SentimentResult | null {
  try {
    const parsed = JSON.parse(content)
    if (
      (parsed.sentiment === 'NEGATIVE' ||
        parsed.sentiment === 'NEUTRAL' ||
        parsed.sentiment === 'POSITIVE') &&
      typeof parsed.score === 'number'
    ) {
      return {
        sentiment: parsed.sentiment,
        score: Math.max(-1, Math.min(1, parsed.score)),
      }
    }
    return null
  } catch {
    return null
  }
}

async function recomputeConversationAvgSentiment(
  conversationId: string,
): Promise<void> {
  const recent = await prisma.whatsAppMessage.findMany({
    where: { conversationId, sentimentScore: { not: null } },
    orderBy: { createdAt: 'desc' },
    take: SENTIMENT_HISTORY_SAMPLE,
    select: { sentimentScore: true },
  })
  if (recent.length === 0) return

  const avg =
    recent.reduce((sum, m) => sum + (m.sentimentScore ?? 0), 0) / recent.length

  await prisma.whatsAppConversation.update({
    where: { id: conversationId },
    data: { avgSentimentScore: avg },
  })
}

async function processAnalyzeMessage(
  job: Job<WhatsappSentimentJobPayload['analyze-message']>,
): Promise<void> {
  const { messageId } = job.data

  const message = await prisma.whatsAppMessage.findUnique({
    where: { id: messageId },
  })
  if (!message || message.direction !== 'IN' || !message.text?.trim()) {
    logger.info('queue.whatsapp_sentiment.skipped', {
      component: 'WhatsappSentiment',
      jobId: job.id,
      messageId,
      reason: !message
        ? 'message_not_found'
        : message.direction !== 'IN'
          ? 'not_inbound'
          : 'no_text',
    })
    return
  }

  const aiConfig = await prisma.whatsAppAiConfig.findUnique({
    where: { workspaceId: message.workspaceId },
  })
  if (!aiConfig) {
    logger.info('queue.whatsapp_sentiment.skipped', {
      component: 'WhatsappSentiment',
      jobId: job.id,
      messageId,
      reason: 'no_ai_config',
    })
    return
  }

  // Job em background: usa o modelo padrão do workspace para sentimento e
  // respeita a cota — esgotada, só registra e segue sem classificar.
  const prepared = await AiUsageService.prepare(
    message.workspaceId,
    'WHATSAPP_SENTIMENT',
  )
  if (!prepared.ok) {
    logger.warn('queue.whatsapp_sentiment.skipped', {
      component: 'WhatsappSentiment',
      jobId: job.id,
      messageId,
      reason:
        prepared.error.code === 'AI_QUOTA_EXCEEDED'
          ? 'ai_quota_exceeded'
          : prepared.error.code === 'AI_PROVIDER_UNAVAILABLE'
            ? 'ai_provider_unavailable'
            : 'ai_prepare_failed',
    })
    return
  }
  const call = prepared.value

  let result: SentimentResult | null
  try {
    const response = await call.provider.chat({
      model: call.model.model,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: message.text }],
      jsonSchema: { name: 'sentiment', schema: SENTIMENT_JSON_SCHEMA },
    })
    await AiUsageService.record(call, {
      workspaceId: message.workspaceId,
      userId: null,
      usage: response.usage,
    })
    result = parseSentimentResponse(response.text)
  } catch (error) {
    logger.error('queue.whatsapp_sentiment.provider_failed', {
      component: 'WhatsappSentiment',
      jobId: job.id,
      messageId,
      provider: call.model.provider,
      model: call.model.model,
      message: error instanceof Error ? error.message : String(error),
    })
    return
  }

  if (!result) {
    logger.warn('queue.whatsapp_sentiment.unparseable_response', {
      component: 'WhatsappSentiment',
      jobId: job.id,
      messageId,
    })
    return
  }

  await prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: { sentiment: result.sentiment, sentimentScore: result.score },
  })

  await recomputeConversationAvgSentiment(message.conversationId)

  logger.info('queue.whatsapp_sentiment.classified', {
    component: 'WhatsappSentiment',
    jobId: job.id,
    messageId,
    sentiment: result.sentiment,
  })
}

export async function processWhatsappSentiment(job: Job): Promise<void> {
  switch (job.name) {
    case WhatsappSentimentJob.AnalyzeMessage:
      return processAnalyzeMessage(
        job as Job<WhatsappSentimentJobPayload['analyze-message']>,
      )
    default:
      throw new Error(
        `Unknown whatsapp-sentiment job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
