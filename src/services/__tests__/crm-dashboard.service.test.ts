import { describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmDashboard,
  createFakeCrmDashboardWidget,
} from '@/src/__tests__/factories/crm-dashboard.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-dashboard.repository')

import {
  CrmDashboardRepository,
  CrmDashboardWidgetRepository,
} from '@/src/repositories/crm-dashboard.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import {
  CrmDashboardService,
  CrmDashboardWidgetService,
} from '../crm-dashboard.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedDashboardRepo = vi.mocked(CrmDashboardRepository)
const mockedWidgetRepo = vi.mocked(CrmDashboardWidgetRepository)

describe('CrmDashboardService', () => {
  describe('list()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmDashboardService.list('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return dashboards for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDashboardRepo.listByWorkspace.mockResolvedValue(
        ok([createFakeCrmDashboard({ workspaceId: 'ws1' })]),
      )

      const dtos = expectOk(await CrmDashboardService.list('u1', 'ws1'))
      expect(dtos).toHaveLength(1)
    })
  })
})

describe('CrmDashboardWidgetService', () => {
  describe('update()', () => {
    it('should reject a config that does not match the widget type schema', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDashboardRepo.findById.mockResolvedValue(
        ok(createFakeCrmDashboard({ id: 'd1', workspaceId: 'ws1' })),
      )
      mockedWidgetRepo.findById.mockResolvedValue(
        ok(createFakeCrmDashboardWidget({ id: 'w1', type: 'IFRAME' })),
      )

      expectErr(
        await CrmDashboardWidgetService.update('u1', 'ws1', 'd1', 'w1', {
          config: { url: 'not-a-url' },
        }),
        'VALIDATION_ERROR',
      )
    })

    it('should accept a config that matches the widget type schema', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDashboardRepo.findById.mockResolvedValue(
        ok(createFakeCrmDashboard({ id: 'd1', workspaceId: 'ws1' })),
      )
      mockedWidgetRepo.findById.mockResolvedValue(
        ok(createFakeCrmDashboardWidget({ id: 'w1', type: 'IFRAME' })),
      )
      mockedWidgetRepo.update.mockResolvedValue(
        ok(createFakeCrmDashboardWidget({ id: 'w1', type: 'IFRAME' })),
      )

      expectOk(
        await CrmDashboardWidgetService.update('u1', 'ws1', 'd1', 'w1', {
          config: { url: 'https://example.com' },
        }),
      )
    })
  })

  describe('applyLayout()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmDashboardWidgetService.applyLayout('u1', 'ws1', 'd1', {
          items: [],
        }),
        'FORBIDDEN',
      )
    })

    it('should batch-apply positions for a workspace member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedDashboardRepo.findById.mockResolvedValue(
        ok(createFakeCrmDashboard({ id: 'd1', workspaceId: 'ws1' })),
      )
      mockedWidgetRepo.applyLayout.mockResolvedValue(ok(undefined))

      expectOk(
        await CrmDashboardWidgetService.applyLayout('u1', 'ws1', 'd1', {
          items: [{ id: 'w1', x: 0, y: 0, w: 4, h: 6 }],
        }),
      )
      expect(mockedWidgetRepo.applyLayout).toHaveBeenCalledWith('d1', [
        { id: 'w1', x: 0, y: 0, w: 4, h: 6 },
      ])
    })
  })
})
