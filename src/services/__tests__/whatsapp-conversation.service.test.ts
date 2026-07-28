import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppConnection } from '@/src/__tests__/factories/whatsapp-connection.factory'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { createFakeWhatsAppConversationWithPreview } from '@/src/__tests__/factories/whatsapp-conversation.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-connection.repository')
vi.mock('@/src/repositories/whatsapp-contact.repository')
vi.mock('@/src/repositories/whatsapp-conversation.repository')
vi.mock('@/src/lib/whatsapp/realtime', () => ({
  publishWhatsAppEvent: vi.fn(async () => undefined),
}))

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppConnectionRepository } from '@/src/repositories/whatsapp-connection.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WhatsAppConversationRepository } from '@/src/repositories/whatsapp-conversation.repository'
import { WhatsAppConversationService } from '../whatsapp-conversation.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedConnectionRepo = vi.mocked(WhatsAppConnectionRepository)
const mockedContactRepo = vi.mocked(WhatsAppContactRepository)
const mockedConversationRepo = vi.mocked(WhatsAppConversationRepository)

describe('WhatsAppConversationService', () => {
  describe('start()', () => {
    it('should create a new conversation when the contact has none active', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedConnectionRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppConnection({ id: 'conn1' })),
      )
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(null))
      const created = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        contactId: 'contact1',
        connectionId: 'conn1',
      })
      mockedConversationRepo.create.mockResolvedValue(ok(created))
      mockedConversationRepo.findById.mockResolvedValue(ok(created))

      const result = await WhatsAppConversationService.start('u1', 'ws1', {
        contactId: 'contact1',
        connectionId: 'conn1',
      })

      const dto = expectOk(result)
      expect(dto.id).toBe('conv1')
      expect(mockedConversationRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          contactId: 'contact1',
          connectionId: 'conn1',
          status: 'NEW',
        }),
      )
    })

    it('should reuse an already active conversation instead of creating a duplicate', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedConnectionRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppConnection({ id: 'conn1' })),
      )
      const existing = createFakeWhatsAppConversationWithPreview({
        id: 'conv-existing',
        contactId: 'contact1',
      })
      mockedConversationRepo.findActiveByContact.mockResolvedValue(ok(existing))
      mockedConversationRepo.findById.mockResolvedValue(ok(existing))

      const result = await WhatsAppConversationService.start('u1', 'ws1', {
        contactId: 'contact1',
        connectionId: 'conn1',
      })

      const dto = expectOk(result)
      expect(dto.id).toBe('conv-existing')
      expect(mockedConversationRepo.create).not.toHaveBeenCalled()
    })

    it('should return WHATSAPP_CONTACT_NOT_FOUND for an unknown contact', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppConversationService.start('u1', 'ws1', {
        contactId: 'unknown',
        connectionId: 'conn1',
      })

      expectErr(result, 'WHATSAPP_CONTACT_NOT_FOUND')
      expect(mockedConnectionRepo.findById).not.toHaveBeenCalled()
    })

    it('should return WHATSAPP_CONNECTION_NOT_FOUND for an unknown connection', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppContact({ id: 'contact1' })),
      )
      mockedConnectionRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppConversationService.start('u1', 'ws1', {
        contactId: 'contact1',
        connectionId: 'unknown',
      })

      expectErr(result, 'WHATSAPP_CONNECTION_NOT_FOUND')
      expect(mockedConversationRepo.create).not.toHaveBeenCalled()
    })
  })

  describe('markRead()', () => {
    it('should reset unreadCount and skip the update when already read', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        unreadCount: 0,
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.markRead(
        'u1',
        'ws1',
        'conv1',
      )

      expectOk(result)
      expect(mockedConversationRepo.update).not.toHaveBeenCalled()
    })

    it('should zero out unreadCount and persist when there are unread messages', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        unreadCount: 3,
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.markRead(
        'u1',
        'ws1',
        'conv1',
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        unreadCount: 0,
      })
    })
  })

  describe('removeFromAi()', () => {
    it('should deactivate the AI and set the handoff flag', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: true,
        aiHandoff: false,
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.removeFromAi(
        'u1',
        'ws1',
        'conv1',
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        aiActive: false,
        aiHandoff: true,
        status: 'IN_PROGRESS',
      })
    })

    it('should return WHATSAPP_CONVERSATION_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppConversationService.removeFromAi(
        'u1',
        'ws1',
        'conv1',
      )

      expectErr(result, 'WHATSAPP_CONVERSATION_NOT_FOUND')
    })
  })

  describe('resumeAi()', () => {
    it('should reactivate the AI and clear the handoff flag', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
        aiActive: false,
        aiHandoff: true,
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.resumeAi(
        'u1',
        'ws1',
        'conv1',
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        aiActive: true,
        aiHandoff: false,
      })
    })

    it('should return WHATSAPP_CONVERSATION_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppConversationService.resumeAi(
        'u1',
        'ws1',
        'conv1',
      )

      expectErr(result, 'WHATSAPP_CONVERSATION_NOT_FOUND')
    })
  })

  describe('assign()', () => {
    it('should assign the conversation to a valid workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace
        .mockResolvedValueOnce(ok(createFakeMembership({ role: 'MEMBER' })))
        .mockResolvedValueOnce(
          ok(createFakeMembership({ userId: 'u2', role: 'MEMBER' })),
        )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.assign(
        'u1',
        'ws1',
        'conv1',
        'u2',
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        assignedUserId: 'u2',
        status: 'IN_PROGRESS',
      })
    })

    it('should reject assigning to a user outside the workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace
        .mockResolvedValueOnce(ok(createFakeMembership({ role: 'MEMBER' })))
        .mockResolvedValueOnce(ok(null))
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.assign(
        'u1',
        'ws1',
        'conv1',
        'stranger',
      )

      expectErr(result, 'BAD_REQUEST')
      expect(mockedConversationRepo.update).not.toHaveBeenCalled()
    })

    it('should allow unassigning by passing null', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.assign(
        'u1',
        'ws1',
        'conv1',
        null,
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        assignedUserId: null,
        status: 'IN_PROGRESS',
      })
    })
  })

  describe('setPinned()', () => {
    it('should pin a conversation with a timestamp', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.setPinned(
        'u1',
        'ws1',
        'conv1',
        true,
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        pinnedAt: expect.any(Date),
      })
    })

    it('should unpin a conversation by clearing the timestamp', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.setPinned(
        'u1',
        'ws1',
        'conv1',
        false,
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        pinnedAt: null,
      })
    })

    it('should return WHATSAPP_CONVERSATION_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppConversationService.setPinned(
        'u1',
        'ws1',
        'conv1',
        true,
      )

      expectErr(result, 'WHATSAPP_CONVERSATION_NOT_FOUND')
      expect(mockedConversationRepo.update).not.toHaveBeenCalled()
    })
  })

  describe('setArchived()', () => {
    it('should archive a conversation with a timestamp', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.setArchived(
        'u1',
        'ws1',
        'conv1',
        true,
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        archivedAt: expect.any(Date),
      })
    })

    it('should unarchive a conversation by clearing the timestamp', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.setArchived(
        'u1',
        'ws1',
        'conv1',
        false,
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        archivedAt: null,
      })
    })
  })

  describe('remove()', () => {
    it('should soft-delete the conversation', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.remove(
        'u1',
        'ws1',
        'conv1',
      )

      const value = expectOk(result)
      expect(value).toEqual({ id: 'conv1' })
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        deletedAt: expect.any(Date),
      })
    })

    it('should return WHATSAPP_CONVERSATION_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedConversationRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppConversationService.remove(
        'u1',
        'ws1',
        'conv1',
      )

      expectErr(result, 'WHATSAPP_CONVERSATION_NOT_FOUND')
    })
  })

  describe('clear()', () => {
    it('should set a clearedAt cursor and reset lastMessageAt', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const conversation = createFakeWhatsAppConversationWithPreview({
        id: 'conv1',
      })
      mockedConversationRepo.findById.mockResolvedValue(ok(conversation))
      mockedConversationRepo.update.mockResolvedValue(ok(conversation))

      const result = await WhatsAppConversationService.clear(
        'u1',
        'ws1',
        'conv1',
      )

      expectOk(result)
      expect(mockedConversationRepo.update).toHaveBeenCalledWith('conv1', {
        clearedAt: expect.any(Date),
        lastMessageAt: null,
      })
    })
  })
})
