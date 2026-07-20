import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppConversationWithPreview } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { createFakeWhatsAppMessage } from '@/src/__tests__/factories/whatsapp-message.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/src/repositories/whatsapp-conversation.repository')
vi.mock('@/src/repositories/whatsapp-message.repository')
vi.mock('@/src/lib/whatsapp/realtime', () => ({
  publishWhatsAppEvent: vi.fn(async () => undefined),
}))
vi.mock('@/src/lib/whatsapp/send', () => ({
  WhatsAppSend: {
    text: vi.fn(async () => ({
      ok: true,
      value: { providerMessageId: 'pm1' },
    })),
    media: vi.fn(async () => ({
      ok: true,
      value: { providerMessageId: 'pm2' },
    })),
    template: vi.fn(async () => ({
      ok: true,
      value: { providerMessageId: 'pm3' },
    })),
  },
}))

import { WhatsAppSend } from '@/src/lib/whatsapp/send'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppMessageRepository } from '@/src/repositories/whatsapp-message.repository'
import { WhatsAppMessageService } from '../whatsapp-message.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WhatsAppConnectionRepository)
const mockedConversationRepo = vi.mocked(WhatsAppConversationRepository)
const mockedMessageRepo = vi.mocked(WhatsAppMessageRepository)
const mockedSend = vi.mocked(WhatsAppSend)

function mockSendableConversation(overrides: { aiActive?: boolean } = {}) {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  const conversation = createFakeWhatsAppConversationWithPreview({
    id: 'conv1',
    workspaceId: 'ws1',
    connectionId: 'conn1',
    aiActive: overrides.aiActive ?? false,
  })
  const connection = createFakeWhatsAppConnection({
    id: 'conn1',
    workspaceId: 'ws1',
  })
  mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
  mockedConnectionRepo.findById.mockResolvedValue(ok(connection))
  return { conversation, connection }
}

describe('WhatsAppMessageService', () => {
  describe('sendText()', () => {
    it('should send the text message and persist it as OUT', async () => {
      mockSendableConversation()
      const created = createFakeWhatsAppMessage({
        direction: 'OUT',
        text: 'Olá!',
      })
      mockedMessageRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.update.mockResolvedValue(
        ok(createFakeWhatsAppConversationWithPreview()),
      )

      const result = await WhatsAppMessageService.sendText(
        'u1',
        'ws1',
        'conv1',
        { text: 'Olá!' },
      )

      const dto = expectOk(result)
      expect(dto.direction).toBe('OUT')
      expect(mockedSend.text).toHaveBeenCalled()
      expect(mockedMessageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          direction: 'OUT',
          type: 'TEXT',
          text: 'Olá!',
          senderUserId: 'u1',
          providerMessageId: 'pm1',
        }),
      )
    })

    it('should block sending while the AI is handling the conversation', async () => {
      mockSendableConversation({ aiActive: true })

      const result = await WhatsAppMessageService.sendText(
        'u1',
        'ws1',
        'conv1',
        { text: 'Olá!' },
      )

      expectErr(result, 'WHATSAPP_CONVERSATION_AI_HANDLING')
      expect(mockedSend.text).not.toHaveBeenCalled()
      expect(mockedMessageRepo.create).not.toHaveBeenCalled()
    })

    it('should not persist a message when the provider send fails', async () => {
      mockSendableConversation()
      mockedSend.text.mockResolvedValueOnce({
        ok: false,
        error: { code: 'WHATSAPP_PROVIDER_ERROR', message: 'timeout' },
      })

      const result = await WhatsAppMessageService.sendText(
        'u1',
        'ws1',
        'conv1',
        { text: 'Olá!' },
      )

      expectErr(result, 'WHATSAPP_PROVIDER_ERROR')
      expect(mockedMessageRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('sendMedia()', () => {
    it('should send media and persist it with the mediaUrl', async () => {
      mockSendableConversation()
      const created = createFakeWhatsAppMessage({
        direction: 'OUT',
        type: 'IMAGE',
        mediaUrl: 'https://minio.internal/whatsapp-media/img.jpg',
      })
      mockedMessageRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.update.mockResolvedValue(
        ok(createFakeWhatsAppConversationWithPreview()),
      )

      const result = await WhatsAppMessageService.sendMedia(
        'u1',
        'ws1',
        'conv1',
        {
          mediaUrl: 'https://minio.internal/whatsapp-media/img.jpg',
          type: 'IMAGE',
        },
      )

      const dto = expectOk(result)
      expect(dto.mediaUrl).toBe('https://minio.internal/whatsapp-media/img.jpg')
      expect(mockedSend.media).toHaveBeenCalled()
    })
  })

  describe('list()', () => {
    it('should return the conversation history', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppConversationWithPreview({ id: 'conv1' })),
      )
      mockedMessageRepo.listByConversation.mockResolvedValue(
        ok([createFakeWhatsAppMessage(), createFakeWhatsAppMessage()]),
      )

      const result = await WhatsAppMessageService.list('u1', 'ws1', 'conv1', {
        limit: 50,
      })

      const dtos = expectOk(result)
      expect(dtos).toHaveLength(2)
    })

    it('should return WHATSAPP_CONVERSATION_NOT_FOUND for an unknown conversation', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppMessageService.list('u1', 'ws1', 'conv1', {
        limit: 50,
      })

      expectErr(result, 'WHATSAPP_CONVERSATION_NOT_FOUND')
    })
  })
})
