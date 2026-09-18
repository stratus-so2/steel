import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeUser } from '@/src/__tests__/factories/user.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { createFakeWorkspaceFeatureOverride } from '@/src/__tests__/factories/workspace-feature-override.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/workspace-feature-override.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/repositories/user.repository')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/cache/workspace-features.cache')

import { WorkspaceFeaturesCache } from '@/src/cache/workspace-features.cache'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { UserRepository } from '@/src/repositories/user.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import { WorkspaceFeatureOverrideRepository } from '@/src/repositories/workspace-feature-override.repository'
import { assertFeature, FeatureFlagService } from '../feature-flag.service'

const mockedOverrideRepo = vi.mocked(WorkspaceFeatureOverrideRepository)
const mockedWorkspaceRepo = vi.mocked(WorkspaceRepository)
const mockedUserRepo = vi.mocked(UserRepository)
const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCache = vi.mocked(WorkspaceFeaturesCache)

const platformAdmin = createFakeUser({
  isPlatformAdmin: true,
  email: 'admin@stratustelecom.com.br',
})
const regularUser = createFakeUser({ email: 'user@example.com' })
const workspace = createFakeWorkspace({ id: 'ws1', activePlan: 'PRO' })

beforeEach(() => {
  mockedCache.get.mockResolvedValue(null)
  mockedCache.set.mockResolvedValue(undefined)
  mockedCache.invalidate.mockResolvedValue(undefined)
  mockedWorkspaceRepo.findById.mockResolvedValue(ok(workspace))
  mockedOverrideRepo.listByWorkspace.mockResolvedValue(ok([]))
})

describe('FeatureFlagService', () => {
  describe('hasFeature()', () => {
    it('should resolve from the plan default and cache the snapshot on a miss', async () => {
      const result = await FeatureFlagService.hasFeature(
        'ws1',
        'crm.aiAssistant',
      )

      expect(expectOk(result)).toBe(true)
      expect(mockedCache.set).toHaveBeenCalledWith('ws1', {
        plan: 'PRO',
        overrides: [],
      })
    })

    it('should use the cached snapshot without touching the database', async () => {
      mockedCache.get.mockResolvedValue({
        plan: 'PRO',
        overrides: [
          { key: 'communication.broadcasts', enabled: false, expiresAt: null },
        ],
      })

      const result = await FeatureFlagService.hasFeature(
        'ws1',
        'communication.broadcasts',
      )

      expect(expectOk(result)).toBe(false)
      expect(mockedWorkspaceRepo.findById).not.toHaveBeenCalled()
      expect(mockedOverrideRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should honour an override loaded from the database', async () => {
      mockedOverrideRepo.listByWorkspace.mockResolvedValue(
        ok([
          createFakeWorkspaceFeatureOverride({
            workspaceId: 'ws1',
            key: 'crm.socialPublishing',
            enabled: false,
          }),
        ]),
      )

      expect(
        expectOk(
          await FeatureFlagService.hasFeature('ws1', 'crm.socialPublishing'),
        ),
      ).toBe(false)
    })

    it('should propagate a database error', async () => {
      mockedOverrideRepo.listByWorkspace.mockResolvedValue(
        err(databaseError('boom')),
      )
      expectErr(
        await FeatureFlagService.hasFeature('ws1', 'crm.aiAssistant'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('assertFeature()', () => {
    it('should pass when the feature is on', async () => {
      expectOk(await assertFeature('ws1', 'crm.aiAssistant'))
    })

    it('should return FEATURE_NOT_ENABLED when the feature is off', async () => {
      mockedCache.get.mockResolvedValue({
        plan: 'PRO',
        overrides: [
          { key: 'crm.aiAssistant', enabled: false, expiresAt: null },
        ],
      })
      expectErr(
        await assertFeature('ws1', 'crm.aiAssistant'),
        'FEATURE_NOT_ENABLED',
      )
    })
  })

  describe('getForMember()', () => {
    it('should deny a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await FeatureFlagService.getForMember(regularUser.id, 'ws1'),
        'FORBIDDEN',
      )
    })

    it('should return the effective map for a member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'VIEWER' })),
      )
      const map = expectOk(
        await FeatureFlagService.getForMember(regularUser.id, 'ws1'),
      )
      expect(map['crm.aiAssistant']).toBe(true)
    })
  })

  describe('listForAdmin()', () => {
    it('should deny a non-platform-admin', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))
      expectErr(
        await FeatureFlagService.listForAdmin(regularUser.id, 'ws1'),
        'FORBIDDEN',
      )
      expect(mockedOverrideRepo.listByWorkspace).not.toHaveBeenCalled()
    })

    it('should return NOT_FOUND for an unknown workspace', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedWorkspaceRepo.findById.mockResolvedValue(err(notFound('Workspace')))
      expectErr(
        await FeatureFlagService.listForAdmin(platformAdmin.id, 'nope'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('should list the catalog with plan defaults and overrides, bypassing the cache', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedOverrideRepo.listByWorkspace.mockResolvedValue(
        ok([
          createFakeWorkspaceFeatureOverride({
            workspaceId: 'ws1',
            key: 'communication.broadcasts',
            enabled: false,
          }),
        ]),
      )

      const list = expectOk(
        await FeatureFlagService.listForAdmin(platformAdmin.id, 'ws1'),
      )

      const broadcasts = list.find((f) => f.key === 'communication.broadcasts')
      expect(broadcasts?.enabled).toBe(false)
      expect(broadcasts?.override?.enabled).toBe(false)
      expect(mockedCache.get).not.toHaveBeenCalled()
    })
  })

  describe('setOverride()', () => {
    it('should deny a non-platform-admin', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(regularUser))
      expectErr(
        await FeatureFlagService.setOverride(regularUser.id, 'ws1', {
          key: 'crm.aiAssistant',
          enabled: false,
          note: null,
          expiresAt: null,
        }),
        'FORBIDDEN',
      )
      expect(mockedOverrideRepo.upsert).not.toHaveBeenCalled()
    })

    it('should upsert the override, invalidate the cache and return the fresh list', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      const expiresAt = new Date(Date.now() + 86_400_000)
      const saved = createFakeWorkspaceFeatureOverride({
        workspaceId: 'ws1',
        key: 'crm.aiAssistant',
        enabled: false,
        note: 'Contrato sem IA',
        expiresAt,
      })
      mockedOverrideRepo.upsert.mockResolvedValue(ok(saved))
      mockedOverrideRepo.listByWorkspace.mockResolvedValue(ok([saved]))

      const list = expectOk(
        await FeatureFlagService.setOverride(platformAdmin.id, 'ws1', {
          key: 'crm.aiAssistant',
          enabled: false,
          note: 'Contrato sem IA',
          expiresAt,
        }),
      )

      expect(mockedOverrideRepo.upsert).toHaveBeenCalledWith({
        workspaceId: 'ws1',
        key: 'crm.aiAssistant',
        enabled: false,
        note: 'Contrato sem IA',
        expiresAt,
        updatedById: platformAdmin.id,
      })
      expect(mockedCache.invalidate).toHaveBeenCalledWith('ws1')
      expect(list.find((f) => f.key === 'crm.aiAssistant')?.enabled).toBe(false)
    })

    it('should remove the override when enabled is null', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedOverrideRepo.remove.mockResolvedValue(ok(true))

      expectOk(
        await FeatureFlagService.setOverride(platformAdmin.id, 'ws1', {
          key: 'crm.aiAssistant',
          enabled: null,
          note: null,
          expiresAt: null,
        }),
      )

      expect(mockedOverrideRepo.remove).toHaveBeenCalledWith(
        'ws1',
        'crm.aiAssistant',
      )
      expect(mockedOverrideRepo.upsert).not.toHaveBeenCalled()
      expect(mockedCache.invalidate).toHaveBeenCalledWith('ws1')
    })

    it('should not invalidate the cache when the write fails', async () => {
      mockedUserRepo.findById.mockResolvedValue(ok(platformAdmin))
      mockedOverrideRepo.upsert.mockResolvedValue(err(databaseError('boom')))

      expectErr(
        await FeatureFlagService.setOverride(platformAdmin.id, 'ws1', {
          key: 'crm.aiAssistant',
          enabled: true,
          note: null,
          expiresAt: null,
        }),
        'DATABASE_ERROR',
      )
      expect(mockedCache.invalidate).not.toHaveBeenCalled()
    })
  })
})
