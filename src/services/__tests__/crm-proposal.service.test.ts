import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { createFakeCrmProposalTemplate } from '@/src/__tests__/factories/crm-proposal-template.factory'
import { createFakeCrmSettings } from '@/src/__tests__/factories/crm-settings.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-proposal.repository')
vi.mock('@/src/repositories/crm-proposal-template.repository')
vi.mock('@/src/repositories/crm-settings.repository')
vi.mock('@/src/lib/mail/crm/send-proposal-expired')

import { sendCrmProposalExpiredEmail } from '@/src/lib/mail/crm/send-proposal-expired'
import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '@/src/repositories/crm-proposal.repository'
import { CrmProposalTemplateRepository } from '@/src/repositories/crm-proposal-template.repository'
import { CrmSettingsRepository } from '@/src/repositories/crm-settings.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmProposalService } from '../crm-proposal.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProposalRepo = vi.mocked(CrmProposalRepository)
const mockedViewRepo = vi.mocked(CrmProposalViewRepository)
const mockedTemplateRepo = vi.mocked(CrmProposalTemplateRepository)
const mockedSettingsRepo = vi.mocked(CrmSettingsRepository)
const mockedSendExpired = vi.mocked(sendCrmProposalExpiredEmail)

const DAY_MS = 86_400_000
const PAST = new Date('2026-01-10T15:00:00.000Z')
const future = () => new Date(Date.now() + 10 * DAY_MS)

function mockRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

beforeEach(() => {
  mockedSettingsRepo.findByWorkspace.mockResolvedValue(ok(null))
})

const fakeProposalWithSections = (
  overrides?: Parameters<typeof createFakeCrmProposal>[0],
) => ({
  ...createFakeCrmProposal(overrides),
  sections: [],
})

describe('CrmProposalService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmProposalService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('create()', () => {
    it('should create a proposal with the given sections', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedProposalRepo.create.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1', name: 'Proposta X' })),
      )

      expectOk(
        await CrmProposalService.create('u1', 'ws1', {
          name: 'Proposta X',
          responsibleId: 'u1',
          sections: [
            {
              type: 'COVER',
              order: 0,
              enabled: true,
              content: { type: 'COVER', title: 'Proposta X' },
            },
          ],
        }),
      )
      expect(mockedProposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Proposta X' }),
      )
    })

    it('should copy enabled template sections when no sections are given', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedTemplateRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmProposalTemplate({ id: 't1', workspaceId: 'ws1' }),
          sections: [
            {
              id: 'ts1',
              templateId: 't1',
              type: 'TERMS_CONDITIONS' as const,
              order: 0,
              enabled: true,
              defaultContent: {
                type: 'TERMS_CONDITIONS',
                text: 'Termos padrão',
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ],
        }),
      )
      mockedProposalRepo.create.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1', name: 'Proposta X' })),
      )

      expectOk(
        await CrmProposalService.create('u1', 'ws1', {
          name: 'Proposta X',
          responsibleId: 'u1',
          templateId: 't1',
          sections: [],
        }),
      )
      expect(mockedProposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sections: [
            expect.objectContaining({
              type: 'TERMS_CONDITIONS',
              content: { type: 'TERMS_CONDITIONS', text: 'Termos padrão' },
            }),
          ],
        }),
      )
    })
  })

  describe('update()', () => {
    it('should replace sections when provided', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const existing = fakeProposalWithSections({ id: 'p1' })
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedProposalRepo.update.mockResolvedValue(ok(existing))

      expectOk(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          sections: [
            {
              type: 'COVER',
              order: 0,
              enabled: true,
              content: { type: 'COVER', title: 'V2' },
            },
          ],
        }),
      )
      expect(mockedProposalRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({
          sections: [expect.objectContaining({ type: 'COVER' })],
        }),
      )
    })
  })

  describe('send()', () => {
    it('should transition status to SENT', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const existing = fakeProposalWithSections({ id: 'p1', status: 'DRAFT' })
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedProposalRepo.setStatus.mockResolvedValue(
        ok({ ...existing, status: 'SENT' }),
      )

      const dto = expectOk(await CrmProposalService.send('u1', 'ws1', 'p1'))
      expect(dto.status).toBe('SENT')
      expect(mockedProposalRepo.setStatus).toHaveBeenCalledWith('p1', 'SENT')
    })
  })

  describe('getPublicByShareToken()', () => {
    it('should return the public shape without auth', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(
          fakeProposalWithSections({
            id: 'p1',
            shareToken: 'tok',
            status: 'SENT',
          }),
        ),
      )
      mockedProposalRepo.setStatus.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1', status: 'VIEWED' })),
      )

      const dto = expectOk(
        await CrmProposalService.getPublicByShareToken('tok'),
      )
      expect(dto.id).toBe('p1')
      expect(dto).not.toHaveProperty('shareToken')
    })

    it('should mark a SENT proposal as VIEWED on first public view', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1', status: 'SENT' })),
      )
      mockedProposalRepo.setStatus.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1', status: 'VIEWED' })),
      )

      await CrmProposalService.getPublicByShareToken('tok')
      expect(mockedProposalRepo.setStatus).toHaveBeenCalledWith('p1', 'VIEWED')
    })
  })

  describe('recordView()', () => {
    it('should hash the ip before recording', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1', shareToken: 'tok' })),
      )
      mockedViewRepo.record.mockResolvedValue(
        ok({
          id: 'v1',
          proposalId: 'p1',
          viewId: 'view1',
          ipHash: 'hashed',
          durationMs: 0,
          reachedEnd: false,
          scrolledPct: 0,
          referrer: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      )

      expectOk(
        await CrmProposalService.recordView('tok', '1.2.3.4', {
          viewId: 'view1',
          durationMs: 0,
          reachedEnd: false,
          scrolledPct: 0,
        }),
      )
      expect(mockedViewRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          ipHash: expect.not.stringContaining('1.2.3.4'),
        }),
      )
    })
  })

  describe('validity on create()', () => {
    it('should default validUntil to today + the workspace validity days', async () => {
      mockRole('MEMBER')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(
        ok(createFakeCrmSettings({ proposalValidityDays: 7 })),
      )
      mockedProposalRepo.create.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1' })),
      )

      expectOk(
        await CrmProposalService.create('u1', 'ws1', {
          name: 'Proposta X',
          responsibleId: 'u1',
          sections: [],
        }),
      )

      const validUntil = mockedProposalRepo.create.mock.calls[0]?.[0]
        .validUntil as Date
      const days = (validUntil.getTime() - Date.now()) / DAY_MS
      expect(days).toBeGreaterThan(6)
      expect(days).toBeLessThanOrEqual(8)
    })

    it('should keep an explicit validUntil', async () => {
      mockRole('MEMBER')
      const explicit = future()
      mockedProposalRepo.create.mockResolvedValue(
        ok(fakeProposalWithSections({ id: 'p1' })),
      )

      expectOk(
        await CrmProposalService.create('u1', 'ws1', {
          name: 'Proposta X',
          responsibleId: 'u1',
          validUntil: explicit,
          sections: [],
        }),
      )
      expect(mockedProposalRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ validUntil: explicit }),
      )
    })
  })

  describe('validity on update()', () => {
    it('should block marking an expired proposal as accepted', async () => {
      mockRole('ADMIN')
      mockedProposalRepo.findById.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'SENT', validUntil: PAST })),
      )

      expectErr(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          status: 'ACCEPTED',
        }),
        'CRM_PROPOSAL_EXPIRED',
      )
      expect(mockedProposalRepo.update).not.toHaveBeenCalled()
    })

    it('should keep autosaving an overdue proposal when validity is untouched', async () => {
      mockRole('MEMBER')
      const existing = fakeProposalWithSections({
        status: 'SENT',
        validUntil: PAST,
      })
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedProposalRepo.update.mockResolvedValue(ok(existing))

      expectOk(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          name: 'Renomeada',
          validUntil: new Date(PAST),
        }),
      )
    })

    it('should only let an admin change the validity of an expired proposal', async () => {
      mockRole('MEMBER')
      mockedProposalRepo.findById.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'EXPIRED', validUntil: PAST })),
      )

      expectErr(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          validUntil: future(),
        }),
        'FORBIDDEN',
      )
    })

    it('should reopen an expired proposal when an admin moves the validity forward', async () => {
      mockRole('OWNER')
      const existing = fakeProposalWithSections({
        status: 'EXPIRED',
        validUntil: PAST,
      })
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedViewRepo.countByProposal.mockResolvedValue(ok(0))
      mockedProposalRepo.update.mockResolvedValue(
        ok({ ...existing, status: 'SENT' }),
      )

      expectOk(
        await CrmProposalService.update('u1', 'ws1', 'p1', {
          validUntil: future(),
        }),
      )
      expect(mockedProposalRepo.update).toHaveBeenCalledWith(
        'p1',
        expect.objectContaining({ status: 'SENT', expiredAt: null }),
      )
    })
  })

  describe('validity on send()', () => {
    it('should refuse to send a proposal whose validity already passed', async () => {
      mockRole('MEMBER')
      mockedProposalRepo.findById.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'DRAFT', validUntil: PAST })),
      )

      expectErr(
        await CrmProposalService.send('u1', 'ws1', 'p1'),
        'CRM_PROPOSAL_EXPIRED',
      )
      expect(mockedProposalRepo.setStatus).not.toHaveBeenCalled()
    })
  })

  describe('extendValidity()', () => {
    it('should restore an expired, already viewed proposal to VIEWED', async () => {
      mockRole('ADMIN')
      const existing = fakeProposalWithSections({
        id: 'p1',
        status: 'EXPIRED',
        validUntil: PAST,
        expiredAt: new Date(),
      })
      const next = future()
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedViewRepo.countByProposal.mockResolvedValue(ok(3))
      mockedProposalRepo.update.mockResolvedValue(
        ok({
          ...existing,
          status: 'VIEWED',
          validUntil: next,
          expiredAt: null,
        }),
      )

      const dto = expectOk(
        await CrmProposalService.extendValidity('u1', 'ws1', 'p1', {
          validUntil: next,
        }),
      )

      expect(dto.status).toBe('VIEWED')
      expect(dto.isExpired).toBe(false)
      expect(mockedProposalRepo.update).toHaveBeenCalledWith('p1', {
        validUntil: next,
        status: 'VIEWED',
        expiredAt: null,
        updatedById: 'u1',
      })
    })

    it('should only extend (no status change) a proposal that is still open', async () => {
      mockRole('ADMIN')
      const existing = fakeProposalWithSections({
        id: 'p1',
        status: 'SENT',
        validUntil: future(),
      })
      const next = new Date(Date.now() + 40 * DAY_MS)
      mockedProposalRepo.findById.mockResolvedValue(ok(existing))
      mockedProposalRepo.update.mockResolvedValue(
        ok({ ...existing, validUntil: next }),
      )

      expectOk(
        await CrmProposalService.extendValidity('u1', 'ws1', 'p1', {
          validUntil: next,
        }),
      )
      expect(mockedProposalRepo.update).toHaveBeenCalledWith('p1', {
        validUntil: next,
        updatedById: 'u1',
      })
    })

    it('should require a future date', async () => {
      mockRole('ADMIN')
      mockedProposalRepo.findById.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'EXPIRED', validUntil: PAST })),
      )

      expectErr(
        await CrmProposalService.extendValidity('u1', 'ws1', 'p1', {
          validUntil: new Date('2026-01-20T12:00:00.000Z'),
        }),
        'VALIDATION_ERROR',
      )
    })

    it('should refuse proposals already answered by the client', async () => {
      mockRole('ADMIN')
      mockedProposalRepo.findById.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'ACCEPTED' })),
      )

      expectErr(
        await CrmProposalService.extendValidity('u1', 'ws1', 'p1', {
          validUntil: future(),
        }),
        'CONFLICT',
      )
    })

    it('should be restricted to OWNER/ADMIN', async () => {
      mockRole('MEMBER')

      expectErr(
        await CrmProposalService.extendValidity('u1', 'ws1', 'p1', {
          validUntil: future(),
        }),
        'FORBIDDEN',
      )
      expect(mockedProposalRepo.findById).not.toHaveBeenCalled()
    })
  })

  describe('accept()', () => {
    it('should record the acceptance of a proposal within its validity', async () => {
      const existing = fakeProposalWithSections({
        id: 'p1',
        status: 'VIEWED',
        validUntil: future(),
      })
      mockedProposalRepo.findByShareToken
        .mockResolvedValueOnce(ok(existing))
        .mockResolvedValueOnce(
          ok({
            ...existing,
            status: 'ACCEPTED',
            acceptedAt: new Date(),
            acceptedByName: 'Maria',
          }),
        )
      mockedProposalRepo.accept.mockResolvedValue(ok(true))

      const dto = expectOk(
        await CrmProposalService.accept('tok', '1.2.3.4', { name: 'Maria' }),
      )

      expect(dto.status).toBe('ACCEPTED')
      expect(dto.acceptedByName).toBe('Maria')
      expect(mockedProposalRepo.accept).toHaveBeenCalledWith('p1', {
        name: 'Maria',
        at: expect.any(Date),
      })
    })

    it('should block acceptance after expiry with a clear message', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(
          fakeProposalWithSections({
            status: 'SENT',
            validUntil: new Date('2026-01-10T15:00:00.000Z'),
          }),
        ),
      )

      const error = expectErr(
        await CrmProposalService.accept('tok', '1.2.3.4', { name: 'Maria' }),
        'CRM_PROPOSAL_EXPIRED',
      )
      expect(error.message).toContain('10/01/2026')
      expect(mockedProposalRepo.accept).not.toHaveBeenCalled()
    })

    it('should refuse an already accepted proposal', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'ACCEPTED' })),
      )

      expectErr(
        await CrmProposalService.accept('tok', '1.2.3.4', { name: 'Maria' }),
        'CRM_PROPOSAL_NOT_ACCEPTABLE',
      )
    })

    it('should refuse when another request changed the status first', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(fakeProposalWithSections({ status: 'SENT', validUntil: null })),
      )
      mockedProposalRepo.accept.mockResolvedValue(ok(false))

      expectErr(
        await CrmProposalService.accept('tok', '1.2.3.4', { name: 'Maria' }),
        'CRM_PROPOSAL_NOT_ACCEPTABLE',
      )
    })
  })

  describe('expireDue()', () => {
    function candidate(
      overrides: Partial<ReturnType<typeof createFakeCrmProposal>> = {},
    ) {
      return {
        ...createFakeCrmProposal({
          status: 'SENT',
          validUntil: PAST,
          workspaceId: 'ws1',
          ...overrides,
        }),
        responsible: { id: 'u1', name: 'Ana', email: 'ana@acme.com' },
        workspace: { id: 'ws1', name: 'Acme', slug: 'acme' },
      }
    }

    it('should expire overdue proposals and notify the responsible', async () => {
      mockedProposalRepo.listExpirationCandidates.mockResolvedValue(
        ok([candidate({ id: 'p1', name: 'Proposta ERP' })]),
      )
      mockedProposalRepo.markExpired.mockResolvedValue(ok(true))

      const result = expectOk(await CrmProposalService.expireDue())

      expect(result).toEqual({ candidates: 1, expired: 1, notified: 1 })
      expect(mockedProposalRepo.markExpired).toHaveBeenCalledWith(
        'p1',
        expect.any(Date),
      )
      expect(mockedSendExpired).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'ana@acme.com',
          proposalName: 'Proposta ERP',
          proposalUrl: expect.stringContaining('/acme/crm/proposals/p1'),
        }),
      )
    })

    it('should not notify when the workspace turned the e-mail off', async () => {
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(
        ok(createFakeCrmSettings({ notifyProposalExpiry: false })),
      )
      mockedProposalRepo.listExpirationCandidates.mockResolvedValue(
        ok([candidate({ id: 'p1' })]),
      )
      mockedProposalRepo.markExpired.mockResolvedValue(ok(true))

      const result = expectOk(await CrmProposalService.expireDue())

      expect(result.expired).toBe(1)
      expect(result.notified).toBe(0)
      expect(mockedSendExpired).not.toHaveBeenCalled()
    })

    it('should keep a proposal valid until the end of its last day', async () => {
      const now = new Date('2026-10-10T20:00:00.000Z') // 17:00 em São Paulo
      mockedProposalRepo.listExpirationCandidates.mockResolvedValue(
        ok([
          candidate({
            id: 'p1',
            validUntil: new Date('2026-10-10T15:00:00.000Z'),
          }),
        ]),
      )

      const result = expectOk(await CrmProposalService.expireDue(now))

      expect(result).toEqual({ candidates: 1, expired: 0, notified: 0 })
      expect(mockedProposalRepo.markExpired).not.toHaveBeenCalled()
    })

    it('should not notify twice when the proposal was already handled', async () => {
      mockedProposalRepo.listExpirationCandidates.mockResolvedValue(
        ok([candidate({ id: 'p1' })]),
      )
      mockedProposalRepo.markExpired.mockResolvedValue(ok(false))

      const result = expectOk(await CrmProposalService.expireDue())
      expect(result).toEqual({ candidates: 1, expired: 0, notified: 0 })
      expect(mockedSendExpired).not.toHaveBeenCalled()
    })

    it('should keep going when the e-mail fails', async () => {
      mockedProposalRepo.listExpirationCandidates.mockResolvedValue(
        ok([candidate({ id: 'p1' }), candidate({ id: 'p2' })]),
      )
      mockedProposalRepo.markExpired.mockResolvedValue(ok(true))
      mockedSendExpired
        .mockRejectedValueOnce(new Error('resend down'))
        .mockResolvedValueOnce({ id: 'mail' })

      const result = expectOk(await CrmProposalService.expireDue())
      expect(result).toEqual({ candidates: 2, expired: 2, notified: 1 })
    })
  })
})
