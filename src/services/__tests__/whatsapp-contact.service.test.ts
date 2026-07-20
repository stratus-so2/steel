import { describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWhatsAppContact } from '@/src/__tests__/factories/whatsapp-contact.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/whatsapp-contact.repository')

import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WhatsAppContactRepository } from '@/src/repositories/whatsapp-contact.repository'
import { WhatsAppContactService } from '../whatsapp-contact.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedContactRepo = vi.mocked(WhatsAppContactRepository)

describe('WhatsAppContactService', () => {
  describe('list()', () => {
    it('should return contacts for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeWhatsAppContact({ workspaceId: 'ws1' })]),
      )

      const result = await WhatsAppContactService.list('u1', 'ws1', {})

      const dtos = expectOk(result)
      expect(dtos).toHaveLength(1)
      expect(mockedContactRepo.listByWorkspace).toHaveBeenCalledWith(
        'ws1',
        undefined,
      )
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await WhatsAppContactService.list('u1', 'ws1', {})

      expectErr(result, 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should create a contact for any member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const created = createFakeWhatsAppContact({
        workspaceId: 'ws1',
        waId: '5511988887777',
      })
      mockedContactRepo.create.mockResolvedValue(ok(created))

      const result = await WhatsAppContactService.create('u1', 'ws1', {
        waId: '5511988887777',
      })

      const dto = expectOk(result)
      expect(dto.waId).toBe('5511988887777')
    })

    it('should propagate a conflict when the contact already exists', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.create.mockResolvedValue(
        err({ code: 'CONFLICT', message: 'Este contato já existe' }),
      )

      const result = await WhatsAppContactService.create('u1', 'ws1', {
        waId: '5511988887777',
      })

      expectErr(result, 'CONFLICT')
    })
  })

  describe('remove()', () => {
    it('should delete an existing contact', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const existing = createFakeWhatsAppContact({ id: 'ct1' })
      mockedContactRepo.findById.mockResolvedValue(ok(existing))
      mockedContactRepo.delete.mockResolvedValue(ok(undefined))

      const result = await WhatsAppContactService.remove('u1', 'ws1', 'ct1')

      expectOk(result)
      expect(mockedContactRepo.delete).toHaveBeenCalledWith('ct1')
    })

    it('should return WHATSAPP_CONTACT_NOT_FOUND when missing', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedContactRepo.findById.mockResolvedValue(ok(null))

      const result = await WhatsAppContactService.remove('u1', 'ws1', 'ct1')

      expectErr(result, 'WHATSAPP_CONTACT_NOT_FOUND')
    })

    it('should propagate a database error', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const existing = createFakeWhatsAppContact({ id: 'ct1' })
      mockedContactRepo.findById.mockResolvedValue(ok(existing))
      mockedContactRepo.delete.mockResolvedValue(err(databaseError()))

      const result = await WhatsAppContactService.remove('u1', 'ws1', 'ct1')

      expectErr(result, 'DATABASE_ERROR')
    })
  })
})
