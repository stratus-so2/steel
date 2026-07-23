import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmScheduledPost,
  createFakeCrmScheduledPostTarget,
} from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-social.repository')

import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
} from '@/src/repositories/crm-social.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmScheduledPostService } from '../crm-social.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPostRepo = vi.mocked(CrmScheduledPostRepository)
const mockedTargetRepo = vi.mocked(CrmScheduledPostTargetRepository)

describe('CrmScheduledPostService', () => {
  describe('publish()', () => {
    it('should mark the post FAILED since no real publisher is configured', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const target = createFakeCrmScheduledPostTarget({
        id: 't1',
        platform: 'INSTAGRAM',
      })
      mockedPostRepo.findById
        .mockResolvedValueOnce(
          ok({
            ...createFakeCrmScheduledPost({ id: 'p1', status: 'SCHEDULED' }),
            targets: [target],
          }),
        )
        .mockResolvedValueOnce(
          ok({
            ...createFakeCrmScheduledPost({ id: 'p1', status: 'FAILED' }),
            targets: [{ ...target, status: 'FAILED' }],
          }),
        )
      mockedTargetRepo.setStatus.mockResolvedValue(ok(target))
      mockedPostRepo.setStatus.mockResolvedValue(
        ok(createFakeCrmScheduledPost({ id: 'p1', status: 'FAILED' })),
      )

      const result = expectOk(
        await CrmScheduledPostService.publish('u1', 'ws1', 'p1'),
      )
      expect(mockedTargetRepo.setStatus).toHaveBeenCalledWith(
        't1',
        'FAILED',
        expect.objectContaining({ error: expect.any(String) }),
      )
      expect(mockedPostRepo.setStatus).toHaveBeenCalledWith(
        'p1',
        'FAILED',
        undefined,
      )
      expect(result.status).toBe('FAILED')
    })

    it('should return CRM_SCHEDULED_POST_ALREADY_PUBLISHED for a published post', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedPostRepo.findById.mockResolvedValue(
        ok({
          ...createFakeCrmScheduledPost({ id: 'p1', status: 'PUBLISHED' }),
          targets: [],
        }),
      )

      expectErr(
        await CrmScheduledPostService.publish('u1', 'ws1', 'p1'),
        'CRM_SCHEDULED_POST_ALREADY_PUBLISHED',
      )
    })
  })
})
