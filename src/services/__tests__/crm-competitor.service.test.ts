import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, notFound } from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-competitor.repository')
vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/lib/social/discovery')
vi.mock('@/src/lib/social/discovery/instagram')
vi.mock('@/src/services/crm-social-instagram.service')
vi.mock('../crm-social-token')

import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { fetchOwnMetrics, fetchPublicProfile } from '@/src/lib/social/discovery'
import { fetchCompetitorTodayEngagement } from '@/src/lib/social/discovery/instagram'
import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { CrmCompetitorService } from '../crm-competitor.service'
import { fetchEnrichedMediaSince } from '../crm-social-instagram.service'
import { getFreshAccessToken } from '../crm-social-token'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedCompetitorRepo = vi.mocked(CrmCompetitorRepository)
const mockedSocialRepo = vi.mocked(CrmSocialConnectionRepository)
const mockedGetFreshAccessToken = vi.mocked(getFreshAccessToken)
const mockedFetchPublicProfile = vi.mocked(fetchPublicProfile)
const mockedFetchOwnMetrics = vi.mocked(fetchOwnMetrics)
const mockedFetchCompetitorTodayEngagement = vi.mocked(
  fetchCompetitorTodayEngagement,
)
const mockedFetchEnrichedMediaSince = vi.mocked(fetchEnrichedMediaSince)

// `getMetrics()` sempre tenta buscar "hoje" quando a plataforma é Instagram
// e há conexão — sem isso, testes que não mockam `getFreshAccessToken`
// explicitamente herdariam estado de um teste anterior (mocks não são
// limpos entre testes neste arquivo) e cairiam numa chamada de rede real.
beforeEach(() => {
  mockedFetchCompetitorTodayEngagement.mockResolvedValue(
    err({ code: 'CRM_COMPETITOR_PROFILE_NOT_FOUND', message: 'not found' }),
  )
  mockedFetchEnrichedMediaSince.mockResolvedValue(
    err({ code: 'CRM_SOCIAL_OAUTH_FAILED', message: 'failed' }),
  )
})

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
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        err({ code: 'RESOURCE_NOT_FOUND', message: 'not found' }),
      )

      const result = await CrmCompetitorService.remove('u1', 'ws1', 'c1')
      expectErr(result, 'RESOURCE_NOT_FOUND')
      expect(mockedCompetitorRepo.softDelete).not.toHaveBeenCalled()
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

    it("should include today's posts count and engagement rate for Instagram", async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmCompetitor({
            id: 'c1',
            platform: 'INSTAGRAM',
            handle: '@rival',
            followersCount: 1000,
          }),
        ),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))

      const connection = createFakeCrmSocialConnection({
        id: 'conn-1',
        externalAccountId: 'ig-own-1',
      })
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))
      mockedSocialRepo.listMetricSnapshotsSince.mockResolvedValue(
        ok([
          {
            id: 'os1',
            connectionId: 'conn-1',
            followersCount: 2000,
            postsCount: 30,
            capturedAt: new Date(),
          },
        ]),
      )

      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchCompetitorTodayEngagement.mockResolvedValue(
        ok({ postsCount: 2, totalLikes: 80, totalComments: 20 }),
      )
      const now = new Date().toISOString()
      mockedFetchEnrichedMediaSince.mockResolvedValue(
        ok([
          {
            id: 'm1',
            mediaType: 'IMAGE',
            mediaUrl: null,
            thumbnailUrl: null,
            caption: null,
            timestamp: now,
            permalink: null,
            likeCount: 40,
            commentsCount: 10,
            saved: 0,
            engagementScore: 50,
          },
        ]),
      )

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )

      // (80 + 20) / 1000 followers = 10%
      expect(dto.competitor.todayStats).toEqual({
        postsCount: 2,
        engagementRate: 10,
      })
      // (40 + 10) / 2000 followers = 2.5%
      expect(dto.ownAccount?.todayStats).toEqual({
        postsCount: 1,
        engagementRate: 2.5,
      })
      expect(mockedFetchCompetitorTodayEngagement).toHaveBeenCalledWith(
        'token-1',
        'ig-own-1',
        '@rival',
      )
    })

    it('should leave todayStats null for a platform without today-stats support', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'YOUTUBE' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(null))

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      expect(dto.competitor.todayStats).toBeNull()
      expect(mockedFetchCompetitorTodayEngagement).not.toHaveBeenCalled()
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

  describe('permission matrix (social)', () => {
    const asRole = (role: 'MEMBER' | 'VIEWER') =>
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role })),
      )

    it.each([
      ['VIEWER', 'create'],
      ['VIEWER', 'update'],
      ['VIEWER', 'remove'],
      ['VIEWER', 'reorder'],
      ['VIEWER', 'syncWorkspace'],
      ['MEMBER', 'remove'],
    ] as const)('should forbid a %s from calling %s()', async (role, action) => {
      asRole(role)

      const result =
        action === 'create'
          ? await CrmCompetitorService.create('u1', 'ws1', {
              platform: 'INSTAGRAM',
              handle: '@rival',
            })
          : action === 'update'
            ? await CrmCompetitorService.update('u1', 'ws1', 'c1', {
                notes: 'x',
              })
            : action === 'remove'
              ? await CrmCompetitorService.remove('u1', 'ws1', 'c1')
              : action === 'reorder'
                ? await CrmCompetitorService.reorder('u1', 'ws1', ['c1'])
                : await CrmCompetitorService.syncWorkspace('u1', 'ws1')

      expectErr(result, 'FORBIDDEN')
      expect(mockedCompetitorRepo.findById).not.toHaveBeenCalled()
      expect(mockedCompetitorRepo.create).not.toHaveBeenCalled()
      expect(mockedCompetitorRepo.listSyncable).not.toHaveBeenCalled()
    })

    it('should return MODULE_DISABLED when the CRM is off', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'OWNER' })),
      )
      vi.mocked(
        WorkspaceModuleAccessRepository.isEnabled,
      ).mockResolvedValueOnce(ok(false))

      expectErr(await CrmCompetitorService.list('u1', 'ws1'), 'MODULE_DISABLED')
      expect(mockedCompetitorRepo.listByWorkspace).not.toHaveBeenCalled()
    })
  })

  describe('CRUD edge cases', () => {
    beforeEach(() => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'ADMIN' })),
      )
    })

    it('should propagate list repository errors', async () => {
      mockedCompetitorRepo.listByWorkspace.mockResolvedValue(
        err(databaseError()),
      )
      expectErr(await CrmCompetitorService.list('u1', 'ws1'), 'DATABASE_ERROR')
    })

    it('should audit and propagate create failures', async () => {
      mockedCompetitorRepo.create.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmCompetitorService.create('u1', 'ws1', {
          platform: 'INSTAGRAM',
          handle: '@rival',
        }),
        'DATABASE_ERROR',
      )
      expect(vi.mocked(auditMutation)).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })

    it('should update a competitor and audit the changed fields', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1' })),
      )
      mockedCompetitorRepo.update.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', notes: 'Forte no Reels' })),
      )

      const dto = expectOk(
        await CrmCompetitorService.update('u1', 'ws1', 'c1', {
          notes: 'Forte no Reels',
        }),
      )

      expect(dto.notes).toBe('Forte no Reels')
      expect(mockedCompetitorRepo.update).toHaveBeenCalledWith(
        'c1',
        expect.objectContaining({ updatedById: 'u1', notes: 'Forte no Reels' }),
      )
      expect(vi.mocked(auditMutation)).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          targetId: 'c1',
          meta: { fields: ['notes'] },
        }),
      )
    })

    it('should return RESOURCE_NOT_FOUND when updating a missing competitor', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        err(notFound('Competitor')),
      )

      expectErr(
        await CrmCompetitorService.update('u1', 'ws1', 'c1', { notes: 'x' }),
        'RESOURCE_NOT_FOUND',
      )
      expect(mockedCompetitorRepo.update).not.toHaveBeenCalled()
    })

    it('should propagate update repository errors without auditing', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1' })),
      )
      mockedCompetitorRepo.update.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmCompetitorService.update('u1', 'ws1', 'c1', { notes: 'x' }),
        'DATABASE_ERROR',
      )
      expect(vi.mocked(auditMutation)).not.toHaveBeenCalled()
    })

    it('should soft delete a competitor recording the actor', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1' })),
      )
      mockedCompetitorRepo.softDelete.mockResolvedValue(ok(undefined))

      expectOk(await CrmCompetitorService.remove('u1', 'ws1', 'c1'))
      expect(mockedCompetitorRepo.softDelete).toHaveBeenCalledWith('c1', 'u1')
      expect(vi.mocked(auditMutation)).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'delete', targetId: 'c1' }),
      )
    })

    it('should propagate soft delete errors', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1' })),
      )
      mockedCompetitorRepo.softDelete.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmCompetitorService.remove('u1', 'ws1', 'c1'),
        'DATABASE_ERROR',
      )
    })

    it('should reorder competitors', async () => {
      mockedCompetitorRepo.reorder.mockResolvedValue(ok(undefined))

      expectOk(await CrmCompetitorService.reorder('u1', 'ws1', ['c2', 'c1']))
      expect(mockedCompetitorRepo.reorder).toHaveBeenCalledWith('ws1', [
        'c2',
        'c1',
      ])
    })

    it('should propagate the discovery error from preview()', async () => {
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({
          accessToken: 'token-1',
          connection: createFakeCrmSocialConnection(),
        }),
      )
      mockedFetchPublicProfile.mockResolvedValue(
        err({ code: 'CRM_COMPETITOR_PROFILE_NOT_FOUND', message: 'not found' }),
      )

      expectErr(
        await CrmCompetitorService.preview('u1', 'ws1', {
          platform: 'INSTAGRAM',
          handle: '@nope',
        }),
        'CRM_COMPETITOR_PROFILE_NOT_FOUND',
      )
    })
  })

  describe('getMetrics() edge cases', () => {
    beforeEach(() => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'VIEWER' })),
      )
    })

    it('should propagate snapshot query errors', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(
        err(databaseError()),
      )

      expectErr(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '7d'),
        'DATABASE_ERROR',
      )
      expect(mockedSocialRepo.findPrimaryByPlatform).not.toHaveBeenCalled()
    })

    it('should query snapshots from the start of the requested window', async () => {
      const now = new Date('2026-06-30T12:00:00Z').getTime()
      vi.spyOn(Date, 'now').mockReturnValue(now)
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'YOUTUBE' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(null))

      expectOk(await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '90d'))
      expect(mockedCompetitorRepo.listSnapshotsSince).toHaveBeenCalledWith(
        'c1',
        new Date(now - 90 * 86_400_000),
      )
    })

    it('should return a null growth percent when the first snapshot has zero followers', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'YOUTUBE' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(
        ok([
          {
            id: 's1',
            competitorId: 'c1',
            followersCount: 0,
            postsCount: null,
            capturedAt: new Date('2026-01-01'),
          },
          {
            id: 's2',
            competitorId: 'c1',
            followersCount: 50,
            postsCount: 2,
            capturedAt: new Date('2026-01-02'),
          },
        ]),
      )
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(null))

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '7d'),
      )
      expect(dto.competitor.growth).toEqual({ absolute: 50, percent: null })
      expect(dto.competitor.snapshots).toHaveLength(2)
    })

    it('should skip today stats when the Instagram token cannot be refreshed', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'INSTAGRAM' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))
      const connection = createFakeCrmSocialConnection({ id: 'conn-1' })
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))
      mockedSocialRepo.listMetricSnapshotsSince.mockResolvedValue(ok([]))
      mockedGetFreshAccessToken.mockResolvedValue(
        err({ code: 'CRM_SOCIAL_OAUTH_FAILED', message: 'expired' }),
      )

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      expect(dto.competitor.todayStats).toBeNull()
      expect(dto.ownAccount?.todayStats).toBeNull()
      expect(dto.ownAccount?.followersCount).toBeNull()
      expect(mockedFetchCompetitorTodayEngagement).not.toHaveBeenCalled()
    })

    it('should use the latest snapshot for engagement and null the rate without followers', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmCompetitor({
            id: 'c1',
            platform: 'INSTAGRAM',
            followersCount: 999_999,
          }),
        ),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(
        ok([
          {
            id: 's1',
            competitorId: 'c1',
            followersCount: 200,
            postsCount: 3,
            capturedAt: new Date(),
          },
        ]),
      )
      const connection = createFakeCrmSocialConnection({ id: 'conn-1' })
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))
      // Conta própria sem snapshot: taxa de engajamento não calculável.
      mockedSocialRepo.listMetricSnapshotsSince.mockResolvedValue(ok([]))
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchCompetitorTodayEngagement.mockResolvedValue(
        ok({ postsCount: 1, totalLikes: 15, totalComments: 5 }),
      )
      mockedFetchEnrichedMediaSince.mockResolvedValue(ok([]))

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      // (15 + 5) / 200 (snapshot mais recente, não o campo do concorrente)
      expect(dto.competitor.todayStats).toEqual({
        postsCount: 1,
        engagementRate: 10,
      })
      expect(dto.ownAccount?.todayStats).toEqual({
        postsCount: 0,
        engagementRate: null,
      })
    })

    it('should fall back to the stored followers count and leave ownAccount null when its snapshots fail', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(
          createFakeCrmCompetitor({
            id: 'c1',
            platform: 'INSTAGRAM',
            followersCount: null,
          }),
        ),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))
      const connection = createFakeCrmSocialConnection({ id: 'conn-1' })
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(ok(connection))
      mockedSocialRepo.listMetricSnapshotsSince.mockResolvedValue(
        err(databaseError()),
      )
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({ accessToken: 'token-1', connection }),
      )
      mockedFetchCompetitorTodayEngagement.mockResolvedValue(
        ok({ postsCount: 2, totalLikes: 10, totalComments: 0 }),
      )

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      expect(dto.competitor.todayStats).toEqual({
        postsCount: 2,
        engagementRate: null,
      })
      expect(dto.ownAccount).toBeNull()
    })

    it('should ignore a failed connection lookup', async () => {
      mockedCompetitorRepo.findById.mockResolvedValue(
        ok(createFakeCrmCompetitor({ id: 'c1', platform: 'INSTAGRAM' })),
      )
      mockedCompetitorRepo.listSnapshotsSince.mockResolvedValue(ok([]))
      mockedSocialRepo.findPrimaryByPlatform.mockResolvedValue(
        err(databaseError()),
      )

      const dto = expectOk(
        await CrmCompetitorService.getMetrics('u1', 'ws1', 'c1', '30d'),
      )
      expect(dto.ownAccount).toBeNull()
      expect(mockedGetFreshAccessToken).not.toHaveBeenCalled()
    })
  })

  describe('sync edge cases', () => {
    it('should throw when syncAll() cannot list competitors', async () => {
      mockedCompetitorRepo.listSyncable.mockResolvedValue(err(databaseError()))

      await expect(CrmCompetitorService.syncAll()).rejects.toThrow(
        'Failed to list syncable competitors: DATABASE_ERROR',
      )
    })

    it('should propagate the listing error from syncWorkspace()', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedCompetitorRepo.listSyncable.mockResolvedValue(err(databaseError()))

      expectErr(
        await CrmCompetitorService.syncWorkspace('u1', 'ws1'),
        'DATABASE_ERROR',
      )
    })

    it('should log own-metrics failures and still sync each workspace+platform group', async () => {
      const errorSpy = vi.spyOn(logger, 'error').mockImplementation(() => {})
      mockedCompetitorRepo.listSyncable.mockResolvedValue(
        ok([
          createFakeCrmCompetitor({
            id: 'c1',
            workspaceId: 'ws1',
            platform: 'INSTAGRAM',
          }),
          createFakeCrmCompetitor({
            id: 'c2',
            workspaceId: 'ws2',
            platform: 'INSTAGRAM',
          }),
        ]),
      )
      mockedGetFreshAccessToken.mockResolvedValue(
        ok({
          accessToken: 'token-1',
          connection: createFakeCrmSocialConnection({ id: 'conn-1' }),
        }),
      )
      mockedFetchOwnMetrics.mockResolvedValue(
        err({ code: 'CRM_SOCIAL_OAUTH_FAILED', message: 'failed' }),
      )
      mockedFetchPublicProfile.mockResolvedValue(
        ok({
          externalName: 'Rival',
          avatarUrl: null,
          bio: null,
          followersCount: 10,
          postsCount: 1,
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
          followersCount: 10,
          postsCount: 1,
          capturedAt: new Date(),
        }),
      )

      const result = await CrmCompetitorService.syncAll()

      expect(result).toEqual({ processed: 2, synced: 2, failed: 0 })
      expect(mockedGetFreshAccessToken).toHaveBeenCalledTimes(2)
      expect(mockedSocialRepo.createMetricSnapshot).not.toHaveBeenCalled()
      expect(errorSpy).toHaveBeenCalledWith(
        'crm_competitor_sync.own_metrics_failed',
        expect.objectContaining({ reason: 'CRM_SOCIAL_OAUTH_FAILED' }),
      )
    })
  })
})
