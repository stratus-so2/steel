import { describe, expect, it, vi } from 'vitest'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspaceModuleAccess } from '@/src/__tests__/factories/workspace-module-access.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace-module-access.repository')
vi.mock('@/src/repositories/user.repository')

import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { WorkspaceModuleAccessService } from '../workspace-module-access.service'

const mockedRepo = vi.mocked(WorkspaceModuleAccessRepository)
const mockedUserRepo = vi.mocked(UserRepository)

const platformAdmin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})
const regularUser = createFakeUser({
  isPlatformAdmin: false,
  email: 'user@example.com',
})

describe('WorkspaceModuleAccessService', () => {
  describe('list()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await WorkspaceModuleAccessService.list(regularUser.id, 'ws1'),
        'FORBIDDEN',
      )
      expect(mockedRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should fill in modules that were never granted', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedRepo.listByWorkspace.mockResolvedValue(
        ok([
          createFakeWorkspaceModuleAccess({
            module: 'CRM',
            enabled: true,
            grantedById: platformAdmin.id,
          }),
        ]),
      )

      const result = await WorkspaceModuleAccessService.list(
        platformAdmin.id,
        'ws1',
      )

      const summary = expectOk(result)
      expect(summary).toHaveLength(3)
      const crm = summary.find((s) => s.module === 'CRM')
      const serviceDesk = summary.find((s) => s.module === 'SERVICE_DESK')
      expect(crm?.enabled).toBe(true)
      expect(serviceDesk).toEqual({
        module: 'SERVICE_DESK',
        enabled: false,
        grantedById: null,
        updatedAt: null,
      })
    })
  })

  describe('setEnabled()', () => {
    it('should deny a non-platform-admin actor', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))

      expectErr(
        await WorkspaceModuleAccessService.setEnabled(
          regularUser.id,
          'ws1',
          'CRM',
          true,
        ),
        'FORBIDDEN',
      )
      expect(mockedRepo.upsert).not.toHaveBeenCalled()
    })

    it('should upsert access attributing grantedById to the acting admin', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedRepo.upsert.mockResolvedValue(
        ok(
          createFakeWorkspaceModuleAccess({
            workspaceId: 'ws1',
            module: 'COMMUNICATION',
            enabled: true,
            grantedById: platformAdmin.id,
          }),
        ),
      )

      const result = await WorkspaceModuleAccessService.setEnabled(
        platformAdmin.id,
        'ws1',
        'COMMUNICATION',
        true,
      )

      const dto = expectOk(result)
      expect(dto.enabled).toBe(true)
      expect(mockedRepo.upsert).toHaveBeenCalledWith(
        'ws1',
        'COMMUNICATION',
        true,
        platformAdmin.id,
      )
    })
  })

  describe('isModuleEnabled()', () => {
    it('should not require platform admin (internal gating check)', async () => {
      mockedRepo.isEnabled.mockResolvedValue(ok(true))

      const result = await WorkspaceModuleAccessService.isModuleEnabled(
        'ws1',
        'CRM',
      )

      expect(expectOk(result)).toBe(true)
      expect(mockedUserRepo.findById).not.toHaveBeenCalled()
    })
  })
})
