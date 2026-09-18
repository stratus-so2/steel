import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { WhatsAppMediaService } from '@/src/services/whatsapp-media.service'
import { WhatsappMediaJob, type WhatsappMediaJobPayload } from '../jobs'

async function processDownloadInboundMedia(
  job: Job<WhatsappMediaJobPayload['download-inbound-media']>,
): Promise<void> {
  const { messageId } = job.data
  const base = { component: 'WhatsappMedia', jobId: job.id, messageId }

  const result = await WhatsAppMediaService.downloadInboundMedia(messageId)
  if (!result.ok) {
    logger.error('queue.whatsapp_media.download_failed', {
      ...base,
      reason: result.error.code,
    })
    // Lança para o BullMQ tentar de novo (provedor/storage fora do ar).
    throw new Error(`Falha ao baixar mídia: ${result.error.message}`)
  }

  const outcome = result.value
  if (outcome.status === 'skipped') {
    if (outcome.reason === 'conversation_missing') {
      logger.warn('queue.whatsapp_media.conversation_missing', base)
    } else {
      logger.info('queue.whatsapp_media.skipped', base)
    }
    return
  }

  logger.info('queue.whatsapp_media.downloaded', base)
}

export async function processWhatsappMedia(job: Job): Promise<void> {
  switch (job.name) {
    case WhatsappMediaJob.DownloadInboundMedia:
      return processDownloadInboundMedia(
        job as Job<WhatsappMediaJobPayload['download-inbound-media']>,
      )
    default:
      throw new Error(
        `Unknown whatsapp-media job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
