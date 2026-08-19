/** Métricas públicas descobertas de um perfil de terceiro (concorrente). */
export type DiscoveredProfile = {
  externalName: string | null
  avatarUrl: string | null
  bio: string | null
  followersCount: number
  postsCount: number | null
}

/** Métricas da própria conta conectada (contraparte de `DiscoveredProfile`). */
export type OwnMetrics = {
  followersCount: number
  postsCount: number | null
}
