import { z } from 'zod'
import { ok } from '@/src/lib/result'
import { CRM_COMPETITOR_METRICS_RANGES } from '@/src/schemas/crm-competitor.schema'
import { CrmCompetitorService } from '@/src/services/crm-competitor.service'
import { CrmSocialTrendingService } from '@/src/services/crm-social-trending.service'
import type { SteelAiTool } from '../types'
import {
  crmBase,
  crmPath,
  pageParameters,
  pageSchema,
  paginate,
  zodParser,
} from './shared'

/* Ports of the old CRM assistant's social tools (competitors, trending). */

const ListCompetitorsArgs = z.object({ ...pageSchema })

export const crmListCompetitorsTool: SteelAiTool<
  z.output<typeof ListCompetitorsArgs>
> = {
  name: 'crm_list_competitors',
  label: 'Consultando concorrentes',
  module: 'CRM',
  kind: 'READ',
  description:
    'Lista os concorrentes rastreados nas redes sociais (Instagram/YouTube) — handle, seguidores e status de sincronização. Use antes de crm_get_competitor_growth para achar o competitorId.',
  parameters: {
    type: 'object',
    properties: { ...pageParameters },
    additionalProperties: false,
  },
  permission: { resource: 'social', action: 'VIEW' },
  parse: zodParser(ListCompetitorsArgs),
  async execute(ctx, args) {
    const competitors = await CrmCompetitorService.list(
      ctx.actorId,
      ctx.workspaceId,
    )
    if (!competitors.ok) return competitors
    const base = await crmBase(ctx)
    const page = paginate(competitors.value, args, (c) => ({
      id: c.id,
      platform: c.platform,
      handle: c.handle,
      displayName: c.displayName,
      followersCount: c.followersCount,
      syncStatus: c.syncStatus,
      lastSyncedAt: c.lastSyncedAt,
      href: crmPath(base, `social/competitors/${c.id}`),
    }))
    return ok({ data: page, summary: `${page.total} concorrente(s)` })
  },
}

const GrowthArgs = z.object({
  competitorId: z.string().min(1),
  range: z.enum(CRM_COMPETITOR_METRICS_RANGES).default('30d'),
})

export const crmGetCompetitorGrowthTool: SteelAiTool<
  z.output<typeof GrowthArgs>
> = {
  name: 'crm_get_competitor_growth',
  label: 'Comparando crescimento do concorrente',
  module: 'CRM',
  kind: 'READ',
  description:
    'Série histórica de seguidores e estatísticas de posts de um concorrente comparadas com a conta conectada do workspace, com a variação no período.',
  parameters: {
    type: 'object',
    properties: {
      competitorId: {
        type: 'string',
        description: 'Id do concorrente (de crm_list_competitors).',
      },
      range: {
        type: 'string',
        enum: [...CRM_COMPETITOR_METRICS_RANGES],
        description: 'Janela de tempo (padrão 30d).',
      },
    },
    required: ['competitorId'],
    additionalProperties: false,
  },
  permission: { resource: 'social', action: 'VIEW' },
  parse: zodParser(GrowthArgs),
  async execute(ctx, args) {
    const metrics = await CrmCompetitorService.getMetrics(
      ctx.actorId,
      ctx.workspaceId,
      args.competitorId,
      args.range,
    )
    if (!metrics.ok) return metrics
    const base = await crmBase(ctx)
    return ok({
      data: {
        ...metrics.value,
        href: crmPath(base, `social/competitors/${args.competitorId}`),
      },
      summary: `Métricas do concorrente (${args.range})`,
    })
  },
}

const TrendingArgs = z.object({ ...pageSchema })

export const crmGetTrendingPostsTool: SteelAiTool<
  z.output<typeof TrendingArgs>
> = {
  name: 'crm_get_trending_posts',
  label: 'Consultando posts em alta',
  module: 'CRM',
  kind: 'READ',
  description:
    'Ranking dos posts publicados hoje (Instagram conectado e TikTok) por velocidade de engajamento — quanto mais visualizações/interações em menos tempo, mais em alta.',
  parameters: {
    type: 'object',
    properties: { ...pageParameters },
    additionalProperties: false,
  },
  permission: { resource: 'social', action: 'VIEW' },
  parse: zodParser(TrendingArgs),
  async execute(ctx, args) {
    const ranking = await CrmSocialTrendingService.getTodayRanking(
      ctx.actorId,
      ctx.workspaceId,
    )
    if (!ranking.ok) return ranking
    const base = await crmBase(ctx)
    const page = paginate(ranking.value, args, (item) => item)
    return ok({
      data: { ...page, href: crmPath(base, 'social/trending') },
      summary: `${page.total} post(s) em alta hoje`,
    })
  },
}

export const CRM_SOCIAL_TOOLS = [
  crmListCompetitorsTool,
  crmGetCompetitorGrowthTool,
  crmGetTrendingPostsTool,
]
