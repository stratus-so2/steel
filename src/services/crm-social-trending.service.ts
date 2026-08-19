import { ok, type Result } from '@/src/lib/result'
import type { TrendingItem } from '@/src/schemas/crm-social-trending.schema'
import { assertMember } from './authz'
import {
  fetchActiveStories,
  fetchEnrichedMediaSince,
} from './crm-social-instagram.service'
import { getFreshAccessToken } from './crm-social-token'

/** Nunca deixa a divisão de score explodir pra posts de segundos atrás. */
const MIN_HOURS_SINCE_POSTED = 1 / 60

function isToday(iso: string): boolean {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return false
  const now = new Date()
  return (
    t.getFullYear() === now.getFullYear() &&
    t.getMonth() === now.getMonth() &&
    t.getDate() === now.getDate()
  )
}

function startOfTodayMs(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

/**
 * Busca os posts de hoje do TikTok via API real da plataforma. O Steel não
 * tem um cliente de API do TikTok (nenhuma integração OAuth por plataforma
 * foi implementada — ver Fase 13 do plano), então esta função sempre
 * retorna lista vazia até essa integração existir.
 */
async function tiktokToday(): Promise<TrendingItem[]> {
  return []
}

function hoursSince(iso: string): number {
  return Math.max(
    (Date.now() - new Date(iso).getTime()) / 3_600_000,
    MIN_HOURS_SINCE_POSTED,
  )
}

/**
 * Posts de hoje do Instagram — feed, reels e carrosséis (via
 * `fetchEnrichedMediaSince`, mesma base de `getWeeklyEngagement`) mais
 * stories ativas (via `fetchActiveStories`, com alcance como métrica já que
 * stories não têm like/comment público). Vem direto da Graph API da conta,
 * então cobre qualquer post feito na conta — publicado pelo Steel ou não.
 * Sem conta conectada, sem escopo suficiente, ou qualquer erro: lista
 * vazia — best-effort, não derruba o ranking do TikTok.
 */
async function instagramToday(workspaceId: string): Promise<TrendingItem[]> {
  const fresh = await getFreshAccessToken(workspaceId, 'INSTAGRAM')
  if (!fresh.ok) return []

  const [media, stories] = await Promise.all([
    fetchEnrichedMediaSince(
      fresh.value.accessToken,
      fresh.value.connection.externalAccountId,
      startOfTodayMs(),
    ),
    fetchActiveStories(
      fresh.value.accessToken,
      fresh.value.connection.externalAccountId,
    ),
  ])

  const mediaItems: TrendingItem[] = media.ok
    ? media.value.map((m) => ({
        id: m.id,
        platform: 'INSTAGRAM',
        thumbnailUrl: m.thumbnailUrl ?? m.mediaUrl,
        caption: m.caption,
        permalink: m.permalink,
        postedAt: m.timestamp,
        views: null,
        likes: m.likeCount,
        comments: m.commentsCount,
        shares: null,
        saved: m.saved,
        score: m.engagementScore / hoursSince(m.timestamp),
      }))
    : []

  const storyItems: TrendingItem[] = stories.ok
    ? stories.value
        .filter((s) => isToday(s.timestamp))
        .map((s) => ({
          id: s.id,
          platform: 'INSTAGRAM',
          thumbnailUrl: s.mediaUrl,
          caption: null,
          permalink: s.permalink,
          postedAt: s.timestamp,
          views: s.reach,
          likes: 0,
          comments: 0,
          shares: null,
          saved: null,
          score: s.reach / hoursSince(s.timestamp),
        }))
    : []

  return [...mediaItems, ...storyItems]
}

export const CrmSocialTrendingService = {
  /**
   * Ranking dos posts de hoje (TikTok + Instagram) por velocidade de
   * engajamento: `(views + interações) / horas desde a publicação`. Contas
   * não conectadas ou com erro contribuem lista vazia — não derruba o
   * ranking das demais.
   */
  async getTodayRanking(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<TrendingItem[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const [tiktok, instagram] = await Promise.all([
      tiktokToday(),
      instagramToday(workspaceId),
    ])

    const items = [...tiktok, ...instagram]
      .filter((item) => isToday(item.postedAt))
      .sort((a, b) => b.score - a.score)

    return ok(items)
  },
}
