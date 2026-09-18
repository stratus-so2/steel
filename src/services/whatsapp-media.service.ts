import { whatsappProviderError } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  downloadRemoteMediaToStorage,
  resolveInboundMediaSource,
} from '@/src/lib/whatsapp/media'
import { publishWhatsAppEvent } from '@/src/lib/whatsapp/realtime'
import { toWhatsAppMessageDTO } from '@/src/mappers/whatsapp-message.mapper'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'

export type WhatsAppInboundMediaOutcome =
  | { status: 'skipped'; reason: 'no_media' | 'conversation_missing' }
  | { status: 'downloaded'; url: string }

export const WhatsAppMediaService = {
  /**
   * Copia a mídia de uma mensagem (URL/ID do provedor) para o storage do
   * workspace e troca `mediaUrl` pela URL definitiva. Fluxo de sistema (job
   * em background): falha no provedor ou no storage volta como erro para o
   * job tentar de novo.
   */
  async downloadInboundMedia(
    messageId: string,
  ): Promise<Result<WhatsAppInboundMediaOutcome>> {
    const found = await WhatsAppMessageRepository.findById(messageId)
    if (!found.ok) return found
    const message = found.value
    if (!message?.mediaUrl) return ok({ status: 'skipped', reason: 'no_media' })

    const conversation =
      await WhatsAppConversationRepository.findByIdWithConnection(
        message.conversationId,
      )
    if (!conversation.ok) return conversation
    if (!conversation.value) {
      return ok({ status: 'skipped', reason: 'conversation_missing' })
    }

    let source: Awaited<ReturnType<typeof resolveInboundMediaSource>>
    try {
      source = await resolveInboundMediaSource(
        conversation.value.connection,
        message.mediaUrl,
      )
    } catch (error) {
      return err(
        whatsappProviderError(
          error instanceof Error ? error.message : 'Falha ao resolver mídia',
        ),
      )
    }

    const stored = await downloadRemoteMediaToStorage({
      workspaceId: message.workspaceId,
      url: source.url,
      headers: source.headers,
    })
    if (!stored.ok) return stored

    const updated = await WhatsAppMessageRepository.update(messageId, {
      mediaUrl: stored.value.url,
    })
    if (!updated.ok) return updated

    await publishWhatsAppEvent(message.workspaceId, {
      type: 'message.updated',
      conversationId: message.conversationId,
      message: toWhatsAppMessageDTO(updated.value),
    })

    return ok({ status: 'downloaded', url: stored.value.url })
  },
}
