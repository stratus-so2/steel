import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmActivity } from '@/src/__tests__/factories/crm-activity.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-activity.repository')

import { CrmActivityRepository } from '@/src/repositories/crm-activity.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmActivityService } from '../crm-activity.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedActivityRepo = vi.mocked(CrmActivityRepository)
const mockedModuleAccess = vi.mocked(WorkspaceModuleAccessRepository)

describe('CrmActivityService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmActivityService.list('u1', 'ws1', {}), 'FORBIDDEN')
    })

    it('should return activities for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedActivityRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmActivity({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmActivityService.list('u1', 'ws1', {}))
      expect(dtos).toHaveLength(1)
    })
    it('should pass filters through and let a viewer read the timeline', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'VIEWER' })),
      )
      mockedActivityRepo.listByWorkspace.mockResolvedValue(ok([]))

      expectOk(await CrmActivityService.list('u1', 'ws1', { companyId: 'c1' }))
      expect(mockedActivityRepo.listByWorkspace).toHaveBeenCalledWith('ws1', {
        companyId: 'c1',
      })
    })

    it('should deny a custom profile without audit-logs access', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(
          createFakeMembership({
            role: 'MEMBER',
            profile: {
              id: 'p1',
              workspaceId: 'ws1',
              name: 'Restrito',
              isSystem: false,
              systemKey: null,
              permissions: { companies: ['VIEW'] },
              createdAt: new Date(),
              updatedAt: new Date(),
            } as never,
          }),
        ),
      )

      expectErr(await CrmActivityService.list('u1', 'ws1', {}), 'FORBIDDEN')
      expect(mockedActivityRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should return MODULE_DISABLED when the CRM module is off', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      mockedModuleAccess.isEnabled.mockResolvedValueOnce(ok(false))

      expectErr(
        await CrmActivityService.list('u1', 'ws1', {}),
        'MODULE_DISABLED',
      )
    })

    it('should propagate repository errors', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedActivityRepo.listByWorkspace.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmActivityService.list('u1', 'ws1', {}),
        'DATABASE_ERROR',
      )
    })
  })
})
