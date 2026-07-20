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
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedQuickReplyRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectErr(result, 'WHATSAPP_QUICK_REPLY_NOT_FOUND')
    })

    it('should delete an existing quick reply', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const existing = createFakeWhatsAppQuickReply({ id: 'qr1' })
      mockedQuickReplyRepo.findById.mockResolvedValue(ok(existing))
      mockedQuickReplyRepo.delete.mockResolvedValue(ok(undefined))

      const result = await WhatsAppQuickReplyService.remove('u1', 'ws1', 'qr1')

      expectOk(result)
      expect(mockedQuickReplyRepo.delete).toHaveBeenCalledWith('qr1')
    })
  })
})
