import { ok, type Result } from '@/src/lib/result'
import type { TrendingItem } from '@/src/schemas/crm-social-trending.schema'
import { assertMember } from './authz'

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

/**
 * Busca os posts de hoje do TikTok via API real da plataforma. O Steel não
 * tem um cliente de API do TikTok (nenhuma integração OAuth por plataforma
 * foi implementada — ver Fase 13 do plano), então esta função sempre
 * retorna lista vazia até essa integração existir. A fórmula de score
 * (views + interações) / horas-desde-publicação é a mesma do original,
 * portada para reuso assim que houver dado real para alimentar.
 */
async function tiktokToday(): Promise<TrendingItem[]> {
  return []
}

/** Mesma limitação de `tiktokToday()`, para o Instagram. */
async function instagramToday(): Promise<TrendingItem[]> {
  return []
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
      instagramToday(),
    ])

    const items = [...tiktok, ...instagram]
      .filter((item) => isToday(item.postedAt))
      .sort((a, b) => b.score - a.score)

    return ok(items)
  },
}
