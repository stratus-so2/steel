import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-competitor.repository')

import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmCompetitorService } from '../crm-competitor.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCompetitorRepo = vi.mocked(CrmCompetitorRepository)

describe('CrmCompetitorService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmCompetitorService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return competitors for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmCompetitor({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmCompetitorService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })

  describe('create()', () => {
    it('should create a competitor', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.create.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1' })),
      )

      const dto = expectOk(
        await CrmCompetitorService.create('u1', 'ws1', {
          platform: 'INSTAGRAM',
          handle: '@rival',
        }),
      )
      expect(dto.id).toBe('c1')
    })
  })

  describe('remove()', () => {
    it('should propagate NOT_FOUND when the competitor does not exist', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        err({ code: 'RESOURCE_NOT_FOUND', message: 'not found' }),
      )

      const result = await CrmCompetitorService.remove('u1', 'ws1', 'c1')
      expect(result.ok).toBe(false)
    })
  })

  describe('reorder()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorService.reorder('u1', 'ws1', ['c1']),
        'FORBIDDEN',
      )
    })
  })
})
