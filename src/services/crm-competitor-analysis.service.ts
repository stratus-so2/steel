import type { CrmTrackedCompetitor, Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { logger } from '@/lib/axiom/logger'
import { crmCompetitorIdeasFailed, crmCompetitorNoPosts } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import { clipSdText, redactSdPii } from '@/src/lib/servicedesk/ai-prompts'
import {
  buildCompetitorInsights,
  computePostStats,
  type PostSample,
} from '@/src/lib/social/post-analytics'
import {
  toCrmCompetitorDTO,
  toCrmCompetitorIdeaSetDTO,
} from '@/src/mappers/crm-competitor.mapper'
import { CrmCompetitorRepository } from '@/src/repositories/crm-competitor.repository'
import { CrmCompetitorAnalysisRepository } from '@/src/repositories/crm-competitor-analysis.repository'
import { CrmSocialConnectionRepository } from '@/src/repositories/crm-social.repository'
import {
  CRM_COMPETITOR_IDEAS_COUNT,
  CRM_COMPETITOR_IDEAS_JSON_SCHEMA,
  CRM_SOCIAL_POST_FORMAT_LABELS,
  CrmCompetitorIdeasOutputSchema,
  type CrmCompetitorMetricsRange,
  type GenerateCrmCompetitorIdeasDTO,
} from '@/src/schemas/crm-competitor.schema'
import { parseSdAiJson } from '@/src/schemas/sd-ai.schema'
import type {
  CrmCompetitorAnalysisDTO,
  CrmCompetitorIdeaSetDTO,
  CrmPostStatsDTO,
  CrmSocialPostFormatDTO,
} from '@/types/crm-competitor'
import { AiUsageService } from './ai-usage.service'
import { assertModuleMember } from './authz'
import { assertFeature } from './feature-flag.service'

export const RANGE_DAYS: Record<CrmCompetitorMetricsRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

/** Formats each platform can actually publish — the model must stay inside them. */
const PLATFORM_FORMATS: Record<string, CrmSocialPostFormatDTO[]> = {
  INSTAGRAM: ['IMAGE', 'CAROUSEL', 'REELS', 'VIDEO'],
  YOUTUBE: ['VIDEO', 'SHORT'],
}

const IDEAS_MAX_TOKENS = 3000
const PROMPT_TOP_POSTS = 8
const PROMPT_CAPTION_CHARS = 400

const ENTITY = 'crm_competitor_idea_set'

type AnalysisContext = {
  competitor: CrmTrackedCompetitor
  analysis: CrmCompetitorAnalysisDTO
  competitorPosts: PostSample[]
}

/** Models often repeat the hashtags at the end of the caption; they live in `hashtags`. */
export function stripTrailingHashtags(caption: string): string {
  const stripped = caption.replace(/(?:\s*#[\p{L}\p{N}_]+)+\s*$/u, '').trimEnd()
  return stripped || caption
}

function competitorName(competitor: CrmTrackedCompetitor): string {
  return competitor.displayName?.trim() || competitor.handle
}

/**
 * Builds the window's analysis. Shared by the analysis endpoint and the
 * ideas generation, which grounds the prompt on the same numbers the user
 * sees on screen.
 */
async function loadAnalysis(
  workspaceId: string,
  competitorId: string,
  range: CrmCompetitorMetricsRange,
): Promise<Result<AnalysisContext>> {
  const competitor = await CrmCompetitorRepository.findById(
    competitorId,
    workspaceId,
  )
  if (!competitor.ok) return competitor

  const rangeDays = RANGE_DAYS[range]
  const since = new Date(Date.now() - rangeDays * 86_400_000)

  const posts = await CrmCompetitorAnalysisRepository.listCompetitorPostsSince(
    competitorId,
    since,
  )
  if (!posts.ok) return posts

  const competitorStats = computePostStats(posts.value, {
    followersCount: competitor.value.followersCount,
    rangeDays,
  })

  let ownAccount: CrmCompetitorAnalysisDTO['ownAccount'] = null
  const connection = await CrmSocialConnectionRepository.findPrimaryByPlatform(
    workspaceId,
    competitor.value.platform,
  )
  if (!connection.ok) return connection

  if (connection.value) {
    const [ownPosts, snapshots] = await Promise.all([
      CrmCompetitorAnalysisRepository.listConnectionPostsSince(
        connection.value.id,
        since,
      ),
      CrmSocialConnectionRepository.listMetricSnapshotsSince(
        connection.value.id,
        since,
      ),
    ])
    if (!ownPosts.ok) return ownPosts
    if (!snapshots.ok) return snapshots

    const followersCount = snapshots.value.at(-1)?.followersCount ?? null
    ownAccount = {
      connectionId: connection.value.id,
      accountName: connection.value.accountName,
      followersCount,
      stats: computePostStats(ownPosts.value, { followersCount, rangeDays }),
    }
  }

  return ok({
    competitor: competitor.value,
    competitorPosts: posts.value,
    analysis: {
      range,
      competitor: toCrmCompetitorDTO(competitor.value),
      competitorStats,
      ownAccount,
      insights: buildCompetitorInsights({
        competitorName: competitorName(competitor.value),
        competitor: competitorStats,
        own: ownAccount?.stats ?? null,
      }),
    },
  })
}

function formatNumber(value: number | null, suffix = ''): string {
  if (value === null) return 'n/d'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)}${suffix}`
}

function statsSummary(stats: CrmPostStatsDTO): string {
  const formats = stats.formats
    .map(
      (f) =>
        `${CRM_SOCIAL_POST_FORMAT_LABELS[f.format]}: ${f.postsCount} posts, média ${formatNumber(f.avgInteractions)} interações`,
    )
    .join('; ')
  const hashtags = stats.hashtags
    .slice(0, 8)
    .map((h) => `#${h.tag}`)
    .join(' ')
  return [
    `- Posts no período: ${stats.postsCount} (${formatNumber(stats.postsPerWeek)}/semana)`,
    `- Interações médias por post: ${formatNumber(stats.avgInteractions)}`,
    `- Taxa de engajamento: ${formatNumber(stats.engagementRate, '%')}`,
    stats.avgViews !== null
      ? `- Visualizações médias: ${formatNumber(stats.avgViews)}`
      : null,
    `- Formatos: ${formats || 'n/d'}`,
    `- Hashtags mais usadas: ${hashtags || 'nenhuma'}`,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Caption for the prompt: clipped, personal data masked, @mentions dropped. */
function promptCaption(caption: string | null): string {
  if (!caption) return '(sem legenda)'
  const withoutMentions = caption.replace(/@[\w.]+/g, '@perfil')
  return redactSdPii(clipSdText(withoutMentions, PROMPT_CAPTION_CHARS))
}

export function buildIdeasPrompt(ctx: AnalysisContext): {
  system: string
  user: string
} {
  const { competitor, analysis, competitorPosts } = ctx
  const name = competitorName(competitor)
  const formats = PLATFORM_FORMATS[competitor.platform] ?? ['IMAGE']
  const ownName = analysis.ownAccount?.accountName ?? 'a nossa marca'

  const topPosts = [...competitorPosts]
    .sort(
      (a, b) =>
        (b.likeCount ?? 0) +
        (b.commentsCount ?? 0) -
        ((a.likeCount ?? 0) + (a.commentsCount ?? 0)),
    )
    .slice(0, PROMPT_TOP_POSTS)
    .map(
      (post, index) =>
        `${index + 1}. [${CRM_SOCIAL_POST_FORMAT_LABELS[post.format]}] ${formatNumber((post.likeCount ?? 0) + (post.commentsCount ?? 0))} interações — ${promptCaption(post.caption)}`,
    )
    .join('\n')

  const system = [
    'Você é estrategista de conteúdo para redes sociais de uma empresa brasileira.',
    `Com base na análise de um concorrente, proponha exatamente ${CRM_COMPETITOR_IDEAS_COUNT} ideias de publicação para ${ownName}.`,
    'Regras:',
    '- Escreva em português do Brasil.',
    '- Inspire-se no que funciona para o concorrente (temas, formatos, ganchos, horários), mas nunca copie texto dele nem cite o nome dele.',
    `- Use apenas estes formatos: ${formats.join(', ')}.`,
    '- "hook" é a primeira frase ou os primeiros segundos do post; "caption" é a legenda pronta para publicar; "rationale" explica, citando os números da análise, por que a ideia deve funcionar.',
    '- A legenda não leva hashtags: elas vão só no campo "hashtags", sem o símbolo #, no máximo 8 por ideia.',
    '- Não invente dados, promoções ou preços.',
    'Responda somente com o JSON pedido.',
  ].join('\n')

  const user = [
    `Plataforma: ${competitor.platform}. Janela: últimos ${RANGE_DAYS[analysis.range]} dias.`,
    '',
    `Concorrente (${name}):`,
    statsSummary(analysis.competitorStats),
    '',
    analysis.ownAccount
      ? `Nossa conta (${ownName}):\n${statsSummary(analysis.ownAccount.stats)}`
      : 'Nossa conta: sem conta conectada nesta plataforma.',
    '',
    'Leituras comparativas:',
    analysis.insights.map((i) => `- ${i.text}`).join('\n') || '- nenhuma',
    '',
    'Posts do concorrente com mais interações:',
    topPosts,
  ].join('\n')

  return { system, user }
}

export const CrmCompetitorAnalysisService = {
  /** Comparison metrics for the window, computed without AI. */
  async getAnalysis(
    actorId: string,
    workspaceId: string,
    competitorId: string,
    range: CrmCompetitorMetricsRange,
  ): Promise<Result<CrmCompetitorAnalysisDTO>> {
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM', {
      resource: 'social',
      action: 'VIEW',
    })
    if (!membership.ok) return membership

    const ctx = await loadAnalysis(workspaceId, competitorId, range)
    if (!ctx.ok) return ctx
    return ok(ctx.value.analysis)
  },

  /** Latest generated idea set, or `null` when none was generated yet. */
  async getLatestIdeas(
    actorId: string,
    workspaceId: string,
    competitorId: string,
  ): Promise<Result<CrmCompetitorIdeaSetDTO | null>> {
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM', {
      resource: 'social',
      action: 'VIEW',
    })
    if (!membership.ok) return membership

    const competitor = await CrmCompetitorRepository.findById(
      competitorId,
      workspaceId,
    )
    if (!competitor.ok) return competitor

    const latest =
      await CrmCompetitorAnalysisRepository.findLatestIdeaSet(competitorId)
    if (!latest.ok) return latest
    return ok(latest.value ? toCrmCompetitorIdeaSetDTO(latest.value) : null)
  },

  /**
   * Post ideas from the workspace's AI provider (OpenAI or Anthropic, model
   * and monthly quota resolved by `AiUsageService`, ADR 0007). Same model as
   * the CRM assistant, and gated by the same plan feature.
   */
  async generateIdeas(
    actorId: string,
    workspaceId: string,
    competitorId: string,
    dto: GenerateCrmCompetitorIdeasDTO,
  ): Promise<Result<CrmCompetitorIdeaSetDTO>> {
    const membership = await assertModuleMember(actorId, workspaceId, 'CRM', {
      resource: 'social',
      action: 'CREATE',
    })
    if (!membership.ok) return membership
    const feature = await assertFeature(workspaceId, 'crm.aiAssistant')
    if (!feature.ok) return feature

    const ctx = await loadAnalysis(workspaceId, competitorId, dto.range)
    if (!ctx.ok) return ctx
    if (ctx.value.competitorPosts.length === 0)
      return err(crmCompetitorNoPosts())

    const call = await AiUsageService.prepare(
      workspaceId,
      'CRM_ASSISTANT',
      actorId,
    )
    if (!call.ok) return call

    const prompt = buildIdeasPrompt(ctx.value)
    let text: string
    try {
      const response = await call.value.provider.chat({
        model: call.value.model.model,
        system: prompt.system,
        messages: [{ role: 'user', content: prompt.user }],
        jsonSchema: {
          name: 'competitor_post_ideas',
          schema: CRM_COMPETITOR_IDEAS_JSON_SCHEMA,
        },
        maxTokens: IDEAS_MAX_TOKENS,
      })
      await AiUsageService.record(call.value, {
        workspaceId,
        userId: actorId,
        usage: response.usage,
      })
      text = response.text
    } catch (error) {
      logger.error('crm_competitor.ideas_provider_failed', {
        component: 'CrmCompetitorAnalysisService',
        workspaceId,
        competitorId,
        provider: call.value.model.provider,
        model: call.value.model.model,
        message: error instanceof Error ? error.message : String(error),
      })
      return err(crmCompetitorIdeasFailed())
    }

    const parsed = parseSdAiJson(CrmCompetitorIdeasOutputSchema, text)
    const allowed = new Set(
      PLATFORM_FORMATS[ctx.value.competitor.platform] ?? [],
    )
    const ideas = (parsed?.ideas ?? [])
      .filter((idea) => allowed.has(idea.format))
      .map((idea) => ({
        ...idea,
        caption: stripTrailingHashtags(idea.caption),
        hashtags: idea.hashtags.map((tag) => tag.replace(/^#/, '')).slice(0, 8),
      }))
    if (ideas.length === 0) {
      logger.warn('crm_competitor.ideas_invalid_output', {
        component: 'CrmCompetitorAnalysisService',
        workspaceId,
        competitorId,
        model: call.value.model.key,
      })
      return err(crmCompetitorIdeasFailed())
    }

    const created = await CrmCompetitorAnalysisRepository.createIdeaSet({
      competitorId,
      range: dto.range,
      ideas: ideas as unknown as Prisma.InputJsonValue,
      modelKey: call.value.model.key,
      createdById: actorId,
    })
    auditMutation({
      entity: ENTITY,
      action: 'create',
      actorId,
      targetId: created.ok ? created.value.id : undefined,
      outcome: created.ok ? undefined : 'failure',
      reason: created.ok ? undefined : created.error.code,
      meta: { competitorId, range: dto.range, ideas: ideas.length },
    })
    if (!created.ok) return created

    logger.info('crm_competitor.ideas_generated', {
      component: 'CrmCompetitorAnalysisService',
      workspaceId,
      competitorId,
      model: call.value.model.key,
      ideas: ideas.length,
    })
    return ok(toCrmCompetitorIdeaSetDTO(created.value))
  },
}
