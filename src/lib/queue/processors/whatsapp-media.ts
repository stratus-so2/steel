import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { decryptConnectionSecret } from '@/src/lib/crypto'
import { prisma } from '@/src/lib/prisma'
import { downloadRemoteMediaToStorage } from '@/src/lib/whatsapp/media'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { toWhatsAppMessageDTO } from '@/src/mappers/whatsapp-message.mapper'
import { WhatsappMediaJob, type WhatsappMediaJobPayload } from '../jobs'

interface ConnectionMediaCredentials {
  provider: 'ZAPI' | 'META'
  encryptedMetaAccessToken: string | null
}

const META_GRAPH_VERSION = 'v23.0'

async function resolveMediaSource(
  connection: ConnectionMediaCredentials,
  rawMediaUrl: string,
): Promise<{ url: string; headers?: Record<string, string> }> {
  if (connection.provider === 'ZAPI') {
    return { url: rawMediaUrl }
  }

  if (!connection.encryptedMetaAccessToken) {
    throw new Error('Conexão Meta sem access token configurado')
  }
  const accessToken = await decryptConnectionSecret(
    connection.encryptedMetaAccessToken,
  )

  const metaResponse = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${rawMediaUrl}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!metaResponse.ok) {
    throw new Error(`Falha ao resolver mídia da Meta (${metaResponse.status})`)
  }
  const body = (await metaResponse.json()) as { url?: string }
  if (!body.url) throw new Error('Meta não retornou URL de mídia')

  return { url: body.url, headers: { Authorization: `Bearer ${accessToken}` } }
}

async function processDownloadInboundMedia(
  job: Job<WhatsappMediaJobPayload['download-inbound-media']>,
): Promise<void> {
  const { messageId } = job.data

  const message = await prisma.whatsAppMessage.findUnique({
    where: { id: messageId },
  })
  if (!message?.mediaUrl) {
    logger.info('queue.whatsapp_media.skipped', {
      component: 'WhatsappMedia',
      jobId: job.id,
      messageId,
    })
    return
  }

  const conversation = await prisma.whatsAppConversation.findUnique({
    where: { id: message.conversationId },
    include: { connection: true },
  })
  if (!conversation) {
    logger.warn('queue.whatsapp_media.conversation_missing', {
      component: 'WhatsappMedia',
      jobId: job.id,
      messageId,
    })
    return
  }

  const source = await resolveMediaSource(
    conversation.connection,
    message.mediaUrl,
  )
  const stored = await downloadRemoteMediaToStorage({
    workspaceId: message.workspaceId,
    url: source.url,
    headers: source.headers,
  })
  if (!stored.ok) {
    logger.error('queue.whatsapp_media.download_failed', {
      component: 'WhatsappMedia',
      jobId: job.id,
      messageId,
      reason: stored.error.code,
    })
    throw new Error(`Falha ao baixar mídia: ${stored.error.message}`)
  }

  const updated = await prisma.whatsAppMessage.update({
    where: { id: messageId },
    data: { mediaUrl: stored.value.url },
  })

  await publishWhatsAppEvent(message.workspaceId, {
    type: 'message.updated',
    conversationId: message.conversationId,
    message: toWhatsAppMessageDTO(updated),
  })

  logger.info('queue.whatsapp_media.downloaded', {
    component: 'WhatsappMedia',
    jobId: job.id,
    messageId,
  })
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
