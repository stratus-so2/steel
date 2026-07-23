import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmTask } from '@/src/__tests__/factories/crm-task.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-task.repository')

import { CrmTaskRepository } from '@/src/repositories/crm-task.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmTaskService } from '../crm-task.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedTaskRepo = vi.mocked(CrmTaskRepository)

describe('CrmTaskService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmTaskService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return tasks for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedTaskRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmTask({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmTaskService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })
  })
})
