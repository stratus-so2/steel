import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmProposal } from '@/src/__tests__/factories/crm-proposal.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-proposal.repository')

import {
  CrmProposalRepository,
  CrmProposalViewRepository,
} from '@/src/repositories/crm-proposal.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmProposalService } from '../crm-proposal.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedProposalRepo = vi.mocked(CrmProposalRepository)
const mockedViewRepo = vi.mocked(CrmProposalViewRepository)

describe('CrmProposalService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmProposalService.list('u1', 'ws1'), 'FORBIDDEN')
    })
  })

  describe('getPublicByShareToken()', () => {
    it('should return the public shape without auth', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(createFakeCrmProposal({ id: 'p1', shareToken: 'tok' })),
      )

      const dto = expectOk(
        await CrmProposalService.getPublicByShareToken('tok'),
      )
      expect(dto.id).toBe('p1')
      expect(dto).not.toHaveProperty('shareToken')
    })
  })

  describe('recordView()', () => {
    it('should hash the ip before recording', async () => {
      mockedProposalRepo.findByShareToken.mockResolvedValue(
        ok(createFakeCrmProposal({ id: 'p1', shareToken: 'tok' })),
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
