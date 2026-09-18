import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createFakeCrmScheduledPost,
  createFakeCrmScheduledPostTarget,
  createFakeCrmSocialConnection,
} from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { createFakeWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { featureNotEnabled } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { CreateCrmScheduledPostDTO } from '@/src/schemas/crm-social.schema'

vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/services/feature-flag.service')
vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/repositories/workspace.repository')
vi.mock('@/src/lib/social/crypto', () => ({
  isTokenCryptoConfigured: vi.fn(() => true),
  encryptToken: vi.fn((plaintext: string) => `enc:${plaintext}`),
  decryptToken: vi.fn((payload: string) => payload.replace(/^enc:/, '')),
}))
vi.mock('@/src/lib/social/oauth-state', () => ({
  createOauthState: vi.fn(() => 'state-token'),
  verifyOauthState: vi.fn(() =>
    ok({ workspaceId: 'ws1', slug: 'acme', platform: 'FACEBOOK' as const }),
  ),
}))
vi.mock('@/src/lib/social/pkce', () => ({
  createPkcePair: vi.fn(() => ({ verifier: 'v', challenge: 'c' })),
}))
vi.mock('@/src/lib/social/redirect', () => ({
  socialCallbackUrl: vi.fn(
    () => 'https://app.test/api/social/callback/facebook',
  ),
}))
vi.mock('@/src/lib/social/providers', () => ({
  getProvider: vi.fn(),
}))

import { getProvider } from '@/src/lib/social/providers'
import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
  CrmSocialConnectionRepository,
} from '@/src/repositories/crm-social.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { WorkspaceRepository } from '@/src/repositories/workspace.repository'
import {
  CrmScheduledPostService,
  CrmSocialConnectionService,
} from '../crm-social.service'
import { assertFeature } from '../feature-flag.service'

const mockedMembershipRepo = vi.mocked(MembershipRepository)
const mockedPostRepo = vi.mocked(CrmScheduledPostRepository)
const mockedTargetRepo = vi.mocked(CrmScheduledPostTargetRepository)
const mockedConnectionRepo = vi.mocked(CrmSocialConnectionRepository)
const mockedWorkspaceRepo = vi.mocked(WorkspaceRepository)
const mockedGetProvider = vi.mocked(getProvider)
const mockedAssertFeature = vi.mocked(assertFeature)

beforeEach(() => {
  mockedAssertFeature.mockResolvedValue(ok(true))
})

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
            media: [],
          }),
        )
        .mockResolvedValueOnce(
          ok({
            ...createFakeCrmScheduledPost({ id: 'p1', status: 'FAILED' }),
            targets: [{ ...target, status: 'FAILED' }],
            media: [],
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
        expect.objectContaining({ lastError: expect.any(String) }),
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
          media: [],
        }),
      )

      expectErr(
        await CrmScheduledPostService.publish('u1', 'ws1', 'p1'),
        'CRM_SCHEDULED_POST_ALREADY_PUBLISHED',
      )
    })
  })
})

describe('CrmSocialConnectionService', () => {
  describe('completeConnect()', () => {
    it('should persist one connection per account returned by the provider', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkspaceRepo.findById.mockResolvedValue(
        ok(createFakeWorkspace({ id: 'ws1', slug: 'acme' })),
      )
      mockedConnectionRepo.listByPlatform.mockResolvedValue(ok([]))
      mockedConnectionRepo.upsertOAuthConnection
        .mockResolvedValueOnce(
          ok(
            createFakeCrmSocialConnection({
              id: 'conn1',
              externalAccountId: 'page-1',
            }),
          ),
        )
        .mockResolvedValueOnce(
          ok(
            createFakeCrmSocialConnection({
              id: 'conn2',
              externalAccountId: 'page-2',
            }),
          ),
        )
      mockedGetProvider.mockReturnValue({
        platform: 'FACEBOOK',
        isConfigured: () => true,
        buildAuthorizeUrl: () => 'https://facebook.test/authorize',
        exchangeCode: async () =>
          ok({
            accessToken: 'user-token',
            refreshToken: null,
            expiresAt: null,
            scope: 'pages_show_list',
          }),
        fetchAccounts: async () =>
          ok([
            { externalId: 'page-1', name: 'Page One' },
            { externalId: 'page-2', name: 'Page Two' },
          ]),
      })

      const result = expectOk(
        await CrmSocialConnectionService.completeConnect(
          'u1',
          'state-token',
          'auth-code',
          null,
        ),
      )

      expect(result.connected).toBe(2)
      expect(mockedConnectionRepo.upsertOAuthConnection).toHaveBeenCalledTimes(
        2,
      )
      expect(
        mockedConnectionRepo.upsertOAuthConnection,
      ).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          externalAccountId: 'page-1',
          isPrimary: true,
        }),
      )
      expect(
        mockedConnectionRepo.upsertOAuthConnection,
      ).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          externalAccountId: 'page-2',
          isPrimary: false,
        }),
      )
    })

    it('should not mark any new account as primary when the platform already has one', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      mockedWorkspaceRepo.findById.mockResolvedValue(
        ok(createFakeWorkspace({ id: 'ws1', slug: 'acme' })),
      )
      mockedConnectionRepo.listByPlatform.mockResolvedValue(
        ok([createFakeCrmSocialConnection({ isPrimary: true })]),
      )
      mockedConnectionRepo.upsertOAuthConnection.mockResolvedValue(
        ok(createFakeCrmSocialConnection({ externalAccountId: 'page-3' })),
      )
      mockedGetProvider.mockReturnValue({
        platform: 'FACEBOOK',
        isConfigured: () => true,
        buildAuthorizeUrl: () => 'https://facebook.test/authorize',
        exchangeCode: async () =>
          ok({
            accessToken: 'user-token',
            refreshToken: null,
            expiresAt: null,
            scope: 'pages_show_list',
          }),
        fetchAccounts: async () =>
          ok([{ externalId: 'page-3', name: 'Page Three' }]),
      })

      await CrmSocialConnectionService.completeConnect(
        'u1',
        'state-token',
        'auth-code',
        null,
      )

      expect(mockedConnectionRepo.upsertOAuthConnection).toHaveBeenCalledWith(
        expect.objectContaining({ isPrimary: false }),
      )
    })
  })

  describe('setPrimary()', () => {
    it('should enforce membership before touching the repository', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(ok(null))

      const result = await CrmSocialConnectionService.setPrimary(
        'stranger',
        'ws1',
        'conn1',
      )

      expectErr(result, 'FORBIDDEN')
      expect(mockedConnectionRepo.findById).not.toHaveBeenCalled()
    })

    it('should set the connection primary within its platform group', async () => {
      mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
        ok(createFakeMembership({ role: 'MEMBER' })),
      )
      const connection = createFakeCrmSocialConnection({
        id: 'conn1',
        workspaceId: 'ws1',
        platform: 'FACEBOOK',
      })
      mockedConnectionRepo.findById.mockResolvedValue(ok(connection))
      mockedConnectionRepo.setPrimary.mockResolvedValue(
        ok({ ...connection, isPrimary: true }),
      )

      const result = expectOk(
        await CrmSocialConnectionService.setPrimary('u1', 'ws1', 'conn1'),
      )

      expect(result.isPrimary).toBe(true)
      expect(mockedConnectionRepo.setPrimary).toHaveBeenCalledWith(
        'ws1',
        'FACEBOOK',
        'conn1',
      )
    })
  })
})

describe('CrmScheduledPostService feature flag crm.socialPublishing', () => {
  beforeEach(() => {
    mockedMembershipRepo.findByUserAndWorkspace.mockResolvedValue(
      ok(createFakeMembership({ role: 'MEMBER' })),
    )
    mockedAssertFeature.mockResolvedValue(err(featureNotEnabled()))
  })

  it('should block create() when social publishing is off', async () => {
    const dto = {
      platforms: ['FACEBOOK'],
      content: 'Novidade!',
      mode: 'schedule',
      scheduledFor: new Date(Date.now() + 3_600_000),
      options: {},
    } as unknown as CreateCrmScheduledPostDTO

    expectErr(
      await CrmScheduledPostService.create('u1', 'ws1', dto),
      'FEATURE_NOT_ENABLED',
    )
    expect(mockedAssertFeature).toHaveBeenCalledWith(
      'ws1',
      'crm.socialPublishing',
    )
    expect(mockedPostRepo.create).not.toHaveBeenCalled()
  })

  it('should block publish() and reschedule() when social publishing is off', async () => {
    expectErr(
      await CrmScheduledPostService.publish('u1', 'ws1', 'p1'),
      'FEATURE_NOT_ENABLED',
    )
    expectErr(
      await CrmScheduledPostService.reschedule(
        'u1',
        'ws1',
        'p1',
        new Date(Date.now() + 3_600_000),
      ),
      'FEATURE_NOT_ENABLED',
    )
    expect(mockedPostRepo.findById).not.toHaveBeenCalled()
  })
})
