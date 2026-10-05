import type { CrmCompetitorIdeaSet, CrmCompetitorPost } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createFakeCrmCompetitor } from '@/src/__tests__/factories/crm-competitor.factory'
import { createFakeCrmSocialConnection } from '@/src/__tests__/factories/crm-social.factory'
import { createFakeMembership } from '@/src/__tests__/factories/membership.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  aiQuotaExceeded,
  databaseError,
  featureNotEnabled,
  notFound,
} from '@/src/errors'
import { err, ok } from '@/src/lib/result'

vi.mock('@/lib/axiom/audit')
vi.mock('@/src/repositories/membership.repository')
vi.mock('@/src/repositories/crm-competitor.repository')
vi.mock('@/src/repositories/crm-competitor-analysis.repository')
vi.mock('@/src/repositories/crm-social.repository')
vi.mock('@/src/services/ai-usage.service')
vi.mock('@/src/services/feature-flag.service')

import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import { CrmCompetitorAnalysisRepository } from '@/src/repositories/crm-competitor-analysis.repository'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import { MembershipRepository } from '@/src/repositories/membership.repository'
import { AiUsageService } from '@/src/services/ai-usage.service'
import { assertFeature } from '@/src/services/feature-flag.service'
import {
  buildIdeasPrompt,
  CrmCompetitorAnalysisService,
  stripTrailingHashtags,
} from '../crm-competitor-analysis.service'

const membership = vi.mocked(MembershipRepository)
const competitors = vi.mocked(CrmCompetitorRepository)
const analysisRepo = vi.mocked(CrmCompetitorAnalysisRepository)
const social = vi.mocked(CrmSocialConnectionRepository)
const ai = vi.mocked(AiUsageService)
const feature = vi.mocked(assertFeature)
const audit = vi.mocked(auditMutation)

const WS = 'ws1'
const ACTOR = 'u1'

const competitor = createFakeCrmCompetitor({
  id: 'c1',
  workspaceId: WS,
  platform: 'INSTAGRAM',
  handle: '@rival',
  displayName: 'Rival Telecom',
  followersCount: 1000,
})

function competitorPost(
  overrides: Partial<CrmCompetitorPost> = {},
): CrmCompetitorPost {
  const now = new Date()
  return {
    id: `row-${Math.random()}`,
    competitorId: 'c1',
    externalId: `m-${Math.random()}`,
    format: 'REELS',
    caption: 'Chame no @fulano ou ana@example.com #fibra',
    permalink: 'https://instagram.com/p/x',
    likeCount: 90,
    commentsCount: 10,
    viewCount: null,
    publishedAt: new Date(Date.now() - 86_400_000),
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

const idea = {
  title: 'Bastidores da instalação',
  format: 'REELS',
  hook: 'Você sabe o que acontece depois que pede fibra?',
  caption: 'Mostramos o passo a passo da instalação.',
  rationale: 'Reels rendem 3× a média do concorrente.',
  hashtags: ['#fibra', 'internet'],
}

function chat(text: string) {
  return {
    text,
    toolCalls: [],
    message: { role: 'assistant' as const, content: text },
    usage: { inputTokens: 500, outputTokens: 300 },
    stopReason: 'end' as const,
  }
}

const provider = { id: 'anthropic' as const, chat: vi.fn() }

function ideaSetRow(
  overrides: Partial<CrmCompetitorIdeaSet> = {},
): CrmCompetitorIdeaSet {
  return {
    id: 'set1',
    competitorId: 'c1',
    range: '30d',
    ideas: [{ ...idea, hashtags: ['fibra', 'internet'] }],
    modelKey: 'anthropic:claude',
    createdById: ACTOR,
    createdAt: new Date('2026-10-05T12:00:00Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  membership.findByUserAndWorkspace.mockResolvedValue(
    ok(createFakeMembership({ role: 'MEMBER' })),
  )
  competitors.findById.mockResolvedValue(ok(competitor))
  analysisRepo.listCompetitorPostsSince.mockResolvedValue(
    ok([competitorPost(), competitorPost({ format: 'IMAGE', likeCount: 5 })]),
  )
  const { competitorId: _competitorId, ...ownPost } = competitorPost({
    format: 'IMAGE',
    likeCount: 20,
    commentsCount: 0,
  })
  analysisRepo.listConnectionPostsSince.mockResolvedValue(
    ok([{ ...ownPost, connectionId: 'conn1' }]),
  )
  social.findPrimaryByPlatform.mockResolvedValue(
    ok(
      createFakeCrmSocialConnection({
        id: 'conn1',
        accountName: 'Stratus',
      }),
    ),
  )
  social.listMetricSnapshotsSince.mockResolvedValue(
    ok([
      {
        id: 's1',
        connectionId: 'conn1',
        followersCount: 500,
        postsCount: 10,
        capturedAt: new Date(),
      },
    ]),
  )
  feature.mockResolvedValue(ok(true))
  ai.prepare.mockResolvedValue(
    ok({
      feature: 'CRM_ASSISTANT',
      provider: provider as never,
      model: {
        key: 'anthropic:claude',
        provider: 'anthropic',
        model: 'claude-x',
        label: 'Claude',
      },
      usdPer1kTokens: 4,
    }),
  )
  ai.record.mockResolvedValue(undefined)
  provider.chat.mockResolvedValue(chat(JSON.stringify({ ideas: [idea] })))
  analysisRepo.createIdeaSet.mockResolvedValue(ok(ideaSetRow()))
})

describe('CrmCompetitorAnalysisService', () => {
  describe('getAnalysis()', () => {
    it('returns FORBIDDEN for a non-member', async () => {
      membership.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorAnalysisService.getAnalysis(ACTOR, WS, 'c1', '30d'),
        'FORBIDDEN',
      )
    })

    it('propagates NOT_FOUND for a competitor outside the workspace', async () => {
      competitors.findById.mockResolvedValue(
        err(notFound('CrmTrackedCompetitor')),
      )
      expectErr(
        await CrmCompetitorAnalysisService.getAnalysis(ACTOR, WS, 'c1', '30d'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('compares the competitor with the own account', async () => {
      const analysis = expectOk(
        await CrmCompetitorAnalysisService.getAnalysis(ACTOR, WS, 'c1', '7d'),
      )
      expect(analysis.range).toBe('7d')
      expect(analysis.competitor.id).toBe('c1')
      expect(analysis.competitorStats.postsCount).toBe(2)
      expect(analysis.competitorStats.engagementRate).toBeCloseTo(5.75)
      expect(analysis.ownAccount).toMatchObject({
        connectionId: 'conn1',
        accountName: 'Stratus',
        followersCount: 500,
      })
      expect(analysis.ownAccount?.stats.engagementRate).toBe(4)
      expect(analysis.insights.some((i) => i.key === 'frequency')).toBe(true)

      const since = analysisRepo.listCompetitorPostsSince.mock.calls[0][1]
      const days = (Date.now() - since.getTime()) / 86_400_000
      expect(Math.round(days)).toBe(7)
    })

    it('works without a connected account', async () => {
      social.findPrimaryByPlatform.mockResolvedValue(ok(null))
      const analysis = expectOk(
        await CrmCompetitorAnalysisService.getAnalysis(ACTOR, WS, 'c1', '30d'),
      )
      expect(analysis.ownAccount).toBeNull()
      expect(analysisRepo.listConnectionPostsSince).not.toHaveBeenCalled()
    })

    it('leaves own followers empty when there is no snapshot yet', async () => {
      social.listMetricSnapshotsSince.mockResolvedValue(ok([]))
      const analysis = expectOk(
        await CrmCompetitorAnalysisService.getAnalysis(ACTOR, WS, 'c1', '30d'),
      )
      expect(analysis.ownAccount?.followersCount).toBeNull()
      expect(analysis.ownAccount?.stats.engagementRate).toBeNull()
    })

    it.each([
      [
        'competitor posts',
        () =>
          analysisRepo.listCompetitorPostsSince.mockResolvedValue(
            err(databaseError()),
          ),
      ],
      [
        'connection lookup',
        () =>
          social.findPrimaryByPlatform.mockResolvedValue(err(databaseError())),
      ],
      [
        'own posts',
        () =>
          analysisRepo.listConnectionPostsSince.mockResolvedValue(
            err(databaseError()),
          ),
      ],
      [
        'own snapshots',
        () =>
          social.listMetricSnapshotsSince.mockResolvedValue(
            err(databaseError()),
          ),
      ],
    ])('propagates a database error from %s', async (_label, arrange) => {
      arrange()
      expectErr(
        await CrmCompetitorAnalysisService.getAnalysis(ACTOR, WS, 'c1', '30d'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('getLatestIdeas()', () => {
    it('returns FORBIDDEN for a non-member', async () => {
      membership.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorAnalysisService.getLatestIdeas(ACTOR, WS, 'c1'),
        'FORBIDDEN',
      )
    })

    it('propagates NOT_FOUND for an unknown competitor', async () => {
      competitors.findById.mockResolvedValue(
        err(notFound('CrmTrackedCompetitor')),
      )
      expectErr(
        await CrmCompetitorAnalysisService.getLatestIdeas(ACTOR, WS, 'c1'),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('returns null when nothing was generated yet', async () => {
      analysisRepo.findLatestIdeaSet.mockResolvedValue(ok(null))
      expect(
        expectOk(
          await CrmCompetitorAnalysisService.getLatestIdeas(ACTOR, WS, 'c1'),
        ),
      ).toBeNull()
    })

    it('maps the latest idea set', async () => {
      analysisRepo.findLatestIdeaSet.mockResolvedValue(ok(ideaSetRow()))
      const set = expectOk(
        await CrmCompetitorAnalysisService.getLatestIdeas(ACTOR, WS, 'c1'),
      )
      expect(set?.ideas).toHaveLength(1)
      expect(set?.createdAt).toBe('2026-10-05T12:00:00.000Z')
    })

    it('propagates a database error', async () => {
      analysisRepo.findLatestIdeaSet.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmCompetitorAnalysisService.getLatestIdeas(ACTOR, WS, 'c1'),
        'DATABASE_ERROR',
      )
    })
  })

  describe('generateIdeas()', () => {
    it('returns FORBIDDEN for a non-member', async () => {
      membership.findByUserAndWorkspace.mockResolvedValue(ok(null))
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'FORBIDDEN',
      )
      expect(provider.chat).not.toHaveBeenCalled()
    })

    it('respects the plan feature gate', async () => {
      feature.mockResolvedValue(err(featureNotEnabled()))
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'FEATURE_NOT_ENABLED',
      )
      expect(feature).toHaveBeenCalledWith(WS, 'crm.aiAssistant')
    })

    it('propagates NOT_FOUND for an unknown competitor', async () => {
      competitors.findById.mockResolvedValue(
        err(notFound('CrmTrackedCompetitor')),
      )
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'RESOURCE_NOT_FOUND',
      )
    })

    it('refuses to spend quota without collected posts', async () => {
      analysisRepo.listCompetitorPostsSince.mockResolvedValue(ok([]))
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'CRM_COMPETITOR_NO_POSTS',
      )
      expect(ai.prepare).not.toHaveBeenCalled()
    })

    it('propagates the AI quota error', async () => {
      ai.prepare.mockResolvedValue(err(aiQuotaExceeded(50, 50)))
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'AI_QUOTA_EXCEEDED',
      )
      expect(provider.chat).not.toHaveBeenCalled()
    })

    it('generates, records usage, stores and audits the idea set', async () => {
      const set = expectOk(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
      )
      expect(set.id).toBe('set1')
      expect(ai.prepare).toHaveBeenCalledWith(WS, 'CRM_ASSISTANT', ACTOR)
      expect(ai.record).toHaveBeenCalledWith(expect.anything(), {
        workspaceId: WS,
        userId: ACTOR,
        usage: { inputTokens: 500, outputTokens: 300 },
      })
      const request = provider.chat.mock.calls[0][0]
      expect(request.model).toBe('claude-x')
      expect(request.jsonSchema.name).toBe('competitor_post_ideas')
      expect(analysisRepo.createIdeaSet).toHaveBeenCalledWith({
        competitorId: 'c1',
        range: '30d',
        ideas: [{ ...idea, hashtags: ['fibra', 'internet'] }],
        modelKey: 'anthropic:claude',
        createdById: ACTOR,
      })
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          entity: 'crm_competitor_idea_set',
          action: 'create',
          targetId: 'set1',
        }),
      )
    })

    it('drops ideas in formats the platform cannot publish', async () => {
      provider.chat.mockResolvedValue(
        chat(
          JSON.stringify({
            ideas: [idea, { ...idea, title: 'Short', format: 'SHORT' }],
          }),
        ),
      )
      expectOk(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
      )
      const stored = analysisRepo.createIdeaSet.mock.calls[0][0].ideas as {
        title: string
      }[]
      expect(stored.map((i) => i.title)).toEqual([idea.title])
    })

    it('fails cleanly when the model output is invalid', async () => {
      provider.chat.mockResolvedValue(chat('não é JSON'))
      const warn = vi.spyOn(logger, 'warn')
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'CRM_COMPETITOR_IDEAS_FAILED',
      )
      expect(warn).toHaveBeenCalledWith(
        'crm_competitor.ideas_invalid_output',
        expect.anything(),
      )
      expect(analysisRepo.createIdeaSet).not.toHaveBeenCalled()
    })

    it('fails cleanly when the provider throws', async () => {
      provider.chat.mockRejectedValue(new Error('timeout'))
      const error = vi.spyOn(logger, 'error')
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'CRM_COMPETITOR_IDEAS_FAILED',
      )
      expect(error).toHaveBeenCalledWith(
        'crm_competitor.ideas_provider_failed',
        expect.objectContaining({ message: 'timeout' }),
      )
      expect(ai.record).not.toHaveBeenCalled()
    })

    it('audits the failure when the idea set cannot be stored', async () => {
      analysisRepo.createIdeaSet.mockResolvedValue(err(databaseError()))
      expectErr(
        await CrmCompetitorAnalysisService.generateIdeas(ACTOR, WS, 'c1', {
          range: '30d',
        }),
        'DATABASE_ERROR',
      )
      expect(audit).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'failure',
          reason: 'DATABASE_ERROR',
        }),
      )
    })
  })

  describe('buildIdeasPrompt()', () => {
    const baseAnalysis = {
      range: '30d' as const,
      competitor: {} as never,
      competitorStats: {
        postsCount: 1,
        postsPerWeek: 0.2,
        avgInteractions: 100,
        engagementRate: 10,
        avgViews: 50,
        hiddenLikesCount: 0,
        avgCaptionLength: 10,
        formats: [
          {
            format: 'REELS' as const,
            share: 100,
            postsCount: 1,
            avgInteractions: 100,
          },
        ],
        weekdays: [],
        dayparts: [],
        hashtags: [{ tag: 'fibra', postsCount: 1, avgInteractions: 100 }],
        topPosts: [],
      },
      ownAccount: null,
      insights: [],
    }

    it('masks personal data and mentions, and states the allowed formats', () => {
      const prompt = buildIdeasPrompt({
        competitor,
        analysis: baseAnalysis,
        competitorPosts: [
          competitorPost(),
          competitorPost({
            caption: null,
            likeCount: null,
            commentsCount: null,
          }),
        ],
      })
      expect(prompt.system).toContain('IMAGE, CAROUSEL, REELS, VIDEO')
      expect(prompt.system).toContain('a nossa marca')
      expect(prompt.user).toContain('Nossa conta: sem conta conectada')
      expect(prompt.user).toContain('Visualizações médias')
      expect(prompt.user).toContain('- nenhuma')
      expect(prompt.user).toContain('(sem legenda)')
      expect(prompt.user).not.toContain('@fulano')
      expect(prompt.user).not.toContain('ana@example.com')
    })

    it('uses the YouTube formats and the own account name', () => {
      const prompt = buildIdeasPrompt({
        competitor: { ...competitor, platform: 'YOUTUBE', displayName: null },
        analysis: {
          ...baseAnalysis,
          competitorStats: {
            ...baseAnalysis.competitorStats,
            avgViews: null,
            formats: [],
            hashtags: [],
            engagementRate: null,
          },
          ownAccount: {
            connectionId: 'conn1',
            accountName: 'Stratus',
            followersCount: 10,
            stats: baseAnalysis.competitorStats,
          },
          insights: [
            { key: 'frequency', tone: 'neutral', text: 'Frequência igual.' },
          ],
        },
        competitorPosts: [],
      })
      expect(prompt.system).toContain('VIDEO, SHORT')
      expect(prompt.system).toContain('para Stratus')
      expect(prompt.user).toContain('Concorrente (@rival)')
      expect(prompt.user).toContain('Nossa conta (Stratus)')
      expect(prompt.user).toContain('- Frequência igual.')
      expect(prompt.user).toContain('Formatos: n/d')
      expect(prompt.user).toContain('Taxa de engajamento: n/d')
    })
  })

  describe('stripTrailingHashtags()', () => {
    it('removes the hashtag block at the end of the caption', () => {
      expect(
        stripTrailingHashtags('Veja a fibra! 🚀 #fibra #internet\n#dicas'),
      ).toBe('Veja a fibra! 🚀')
    })

    it('keeps hashtags in the middle and a caption made only of hashtags', () => {
      expect(stripTrailingHashtags('Use #fibra em casa')).toBe(
        'Use #fibra em casa',
      )
      expect(stripTrailingHashtags('#fibra #internet')).toBe('#fibra #internet')
    })
  })
})
