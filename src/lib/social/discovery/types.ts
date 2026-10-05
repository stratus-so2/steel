/** Métricas públicas descobertas de um perfil de terceiro (concorrente). */
export type DiscoveredProfile = {
  externalName: string | null
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  postsCount: number | null
  profileUrl: string | null
}

/** Métricas da própria conta conectada (contraparte de `DiscoveredProfile`). */
export type OwnMetrics = {
  followersCount: number
  postsCount: number | null
}

/** Public post collected from a competitor or the own account, normalized. */
export type DiscoveredPost = {
  externalId: string
  format: 'IMAGE' | 'CAROUSEL' | 'VIDEO' | 'REELS' | 'SHORT'
  caption: string | null
  permalink: string | null
  likeCount: number | null
  commentsCount: number | null
  viewCount: number | null
  publishedAt: Date
}
