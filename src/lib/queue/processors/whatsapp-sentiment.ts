import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { WhatsAppSentimentService } from '@/src/services/whatsapp-sentiment.service'
import { WhatsappSentimentJob, type WhatsappSentimentJobPayload } from '../jobs'

// Falta de recurso (cota/provedor) sobe como warn; o resto é fluxo normal.
const WARN_SKIP_REASONS = new Set([
  'ai_quota_exceeded',
  'ai_provider_unavailable',
  'ai_prepare_failed',
])

async function processAnalyzeMessage(
  job: Job<WhatsappSentimentJobPayload['analyze-message']>,
): Promise<void> {
  const { messageId } = job.data
  const base = { component: 'WhatsappSentiment', jobId: job.id, messageId }

  const result = await WhatsAppSentimentService.analyzeMessage(messageId)
  // Falha de banco: lança para o BullMQ tentar de novo.
  if (!result.ok) {
    throw new Error(`Falha ao analisar sentimento: ${result.error.code}`)
  }

  const outcome = result.value
  switch (outcome.status) {
    case 'skipped':
      if (outcome.reason === 'unparseable_response') {
        logger.warn('queue.whatsapp_sentiment.unparseable_response', base)
      } else if (WARN_SKIP_REASONS.has(outcome.reason)) {
        logger.warn('queue.whatsapp_sentiment.skipped', {
          ...base,
          reason: outcome.reason,
        })
      } else {
        logger.info('queue.whatsapp_sentiment.skipped', {
          ...base,
          reason: outcome.reason,
        })
      }
      return
    case 'failed':
      logger.error('queue.whatsapp_sentiment.provider_failed', {
        ...base,
        provider: outcome.provider,
        model: outcome.model,
        message: outcome.detail,
      })
      return
    case 'classified':
      logger.info('queue.whatsapp_sentiment.classified', {
        ...base,
        sentiment: outcome.sentiment,
      })
      return
  }
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
