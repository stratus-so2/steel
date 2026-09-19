import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppQuickReply } from '@/src/__tests__/factories/whatsapp-quick-reply.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-quick-reply.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppQuickReplyRepository } from '@/src/repositories/whatsapp-quick-reply.repository'
import { WhatsAppQuickReplyService } from '../whatsapp-quick-reply.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedQuickReplyRepo = vi.mocked(WhatsAppQuickReplyRepository)

describe('WhatsAppQuickReplyService', () => {
  describe('create()', () => {
    it('should create a quick reply for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const created = createFakeWhatsAppQuickReply({ shortcut: 'saudacao' })
      mockedQuickReplyRepo.create.mockResolvedValue(ok(created))

      const result = await WhatsAppQuickReplyService.create('u1', 'ws1', {
        shortcut: 'saudacao',
        title: 'Saudação',
        body: 'Olá!',
      })

      const dto = expectOk(result)
      expect(dto.shortcut).toBe('saudacao')
    })

    it('should propagate a conflict for a duplicate shortcut', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedQuickReplyRepo.create.mockResolvedValue(
        err({
          code: 'WHATSAPP_QUICK_REPLY_CONFLICT',
          message: 'já existe',
        }),
      )

      const result = await WhatsAppQuickReplyService.create('u1', 'ws1', {
        shortcut: 'saudacao',
        title: 'Saudação',
        body: 'Olá!',
      })

      expectErr(result, 'WHATSAPP_QUICK_REPLY_CONFLICT')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.create('u1', 'ws1', {
        shortcut: 'saudacao',
        title: 'Saudação',
        body: 'Olá!',
      })

      expectErr(result, 'FORBIDDEN')
    })
  })

  describe('remove()', () => {
    it('should return WHATSAPP_QUICK_REPLY_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectErr(result, 'WHATSAPP_QUICK_REPLY_NOT_FOUND')
    })

    it('should delete an existing quick reply', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      const existing = createFakeWhatsAppQuickReply({ id: 'qr1' })
      mockedQuickReplyRepo.findById.mockResolvedValue(ok(existing))
      mockedQuickReplyRepo.delete.mockResolvedValue(ok(undefined))

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectOk(result)
      expect(mockedQuickReplyRepo.delete).toHaveBeenCalledWith('qr1')
    })
  })

  describe('list()', () => {
    it('should list the workspace quick replies as DTOs', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedQuickReplyRepo.listByWorkspace.mockResolvedValue(
        ok([
          createFakeWhatsAppQuickReply({ shortcut: 'oi' }),
          createFakeWhatsAppQuickReply({ shortcut: 'tchau' }),
        ]),
      )

      const result = await WhatsAppQuickReplyService.list('u1', 'ws1')

      expect(expectOk(result).map((r) => r.shortcut)).toEqual(['oi', 'tchau'])
      expect(mockedQuickReplyRepo.listByWorkspace).toHaveBeenCalledWith('ws1')
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.list('u1', 'ws1')

      expectErr(result, 'FORBIDDEN')
      expect(mockedQuickReplyRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should propagate a repository failure', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedQuickReplyRepo.listByWorkspace.mockResolvedValue(
        err({ code: 'DATABASE_ERROR', message: 'db down' }),
      )

      const result = await WhatsAppQuickReplyService.list('u1', 'ws1')

      expectErr(result, 'DATABASE_ERROR')
    })
  })

  describe('update()', () => {
    const dto = { title: 'Novo título', body: 'Novo corpo' }

    it('should update an existing quick reply', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppQuickReply({ id: 'qr1' })),
      )
      mockedQuickReplyRepo.update.mockResolvedValue(
        ok(createFakeWhatsAppQuickReply({ id: 'qr1', title: 'Novo título' })),
      )

      const result = await WhatsAppQuickReplyService.update(
        'u1',
        'ws1',
        'qr1',
        dto,
      )

      expect(expectOk(result).title).toBe('Novo título')
      expect(mockedQuickReplyRepo.findById).toHaveBeenCalledWith('qr1', 'ws1')
      expect(mockedQuickReplyRepo.update).toHaveBeenCalledWith('qr1', dto)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.update(
        'u1',
        'ws1',
        'qr1',
        dto,
      )

      expectErr(result, 'FORBIDDEN')
    })

    it('should return WHATSAPP_QUICK_REPLY_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.update(
        'u1',
        'ws1',
        'qr1',
        dto,
      )

      expectErr(result, 'WHATSAPP_QUICK_REPLY_NOT_FOUND')
      expect(mockedQuickReplyRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate a lookup failure', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(
        err({ code: 'DATABASE_ERROR', message: 'db down' }),
      )

      const result = await WhatsAppQuickReplyService.update(
        'u1',
        'ws1',
        'qr1',
        dto,
      )

      expectErr(result, 'DATABASE_ERROR')
    })

    it('should propagate an update failure', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppQuickReply({ id: 'qr1' })),
      )
      mockedQuickReplyRepo.update.mockResolvedValue(
        err({ code: 'WHATSAPP_QUICK_REPLY_CONFLICT', message: 'já existe' }),
      )

      const result = await WhatsAppQuickReplyService.update(
        'u1',
        'ws1',
        'qr1',
        dto,
      )

      expectErr(result, 'WHATSAPP_QUICK_REPLY_CONFLICT')
    })
  })

  describe('remove() failures', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectErr(result, 'FORBIDDEN')
    })

    it('should propagate a lookup failure', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(
        err({ code: 'DATABASE_ERROR', message: 'db down' }),
      )

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectErr(result, 'DATABASE_ERROR')
    })

    it('should propagate a delete failure', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(
        ok(createFakeWhatsAppQuickReply({ id: 'qr1' })),
      )
      mockedQuickReplyRepo.delete.mockResolvedValue(
        err({ code: 'DATABASE_ERROR', message: 'db down' }),
      )

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectErr(result, 'DATABASE_ERROR')
    })
  })
})
