import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { createFakeCrmProposalTemplate } from '@/src/__tests__/factories/crm-proposal-template.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-proposal.repository')
vi.mock('@/src/repositories/crm-proposal-template.repository')

import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '@/src/repositories/crm-proposal.repository'
import { CrmProposalTemplateRepository } from '@/src/repositories/crm-proposal-template.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmProposalService } from '../crm-proposal.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProposalRepo = vi.mocked(CrmProposalRepository)
const mockedViewRepo = vi.mocked(CrmProposalViewRepository)
const mockedTemplateRepo = vi.mocked(CrmProposalTemplateRepository)

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
        ok({ id: 'm1' } as never),
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
        ok({ id: 'm1' } as never),
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
        ok({ id: 'm1' } as never),
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
        ok({ id: 'm1' } as never),
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
})
