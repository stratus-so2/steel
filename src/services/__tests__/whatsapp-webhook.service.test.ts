import { describe, expect, it, vi } from 'vitest'
import { createFakeWhatsAppAiConfig } from '@/src/__tests__/factories/whatsapp-ai-config.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { createFakeWhatsAppConversationWithPreview } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { createFakeWhatsAppMessage } from '@/src/__tests__/factories/whatsapp-message.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/whatsapp-ai-config.repository')
vi.mock('@/src/repositories/whatsapp-contact.repository')
vi.mock('@/src/repositories/whatsapp-conversation.repository')
vi.mock('@/src/repositories/whatsapp-message.repository')
vi.mock('@/src/lib/whatsapp/realtime', () => ({
  publishWhatsAppEvent: vi.fn(async () => undefined),
}))

const { mediaAdd, aiReplyAdd } = vi.hoisted(() => ({
  mediaAdd: vi.fn(async () => undefined),
  aiReplyAdd: vi.fn(async () => undefined),
}))
vi.mock('@/src/lib/queue/queues', () => ({
  getWhatsappMediaQueue: vi.fn(() => ({ add: mediaAdd })),
  getWhatsappAiReplyQueue: vi.fn(() => ({ add: aiReplyAdd })),
}))

import { WhatsAppAiConfigRepository } from '@/src/repositories/whatsapp-ai-config.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'
import { WhatsAppWebhookService } from '../whatsapp-webhook.service'

const mockedAiConfigRepo = vi.mocked(WhatsAppAiConfigRepository)
const mockedContactRepo = vi.mocked(WhatsAppContactRepository)
const mockedConversationRepo = vi.mocked(WhatsAppConversationRepository)
const mockedMessageRepo = vi.mocked(WhatsAppMessageRepository)

const connection = createFakeWhatsAppConnection({
  id: 'conn1',
  workspaceId: 'ws1',
})

function baseInbound(
  overrides: Partial<
    Parameters<typeof WhatsAppWebhookService.ingestInboundMessage>[0]
  > = {},
) {
  return {
    connection,
    waId: '5511988887777',
    contactName: 'Maria Silva',
    providerMessageId: 'pm-new',
    type: 'TEXT' as const,
    text: 'Olá!',
    ...overrides,
  }
}

describe('WhatsAppWebhookService', () => {
  describe('ingestInboundMessage()', () => {
    it('should be a no-op when the message was already ingested (dedupe)', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(
        ok(createFakeWhatsAppMessage({ providerMessageId: 'pm-new' })),
      )

      const result = await WhatsAppWebhookService.ingestInboundMessage(
        baseInbound(),
      )

      expectOk(result)
      expect(mockedContactRepo.upsertByWaId).not.toHaveBeenCalled()
    })

    it('should create a new conversation with AI active when the workspace AI config is active', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      const contact = createFakeWhatsAppContact({
        id: 'contact1',
        waId: '5511988887777',
      })
      mockedContactRepo.upsertByWaId.mockResolvedValue(ok(contact))
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(
        ok(createFakeWhatsAppAiConfig({ active: true })),
      )
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(null))
      const created = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        contactId: 'contact1',
        aiActive: true,
      })
      mockedConversationRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.findById.mockResolvedValue(ok(created))
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppMessage({ conversationId: 'conv1' })),
      )

      const result = await WhatsAppWebhookService.ingestInboundMessage(
        baseInbound(),
      )

      expectOk(result)
      expect(mockedConversationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ aiActive: true, status: 'NEW' }),
      )
      expect(aiReplyAdd).toHaveBeenCalledWith(
        'generate-ai-reply',
        expect.objectContaining({ conversationId: 'conv1' }),
      )
    })

    it('should not enqueue an AI reply when the workspace has no AI config', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      mockedContactRepo.upsertByWaId.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(null))
      const created = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: false,
      })
      mockedConversationRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.findById.mockResolvedValue(ok(created))
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppMessage()),
      )

      await WhatsAppWebhookService.ingestInboundMessage(baseInbound())

      expect(aiReplyAdd).not.toHaveBeenCalled()
    })

    it('should re-activate the AI on an existing conversation that was never explicitly handed off', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      mockedContactRepo.upsertByWaId.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(
        ok(createFakeWhatsAppAiConfig({ active: true })),
      )
      const existing = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: false,
        aiHandoff: false,
      })
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(existing))
      mockedConversationRepo.update.mockResolvedValue(ok(existing))
      mockedConversationRepo.findById.mockResolvedValue(ok(existing))
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppMessage()),
      )

      await WhatsAppWebhookService.ingestInboundMessage(baseInbound())

      expect(mockedConversationRepo.update).toHaveBeenCalledWith(
        'conv1',
        expect.objectContaining({ aiActive: true }),
      )
      expect(aiReplyAdd).toHaveBeenCalled()
    })

    it('should NOT re-activate the AI once a human has explicitly taken over (aiHandoff)', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      mockedContactRepo.upsertByWaId.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(
        ok(createFakeWhatsAppAiConfig({ active: true })),
      )
      const existing = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: false,
        aiHandoff: true,
      })
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(existing))
      mockedConversationRepo.update.mockResolvedValue(ok(existing))
      mockedConversationRepo.findById.mockResolvedValue(ok(existing))
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppMessage()),
      )

      await WhatsAppWebhookService.ingestInboundMessage(baseInbound())

      expect(mockedConversationRepo.update).toHaveBeenCalledWith(
        'conv1',
        expect.objectContaining({ aiActive: false }),
      )
      expect(aiReplyAdd).not.toHaveBeenCalled()
    })

    it('should enqueue a media download job for messages with a raw media reference', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      mockedContactRepo.upsertByWaId.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedAiConfigRepo.findByWorkspace.mockResolvedValue(ok(null))
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(null))
      const created = createFakeWhatsAppConversationWithPreview({ id: 'conv1' })
      mockedConversationRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.findById.mockResolvedValue(ok(created))
      const message = createFakeWhatsAppMessage({
        id: 'msg1',
        type: 'IMAGE',
        mediaUrl: 'raw-provider-url',
      })
      mockedMessageRepo.create.mockResolvedValue(ok(message))

      await WhatsAppWebhookService.ingestInboundMessage(
        baseInbound({ type: 'IMAGE', rawMediaUrl: 'raw-provider-url' }),
      )

      expect(mediaAdd).toHaveBeenCalledWith(
        'download-inbound-media',
        expect.objectContaining({ messageId: 'msg1' }),
      )
    })
  })

  describe('ingestOutboundDeviceMessage()', () => {
    it('should be a no-op when the message was already ingested (dedupe)', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(
        ok(createFakeWhatsAppMessage({ providerMessageId: 'pm-new' })),
      )

      const result = await WhatsAppWebhookService.ingestOutboundDeviceMessage(
        baseInbound(),
      )

      expectOk(result)
      expect(mockedContactRepo.upsertByWaId).not.toHaveBeenCalled()
    })

    it('should persist the message as OUT and hand off from AI on an existing conversation', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      mockedContactRepo.upsertByWaId.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      const existing = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: true,
        aiHandoff: false,
      })
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(existing))
      mockedConversationRepo.update.mockResolvedValue(ok(existing))
      mockedConversationRepo.findById.mockResolvedValue(ok(existing))
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppMessage({ conversationId: 'conv1' })),
      )

      await WhatsAppWebhookService.ingestOutboundDeviceMessage(baseInbound())

      expect(mockedConversationRepo.update).toHaveBeenCalledWith(
        'conv1',
        expect.objectContaining({ aiActive: false, aiHandoff: true }),
      )
      expect(mockedMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ direction: 'OUT', status: 'SENT' }),
      )
      expect(aiReplyAdd).not.toHaveBeenCalled()
    })

    it('should create a new conversation already handed off when none exists', async () => {
      mockedMessageRepo.findByProviderMessageId.mockResolvedValue(ok(null))
      mockedContactRepo.upsertByWaId.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(null))
      const created = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: false,
        aiHandoff: true,
      })
      mockedConversationRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.findById.mockResolvedValue(ok(created))
      mockedMessageRepo.create.mockResolvedValue(
        ok(createFakeWhatsAppMessage({ conversationId: 'conv1' })),
      )

      await WhatsAppWebhookService.ingestOutboundDeviceMessage(baseInbound())

      expect(mockedConversationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          aiActive: false,
          aiHandoff: true,
          unreadCount: 0,
        }),
      )
    })
  })

  describe('ingestInboundReaction()', () => {
    it('should be a no-op when the message is unknown', async () => {
      mockedMessageRepo.updateReactionByProviderMessageId.mockResolvedValue(
        ok(null),
      )

      const result = await WhatsAppWebhookService.ingestInboundReaction({
        providerMessageId: 'unknown',
        emoji: '👍',
      })

      expectOk(result)
    })

    it('should persist the reaction as coming from the contact', async () => {
      const updated = createFakeWhatsAppMessage({
        reactionEmoji: '👍',
        reactedByContact: true,
      })
      mockedMessageRepo.updateReactionByProviderMessageId.mockResolvedValue(
        ok(updated),
      )

      const result = await WhatsAppWebhookService.ingestInboundReaction({
        providerMessageId: updated.providerMessageId ?? '',
        emoji: '👍',
      })

      expectOk(result)
      expect(
        mockedMessageRepo.updateReactionByProviderMessageId,
      ).toHaveBeenCalledWith(updated.providerMessageId, {
        emoji: '👍',
        reactedByContact: true,
      })
    })
  })

  describe('ingestStatusUpdate()', () => {
    it('should be a no-op when the message is unknown', async () => {
      mockedMessageRepo.updateStatusByProviderMessageId.mockResolvedValue(
        ok(null),
      )

      const result = await WhatsAppWebhookService.ingestStatusUpdate({
        providerMessageId: 'unknown',
        status: 'DELIVERED',
      })

      expectOk(result)
    })

    it('should update the message status when found', async () => {
      const updated = createFakeWhatsAppMessage({ status: 'READ' })
      mockedMessageRepo.updateStatusByProviderMessageId.mockResolvedValue(
        ok(updated),
      )

      const result = await WhatsAppWebhookService.ingestStatusUpdate({
        providerMessageId: updated.providerMessageId ?? '',
        status: 'READ',
      })

      expectOk(result)
    })
  })
})
