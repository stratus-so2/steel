import type { CrmSocialPostFormat } from '@prisma/client'
import { CRM_SOCIAL_POST_FORMAT_LABELS } from '@/src/schemas/crm-competitor.schema'
import type {
  CrmCompetitorInsightDTO,
  CrmPostDaypartDTO,
  CrmPostStatsDTO,
  CrmSocialPostDTO,
} from '@/types/crm-competitor'

/**
 * Comparison metrics for competitor analysis — pure functions, no AI and no
 * I/O. Both sides (competitor and own account) go through the same math so
 * the numbers are comparable. Day/hour buckets use the product timezone.
 */

export const POST_ANALYTICS_TIME_ZONE = 'America/Sao_Paulo'

/** Smallest group that counts as a pattern (one post is an anecdote). */
export const MIN_POSTS_FOR_PATTERN = 2

const TOP_POSTS = 5
const TOP_HASHTAGS = 10

export type PostSample = {
  externalId: string
  format: CrmSocialPostFormat
  caption: string | null
  permalink: string | null
  likeCount: number | null
  commentsCount: number | null
  viewCount: number | null
  publishedAt: Date
}

const DAYPARTS: CrmPostDaypartDTO[] = [
  'DAWN',
  'MORNING',
  'AFTERNOON',
  'EVENING',
]

const DAYPART_LABELS: Record<CrmPostDaypartDTO, string> = {
  DAWN: 'de madrugada',
  MORNING: 'de manhã',
  AFTERNOON: 'à tarde',
  EVENING: 'à noite',
}

const WEEKDAY_LABELS = [
  'no domingo',
  'na segunda',
  'na terça',
  'na quarta',
  'na quinta',
  'na sexta',
  'no sábado',
]

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
}

const zonedParts = new Intl.DateTimeFormat('en-US', {
  timeZone: POST_ANALYTICS_TIME_ZONE,
  weekday: 'short',
  hour: 'numeric',
  hourCycle: 'h23',
})

export function zonedWeekdayAndHour(date: Date): {
  weekday: number
  hour: number
} {
  const parts = zonedParts.formatToParts(date)
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0)
  return { weekday: WEEKDAY_INDEX[weekday] ?? 0, hour: hour % 24 }
}

export function daypartOf(hour: number): CrmPostDaypartDTO {
  if (hour < 6) return 'DAWN'
  if (hour < 12) return 'MORNING'
  if (hour < 18) return 'AFTERNOON'
  return 'EVENING'
}

/** Likes + comments; `null` when the platform reported neither. */
export function interactionsOf(post: PostSample): number | null {
  if (post.likeCount === null && post.commentsCount === null) return null
  return (post.likeCount ?? 0) + (post.commentsCount ?? 0)
}

export function extractHashtags(caption: string | null): string[] {
  if (!caption) return []
  const tags = new Set<string>()
  for (const match of caption.matchAll(/#([\p{L}\p{N}_]+)/gu)) {
    tags.add(match[1].toLowerCase())
  }
  return [...tags]
}

function average(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function round(value: number | null, digits = 2): number | null {
  if (value === null) return null
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

type Bucket = { postsCount: number; interactions: number[] }

function emptyBucket(): Bucket {
  return { postsCount: 0, interactions: [] }
}

function addToBucket(bucket: Bucket, interactions: number | null): void {
  bucket.postsCount += 1
  if (interactions !== null) bucket.interactions.push(interactions)
}

function bucketStats(bucket: Bucket) {
  return {
    postsCount: bucket.postsCount,
    avgInteractions: round(average(bucket.interactions)),
  }
}

export function toSocialPostDTO(post: PostSample): CrmSocialPostDTO {
  return {
    externalId: post.externalId,
    format: post.format,
    caption: post.caption,
    permalink: post.permalink,
    likeCount: post.likeCount,
    commentsCount: post.commentsCount,
    viewCount: post.viewCount,
    interactions: interactionsOf(post),
    publishedAt: post.publishedAt.toISOString(),
  }
}

/** Ranking score: interactions first, views as the fallback (YouTube with hidden likes). */
function rankScore(post: PostSample): number {
  return interactionsOf(post) ?? post.viewCount ?? 0
}

export function computePostStats(
  posts: PostSample[],
  options: { followersCount: number | null; rangeDays: number },
): CrmPostStatsDTO {
  const formats = new Map<CrmSocialPostFormat, Bucket>()
  const weekdays = Array.from({ length: 7 }, emptyBucket)
  const dayparts = new Map<CrmPostDaypartDTO, Bucket>(
    DAYPARTS.map((d) => [d, emptyBucket()]),
  )
  const hashtags = new Map<string, Bucket>()
  const interactions: number[] = []
  const views: number[] = []
  const captionLengths: number[] = []
  let hiddenLikesCount = 0

  for (const post of posts) {
    const value = interactionsOf(post)
    if (value !== null) interactions.push(value)
    if (post.viewCount !== null) views.push(post.viewCount)
    if (post.likeCount === null) hiddenLikesCount += 1
    if (post.caption) captionLengths.push(post.caption.length)

    const format = formats.get(post.format) ?? emptyBucket()
    addToBucket(format, value)
    formats.set(post.format, format)

    const { weekday, hour } = zonedWeekdayAndHour(post.publishedAt)
    addToBucket(weekdays[weekday], value)
    addToBucket(dayparts.get(daypartOf(hour)) as Bucket, value)

    for (const tag of extractHashtags(post.caption)) {
      const bucket = hashtags.get(tag) ?? emptyBucket()
      addToBucket(bucket, value)
      hashtags.set(tag, bucket)
    }
  }

  const avgInteractions = average(interactions)
  const followers = options.followersCount

  return {
    postsCount: posts.length,
    postsPerWeek: round((posts.length / options.rangeDays) * 7, 1) ?? 0,
    avgInteractions: round(avgInteractions),
    engagementRate:
      avgInteractions !== null && followers && followers > 0
        ? round((avgInteractions / followers) * 100)
        : null,
    avgViews: round(average(views)),
    hiddenLikesCount,
    avgCaptionLength: round(average(captionLengths), 0),
    formats: [...formats.entries()]
      .map(([format, bucket]) => ({
        format,
        share: round((bucket.postsCount / posts.length) * 100, 1) ?? 0,
        ...bucketStats(bucket),
      }))
      .sort((a, b) => b.postsCount - a.postsCount),
    weekdays: weekdays.map((bucket, weekday) => ({
      weekday,
      ...bucketStats(bucket),
    })),
    dayparts: DAYPARTS.map((daypart) => ({
      daypart,
      ...bucketStats(dayparts.get(daypart) as Bucket),
    })),
    hashtags: [...hashtags.entries()]
      .map(([tag, bucket]) => ({ tag, ...bucketStats(bucket) }))
      .sort(
        (a, b) =>
          b.postsCount - a.postsCount ||
          (b.avgInteractions ?? 0) - (a.avgInteractions ?? 0),
      )
      .slice(0, TOP_HASHTAGS),
    topPosts: [...posts]
      .sort((a, b) => rankScore(b) - rankScore(a))
      .slice(0, TOP_POSTS)
      .map(toSocialPostDTO),
  }
}

/** Bucket with the highest average among those with enough posts. */
function bestOf<
  T extends { postsCount: number; avgInteractions: number | null },
>(items: T[]): T | null {
  let best: T | null = null
  for (const item of items) {
    if (item.postsCount < MIN_POSTS_FOR_PATTERN) continue
    if (item.avgInteractions === null) continue
    if (!best || item.avgInteractions > (best.avgInteractions ?? 0)) best = item
  }
  return best
}

const nf = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

function times(ratio: number): string {
  return `${nf.format(ratio)}×`
}

/**
 * Comparative reading of the window, as short pt-BR sentences for the
 * screen and as grounding for the ideas prompt. Fixed rules, no AI: each
 * insight appears only when the data supports it.
 */
export function buildCompetitorInsights(input: {
  competitorName: string
  competitor: CrmPostStatsDTO
  own: CrmPostStatsDTO | null
}): CrmCompetitorInsightDTO[] {
  const { competitorName: name, competitor, own } = input
  const insights: CrmCompetitorInsightDTO[] = []

  if (competitor.postsCount === 0) return insights

  if (own) {
    const diff = competitor.postsPerWeek - own.postsPerWeek
    insights.push({
      key: 'frequency',
      tone: diff > 0.5 ? 'negative' : diff < -0.5 ? 'positive' : 'neutral',
      text: `${name} publica ${nf.format(competitor.postsPerWeek)} posts/semana; você, ${nf.format(own.postsPerWeek)}.`,
    })

    if (competitor.engagementRate !== null && own.engagementRate !== null) {
      const ahead = own.engagementRate >= competitor.engagementRate
      insights.push({
        key: 'engagement',
        tone: ahead ? 'positive' : 'negative',
        text: `Engajamento médio por post: ${nf.format(own.engagementRate)}% seu contra ${nf.format(competitor.engagementRate)}% de ${name}.`,
      })
    }
  }

  const bestFormat = bestOf(competitor.formats)
  if (
    bestFormat &&
    competitor.formats.length > 1 &&
    competitor.avgInteractions &&
    bestFormat.avgInteractions
  ) {
    const ratio = bestFormat.avgInteractions / competitor.avgInteractions
    const label = CRM_SOCIAL_POST_FORMAT_LABELS[bestFormat.format]
    const ownUses = own?.formats.some((f) => f.format === bestFormat.format)
    if (ratio >= 1.2) {
      insights.push({
        key: 'best-format',
        tone: own && !ownUses ? 'negative' : 'neutral',
        text:
          own && !ownUses
            ? `${label} rende ${times(ratio)} a média de ${name}, e você não publicou nenhum ${label.toLowerCase()} no período.`
            : `${label} é o formato que mais rende para ${name}: ${times(ratio)} a média do perfil.`,
      })
    }
  }

  const bestWeekday = bestOf(competitor.weekdays)
  if (bestWeekday) {
    insights.push({
      key: 'best-weekday',
      tone: 'neutral',
      text: `Os posts de ${name} rendem mais ${WEEKDAY_LABELS[bestWeekday.weekday]}.`,
    })
  }

  const bestDaypart = bestOf(competitor.dayparts)
  if (bestDaypart) {
    insights.push({
      key: 'best-daypart',
      tone: 'neutral',
      text: `Melhor horário de ${name}: ${DAYPART_LABELS[bestDaypart.daypart]}.`,
    })
  }

  if (own) {
    const ownTags = new Set(own.hashtags.map((h) => h.tag))
    const missing = competitor.hashtags
      .filter(
        (h) => h.postsCount >= MIN_POSTS_FOR_PATTERN && !ownTags.has(h.tag),
      )
      .slice(0, 3)
    if (missing.length > 0) {
      insights.push({
        key: 'hashtags-gap',
        tone: 'neutral',
        text: `Hashtags recorrentes de ${name} que você não usa: ${missing.map((h) => `#${h.tag}`).join(', ')}.`,
      })
    }
  }

  return insights
}
