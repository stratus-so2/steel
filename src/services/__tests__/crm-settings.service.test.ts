import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmSettings } from '@/src/__tests__/factories/crm-settings.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-settings.repository')

import { CrmSettingsRepository } from '@/src/repositories/crm-settings.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmSettingsService } from '../crm-settings.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedSettingsRepo = vi.mocked(CrmSettingsRepository)

function mockRole(role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER') {
  mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role })),
  )
}

describe('CrmSettingsService', () => {
  describe('get()', () => {
    it('should return the defaults when the workspace never saved settings', async () => {
      mockRole('MEMBER')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(ok(null))

      const dto = expectOk(await CrmSettingsService.get('u1', 'ws1'))

      expect(dto).toEqual({
        workspaceId: 'ws1',
        leadReopenStage: 'RECEIVED',
        proposalValidityDays: 15,
        notifyProposalExpiry: true,
        isDefault: true,
        updatedById: null,
        updatedAt: null,
      })
    })

    it('should return the saved settings', async () => {
      mockRole('VIEWER')
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(
        ok(
          createFakeCrmSettings({
            workspaceId: 'ws1',
            leadReopenStage: 'QUALIFIED',
            proposalValidityDays: 30,
          }),
        ),
      )

      const dto = expectOk(await CrmSettingsService.get('u1', 'ws1'))
      expect(dto.leadReopenStage).toBe('QUALIFIED')
      expect(dto.proposalValidityDays).toBe(30)
      expect(dto.isDefault).toBe(false)
    })

    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(await CrmSettingsService.get('u1', 'ws1'), 'FORBIDDEN')
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      mockRole('OWNER')
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))
      expectErr(await CrmSettingsService.get('u1', 'ws1'), 'MODULE_DISABLED')
    })
  })

  describe('update()', () => {
    it('should let an admin change the settings', async () => {
      mockRole('ADMIN')
      mockedSettingsRepo.upsert.mockResolvedValue(
        ok(
          createFakeCrmSettings({
            workspaceId: 'ws1',
            proposalValidityDays: 30,
            updatedById: 'u1',
          }),
        ),
      )

      const dto = expectOk(
        await CrmSettingsService.update('u1', 'ws1', {
          proposalValidityDays: 30,
        }),
      )

      expect(dto.proposalValidityDays).toBe(30)
      expect(mockedSettingsRepo.upsert).toHaveBeenCalledWith('ws1', {
        proposalValidityDays: 30,
        updatedById: 'u1',
      })
    })

    it('should refuse members and viewers', async () => {
      for (const role of ['MEMBER', 'VIEWER'] as const) {
        mockRole(role)
        expectErr(
          await CrmSettingsService.update('u1', 'ws1', {
            leadReopenStage: 'QUALIFIED',
          }),
          'FORBIDDEN',
        )
      }
      expect(mockedSettingsRepo.upsert).not.toHaveBeenCalled()
    })
  })

  describe('resolve()', () => {
    it('should fall back to the defaults without a saved row', async () => {
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(ok(null))
      expect(expectOk(await CrmSettingsService.resolve('ws1'))).toEqual({
        leadReopenStage: 'RECEIVED',
        proposalValidityDays: 15,
        notifyProposalExpiry: true,
      })
    })

    it('should propagate a database failure', async () => {
      mockedSettingsRepo.findByWorkspace.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(await CrmSettingsService.resolve('ws1'), 'DATABASE_ERROR')
    })
  })
})
