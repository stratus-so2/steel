import z from 'zod'

export const CRM_SOCIAL_PLATFORMS = [
  'FACEBOOK',
  'INSTAGRAM',
  'TIKTOK',
  'YOUTUBE',
  'GOOGLE_ANALYTICS',
  'TWITTER',
  'GOOGLE_ADS',
  'LINKEDIN',
] as const

/** Nome legível da plataforma (legenda de gráfico, opções de UI). */
export const CRM_SOCIAL_PLATFORM_LABELS: Record<
  (typeof CRM_SOCIAL_PLATFORMS)[number],
  string
> = {
  FACEBOOK: 'Facebook',
  INSTAGRAM: 'Instagram',
  TIKTOK: 'TikTok',
  YOUTUBE: 'YouTube',
  GOOGLE_ANALYTICS: 'Google Analytics',
  TWITTER: 'X (Twitter)',
  GOOGLE_ADS: 'Google Ads',
  LINKEDIN: 'LinkedIn',
}

/** Enum → slug minúsculo usado nas rotas/URLs (ex.: "FACEBOOK" → "facebook"). */
export function crmPlatformToSlug(
  platform: (typeof CRM_SOCIAL_PLATFORMS)[number],
): string {
  return platform.toLowerCase()
}

/** Slug de rota → enum, ou `null` se desconhecido. */
export function parseCrmPlatformSlug(
  slug: string,
): (typeof CRM_SOCIAL_PLATFORMS)[number] | null {
  const parsed = z.enum(CRM_SOCIAL_PLATFORMS).safeParse(slug.toUpperCase())
  return parsed.success ? parsed.data : null
}

// Registro manual (fluxo legado, sem OAuth) — mantido para contas já
// autorizadas fora do Steel. O fluxo principal agora é o handshake OAuth
// completo (ver app/api/social/connect|callback).
export const CreateCrmSocialConnectionSchema = z.object({
  platform: z.enum(CRM_SOCIAL_PLATFORMS),
  externalAccountId: z.string().min(1, 'ID da conta é obrigatório').max(200),
  accountName: z.string().max(200).optional(),
})

export type CreateCrmSocialConnectionDTO = z.infer<
  typeof CreateCrmSocialConnectionSchema
>

export const CreateCrmScheduledPostSchema = z.object({
  content: z.string().max(10_000).default(''),
  title: z.string().max(200).optional(),
  scheduledFor: z.coerce.date().optional(),
  platforms: z.array(z.enum(CRM_SOCIAL_PLATFORMS)).min(1),
})

export type CreateCrmScheduledPostDTO = z.infer<
  typeof CreateCrmScheduledPostSchema
>

export const UpdateCrmScheduledPostSchema = z.object({
  content: z.string().max(10_000).optional(),
  title: z.string().max(200).optional(),
  scheduledFor: z.coerce.date().optional(),
})

export type UpdateCrmScheduledPostDTO = z.infer<
  typeof UpdateCrmScheduledPostSchema
>
