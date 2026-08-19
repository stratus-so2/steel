import { describe, expect, it, vi } from 'vitest'
import { createFakeCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { err, ok } from '@/src/lib/result'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-competitor.repository')
vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/lib/social/discovery')
vi.mock('../crm-social-token')

import { fetchOwnMetrics, fetchPublicProfile } from '@/src/lib/social/discovery'
import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { CrmCompetitorService } from '../crm-competitor.service'
import { getFreshAccessToken } from '../crm-social-token'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCompetitorRepo = vi.mocked(CrmCompetitorRepository)
const mockedSocialRepo = vi.mocked(CrmSocialConnectionRepository)
const mockedGetFreshAccessToken = vi.mocked(getFreshAccessToken)
const mockedFetchPublicProfile = vi.mocked(fetchPublicProfile)
const mockedFetchOwnMetrics = vi.mocked(fetchOwnMetrics)

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

  describe('preview()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorService.preview('u1', 'ws1', {
          platform: 'INSTAGRAM',
          handle: '@rival',
        }),
        'FORBIDDEN',
      )
    })

    it('should propagate the error when there is no connected account', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedGetFreshAccessToken.mockResolvedValue(
        err({ code: 'CRM_SOCIAL_CONNECTION_NOT_FOUND', message: 'not found' }),
      )

      const result = await CrmCompetitorService.preview('u1', 'ws1', {
        platform: 'INSTAGRAM',
        handle: '@rival',
      })
      expectErr(result, 'CRM_SOCIAL_CONNECTION_NOT_FOUND')
    })

    it('should return the discovered profile on success', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const connection = createFakeCrmSocialConnection({
        externalAccountId: 'ig-own-1',
      })
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchPublicProfile.mockResolvedValue(
        ok({
          externalName: 'Rival Inc.',
          avatarUrl: 'https://cdn.example/avatar.png',
          bio: 'Somos rivais',
          followersCount: 5000,
          postsCount: 120,
          profileUrl: 'https://www.instagram.com/rival',
        }),
      )

      const dto = expectOk(
        await CrmCompetitorService.preview('u1', 'ws1', {
          platform: 'INSTAGRAM',
          handle: '@rival',
        }),
      )
      expect(dto).toEqual({
        displayName: 'Rival Inc.',
        avatarUrl: 'https://cdn.example/avatar.png',
        bio: 'Somos rivais',
        followersCount: 5000,
        postsCount: 120,
        profileUrl: 'https://www.instagram.com/rival',
      })
      expect(mockedFetchPublicProfile).toHaveBeenCalledWith(
        'INSTAGRAM',
        'token-1',
        'ig-own-1',
        '@rival',
      )
    })
  })

  describe('getMetrics()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
        'FORBIDDEN',
      )
    })

    it('should propagate NOT_FOUND when the competitor does not exist', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        err({ code: 'RESOURCE_NOT_FOUND', message: 'not found' }),
      )

      const result = await CrmCompetitorService.getMetrics(
        'u1',
        'ws1',
        'c1',
        '30d',
      )
      expect(result.ok).toBe(false)
    })

    it('should return ownAccount as null when no connection exists for the platform', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'INSTAGRAM' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(null))

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      expect(dto.ownAccount).toBeNull()
      expect(dto.competitor.followersCount).toBeNull()
      expect(dto.competitor.growth).toBeNull()
    })

    it('should compute growth and include ownAccount when a connection exists', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'INSTAGRAM' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(
        ok([
          {
            id: 's1',
            competitorId: 'c1',
            followersCount: 1000,
            postsCount: 10,
            capturedAt: new Date('2026-01-01'),
          },
          {
            id: 's2',
            competitorId: 'c1',
            followersCount: 1100,
            postsCount: 11,
            capturedAt: new Date('2026-01-15'),
          },
        ]),
      )
      const connection = createFakeCrmSocialConnection({
        id: 'conn-1',
        accountName: '@nossaconta',
      })
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))
      mockedSocialRepo.listMetricSnapshotsSince.mockResolvedValue(
        ok([
          {
            id: 'os1',
            connectionId: 'conn-1',
            followersCount: 2000,
            postsCount: 30,
            capturedAt: new Date('2026-01-01'),
          },
          {
            id: 'os2',
            connectionId: 'conn-1',
            followersCount: 1900,
            postsCount: 31,
            capturedAt: new Date('2026-01-15'),
          },
        ]),
      )

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      expect(dto.competitor.followersCount).toBe(1100)
      expect(dto.competitor.growth).toEqual({ absolute: 100, percent: 10 })
      expect(dto.ownAccount).not.toBeNull()
      expect(dto.ownAccount?.connectionId).toBe('conn-1')
      expect(dto.ownAccount?.accountName).toBe('@nossaconta')
      expect(dto.ownAccount?.followersCount).toBe(1900)
      expect(dto.ownAccount?.growth).toEqual({ absolute: -100, percent: -5 })
    })
  })

  describe('syncAll()', () => {
    it('should mark all competitors in a group as SYNC_FAILED when there is no connected account', async () => {
      mockedCompetitorRepo.listSyncable.mockResolvedValue(
        ok([
          createFakeCrmCompetitor({
            id: 'c1',
            workspaceId: 'ws1',
            platform: 'INSTAGRAM',
          }),
          createFakeCrmCompetitor({
            id: 'c2',
            workspaceId: 'ws1',
            platform: 'INSTAGRAM',
          }),
        ]),
      )
      mockedGetFreshAccessToken.mockResolvedValue(
        err({ code: 'CRM_SOCIAL_CONNECTION_NOT_FOUND', message: 'not found' }),
      )
      mockedCompetitorRepo.recordSyncResult.mockResolvedValue(
        ok(createFakeCrmCompetitor()),
      )

      const result = await CrmCompetitorService.syncAll()

      expect(result).toEqual({ processed: 2, synced: 0, failed: 2 })
      expect(mockedCompetitorRepo.recordSyncResult).toHaveBeenCalledTimes(2)
      expect(mockedCompetitorRepo.recordSyncResult).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ syncStatus: 'SYNC_FAILED' }),
      )
    })

    it('should sync competitors and snapshot the own account once per group', async () => {
      mockedCompetitorRepo.listSyncable.mockResolvedValue(
        ok([
          createFakeCrmCompetitor({
            id: 'c1',
            workspaceId: 'ws1',
            platform: 'INSTAGRAM',
            handle: '@rival1',
          }),
          createFakeCrmCompetitor({
            id: 'c2',
            workspaceId: 'ws1',
            platform: 'INSTAGRAM',
            handle: '@rival2',
          }),
        ]),
      )
      const connection = createFakeCrmSocialConnection({
        id: 'conn-1',
        externalAccountId: 'ig-own-1',
      })
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchOwnMetrics.mockResolvedValue(
        ok({ followersCount: 2000, postsCount: 30 }),
      )
      mockedSocialRepo.createMetricSnapshot.mockResolvedValue(
        ok({
          id: 'os1',
          connectionId: 'conn-1',
          followersCount: 2000,
          postsCount: 30,
          capturedAt: new Date(),
        }),
      )
      mockedFetchPublicProfile.mockResolvedValue(
        ok({
          externalName: 'Rival',
          avatarUrl: null,
          bio: null,
          followersCount: 900,
          postsCount: 9,
          profileUrl: null,
        }),
      )
      mockedCompetitorRepo.recordSyncResult.mockResolvedValue(
        ok(createFakeCrmCompetitor()),
      )
      mockedCompetitorRepo.createSnapshot.mockResolvedValue(
        ok({
          id: 's1',
          competitorId: 'c1',
          followersCount: 900,
          postsCount: 9,
          capturedAt: new Date(),
        }),
      )

      const result = await CrmCompetitorService.syncAll()

      expect(result).toEqual({ processed: 2, synced: 2, failed: 0 })
      expect(mockedGetFreshAccessToken).toHaveBeenCalledTimes(1)
      expect(mockedSocialRepo.createMetricSnapshot).toHaveBeenCalledTimes(1)
      expect(mockedCompetitorRepo.createSnapshot).toHaveBeenCalledTimes(2)
      expect(mockedCompetitorRepo.recordSyncResult).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ syncStatus: 'SYNCED', followersCount: 900 }),
      )
    })

    it('should mark a single competitor as SYNC_FAILED when its profile is not found, without failing the group', async () => {
      mockedCompetitorRepo.listSyncable.mockResolvedValue(
        ok([
          createFakeCrmCompetitor({
            id: 'c1',
            workspaceId: 'ws1',
            platform: 'YOUTUBE',
            handle: '@rival1',
          }),
        ]),
      )
      const connection = createFakeCrmSocialConnection({
        id: 'conn-1',
        platform: 'YOUTUBE',
      })
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchOwnMetrics.mockResolvedValue(
        ok({ followersCount: 500, postsCount: 5 }),
      )
      mockedSocialRepo.createMetricSnapshot.mockResolvedValue(
        ok({
          id: 'os1',
          connectionId: 'conn-1',
          followersCount: 500,
          postsCount: 5,
          capturedAt: new Date(),
        }),
      )
      mockedFetchPublicProfile.mockResolvedValue(
        err({ code: 'CRM_COMPETITOR_PROFILE_NOT_FOUND', message: 'not found' }),
      )
      mockedCompetitorRepo.recordSyncResult.mockResolvedValue(
        ok(createFakeCrmCompetitor()),
      )

      const result = await CrmCompetitorService.syncAll()

      expect(result).toEqual({ processed: 1, synced: 0, failed: 1 })
      expect(mockedCompetitorRepo.createSnapshot).not.toHaveBeenCalled()
      expect(mockedCompetitorRepo.recordSyncResult).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ syncStatus: 'SYNC_FAILED' }),
      )
    })
  })

  describe('syncWorkspace()', () => {
    it('should return FORBIDDEN for a non-member', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorService.syncWorkspace('u1', 'ws1'),
        'FORBIDDEN',
      )
    })

    it('should only sync competitors from the given workspace', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.listSyncable.mockResolvedValue(
        ok([
          createFakeCrmCompetitor({
            id: 'c1',
            workspaceId: 'ws1',
            platform: 'INSTAGRAM',
          }),
        ]),
      )
      const connection = createFakeCrmSocialConnection({ id: 'conn-1' })
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchOwnMetrics.mockResolvedValue(
        ok({ followersCount: 1000, postsCount: 10 }),
      )
      mockedSocialRepo.createMetricSnapshot.mockResolvedValue(
        ok({
          id: 'os1',
          connectionId: 'conn-1',
          followersCount: 1000,
          postsCount: 10,
          capturedAt: new Date(),
        }),
      )
      mockedFetchPublicProfile.mockResolvedValue(
        ok({
          externalName: 'Rival',
          avatarUrl: null,
          bio: null,
          followersCount: 500,
          postsCount: 5,
          profileUrl: null,
        }),
      )
      mockedCompetitorRepo.recordSyncResult.mockResolvedValue(
        ok(createFakeCrmCompetitor()),
      )
      mockedCompetitorRepo.createSnapshot.mockResolvedValue(
        ok({
          id: 's1',
          competitorId: 'c1',
          followersCount: 500,
          postsCount: 5,
          capturedAt: new Date(),
        }),
      )

      const result = expectOk(
        await CrmCompetitorService.syncWorkspace('u1', 'ws1'),
      )

      expect(result).toEqual({ processed: 1, synced: 1, failed: 0 })
      expect(mockedCompetitorRepo.listSyncable).toHaveBeenCalledWith('ws1')
    })
  })
})
