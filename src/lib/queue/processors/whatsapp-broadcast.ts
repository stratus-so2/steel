import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { prisma } from '@/src/lib/prisma'
import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { WhatsAppBroadcastRepository } from '@/src/repositories/whatsapp-broadcast.repository'
import { WhatsappBroadcastJob, type WhatsappBroadcastJobPayload } from '../jobs'

async function processSendBroadcastMessage(
  job: Job<WhatsappBroadcastJobPayload['send-broadcast-message']>,
): Promise<void> {
  const { broadcastListId, recipientId } = job.data

  const recipientResult =
    await WhatsAppBroadcastRepository.findRecipientById(recipientId)
  if (!recipientResult.ok || !recipientResult.value) {
    logger.warn('queue.whatsapp_broadcast.recipient_missing', {
      component: 'WhatsappBroadcast',
      jobId: job.id,
      recipientId,
    })
    return
  }
  const recipient = recipientResult.value

  if (recipient.status !== 'PENDING') return

  const connection = await prisma.whatsAppConnection.findUnique({
    where: { id: recipient.broadcastList.connectionId },
  })
  if (!connection) {
    await WhatsAppBroadcastRepository.updateRecipientStatus(recipientId, {
      status: 'FAILED',
      errorMessage: 'Conexão não encontrada',
    })
    return
  }

  const sendResult = recipient.broadcastList.mediaUrl
    ? await WhatsAppSend.media(connection, {
        to: recipient.contact.waId,
        mediaUrl: recipient.broadcastList.mediaUrl,
        type: 'image',
        caption: recipient.broadcastList.messageBody,
      })
    : await WhatsAppSend.text(connection, {
        to: recipient.contact.waId,
        text: recipient.broadcastList.messageBody,
      })

  if (!sendResult.ok) {
    await WhatsAppBroadcastRepository.updateRecipientStatus(recipientId, {
      status: 'FAILED',
      errorMessage: sendResult.error.message,
    })
  } else {
    await WhatsAppBroadcastRepository.updateRecipientStatus(recipientId, {
      status: 'SENT',
      providerMessageId: sendResult.value.providerMessageId,
      sentAt: new Date(),
    })
  }

  const pending =
    await WhatsAppBroadcastRepository.countPendingRecipients(broadcastListId)
  if (pending.ok && pending.value === 0) {
    await WhatsAppBroadcastRepository.updateStatus(broadcastListId, 'DONE')
  }

  logger.info('queue.whatsapp_broadcast.processed', {
    component: 'WhatsappBroadcast',
    jobId: job.id,
    recipientId,
    ok: sendResult.ok,
  })
}

export async function processWhatsappBroadcast(job: Job): Promise<void> {
  switch (job.name) {
    case WhatsappBroadcastJob.SendBroadcastMessage:
      return processSendBroadcastMessage(
        job as Job<WhatsappBroadcastJobPayload['send-broadcast-message']>,
      )
    default:
      throw new Error(
        `Unknown whatsapp-broadcast job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
