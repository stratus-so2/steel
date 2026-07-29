import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import {
  buildMetaSendComponents,
  extractTemplateFillableFields,
  parseMetaTemplateComponents,
} from '@/src/lib/whatsapp/template-variables'
import type { WhatsAppSendResult } from '@/src/lib/whatsapp/types'
import { WhatsAppBroadcastRepository } from '@/src/repositories/whatsapp-broadcast.repository'
import { WhatsappBroadcastJob, type WhatsappBroadcastJobPayload } from '../jobs'
import { getWhatsappBroadcastQueue } from '../queues'

interface TemplateVariableValues {
  header?: Record<number, string>
  body?: Record<number, string>
  buttons?: Record<number, string>
}

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

  let sendResult: Result<WhatsAppSendResult>
  if (recipient.broadcastList.templateId) {
    const template = await prisma.whatsAppTemplate.findUnique({
      where: { id: recipient.broadcastList.templateId },
    })
    if (!template) {
      await WhatsAppBroadcastRepository.updateRecipientStatus(recipientId, {
        status: 'FAILED',
        errorMessage: 'Template não encontrado',
      })
      return
    }

    const fields = extractTemplateFillableFields(
      parseMetaTemplateComponents(template.components as unknown[]),
    )
    const values = (recipient.variableValues ?? {}) as TemplateVariableValues
    const components = buildMetaSendComponents(fields, {
      header: values.header ?? {},
      body: values.body ?? {},
      buttons: values.buttons ?? {},
    })

    sendResult = await WhatsAppSend.template(connection, {
      to: recipient.contact.waId,
      templateName: template.name,
      language: template.language,
      components,
    })
  } else {
    sendResult = recipient.broadcastList.mediaUrl
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
  }

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

async function processRunScheduleTick(job: Job): Promise<void> {
  const due = await WhatsAppBroadcastRepository.listDueScheduledRecipients(
    new Date(),
  )
  if (!due.ok) {
    throw new Error(
      `Failed to list due scheduled broadcast recipients: ${due.error.code}`,
    )
  }

  const queue = getWhatsappBroadcastQueue()
  await queue.addBulk(
    due.value.map((recipient) => ({
      name: WhatsappBroadcastJob.SendBroadcastMessage,
      data: {
        broadcastListId: recipient.broadcastListId,
        recipientId: recipient.id,
      },
      // jobId determinístico: evita reenfileirar o mesmo destinatário se o
      // tick rodar de novo antes do job anterior sair de PENDING (BullMQ
      // recusa duplicar um jobId ainda ativo/esperando na fila).
      opts: { jobId: `broadcast-recipient-${recipient.id}` },
    })),
  )

  logger.info('queue.whatsapp_broadcast.tick_completed', {
    component: 'WhatsappBroadcast',
    jobId: job.id,
    due: due.value.length,
  })
}

export async function processWhatsappBroadcast(job: Job): Promise<void> {
  switch (job.name) {
    case WhatsappBroadcastJob.SendBroadcastMessage:
      return processSendBroadcastMessage(
        job as Job<WhatsappBroadcastJobPayload['send-broadcast-message']>,
      )
    case WhatsappBroadcastJob.RunScheduleTick:
      return processRunScheduleTick(job)
    default:
      throw new Error(
        `Unknown whatsapp-broadcast job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
