import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { SdAiService } from '@/src/services/sd-ai.service'
import { ServicedeskAiJob, type ServicedeskAiJobPayload } from '../jobs'

const COMPONENT = 'ServicedeskAi'

/** Motivos de "pulei" por falta de recurso (cota/provedor) — sobem como warn. */
const WARN_REASONS = new Set([
  'ai_quota_exceeded',
  'ai_provider_unavailable',
  'ai_prepare_failed',
  'unparseable_response',
])

async function processTriage(
  job: Job<ServicedeskAiJobPayload['triage-ticket']>,
): Promise<void> {
  const base = { component: COMPONENT, jobId: job.id, ticketId: job.data.ticketId }
  const result = await SdAiService.triageTicket(job.data.ticketId)
  // Erro de banco: lança para o BullMQ tentar de novo.
  if (!result.ok) {
    throw new Error(`Falha na triagem por IA: ${result.error.code}`)
  }
  const outcome = result.value
  if (outcome.status === 'skipped') {
    const level = WARN_REASONS.has(outcome.reason) ? 'warn' : 'info'
    logger[level]('queue.servicedesk_ai.triage_skipped', {
      ...base,
      reason: outcome.reason,
    })
    return
  }
  if (outcome.status === 'failed') {
    logger.error('queue.servicedesk_ai.triage_failed', {
      ...base,
      reason: outcome.reason,
    })
    return
  }
  logger.info('queue.servicedesk_ai.triaged', {
    ...base,
    applied: outcome.applied.join(','),
    confidence: outcome.confidence,
  })
}

async function processWhatsappReply(
  job: Job<ServicedeskAiJobPayload['whatsapp-reply']>,
): Promise<void> {
  const base = {
    component: COMPONENT,
    jobId: job.id,
    conversationId: job.data.conversationId,
  }
  const result = await SdAiService.whatsappReply(job.data)
  if (!result.ok) {
    throw new Error(`Falha na resposta da IA no WhatsApp: ${result.error.code}`)
  }
  const outcome = result.value
  if (outcome.status === 'failed') {
    logger.error('queue.servicedesk_ai.whatsapp_failed', {
      ...base,
      reason: outcome.reason,
    })
    return
  }
  logger.info('queue.servicedesk_ai.whatsapp', {
    ...base,
    status: outcome.status,
    ...('reason' in outcome ? { reason: outcome.reason } : {}),
    ...('action' in outcome ? { action: outcome.action } : {}),
  })
}

export async function processServicedeskAi(job: Job): Promise<void> {
  switch (job.name) {
    case ServicedeskAiJob.TriageTicket:
      return processTriage(job as Job<ServicedeskAiJobPayload['triage-ticket']>)
    case ServicedeskAiJob.WhatsappReply:
      return processWhatsappReply(
        job as Job<ServicedeskAiJobPayload['whatsapp-reply']>,
      )
    default:
      throw new Error(
        `Unknown servicedesk-ai job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
