import { z } from 'zod'

/**
 * Escopos: openid, profile, email, w_member_social. Insights avançados
 * (impressões, engajamento) exigem LinkedIn Marketing Partner — fora de
 * escopo, o overview expõe só dados de perfil via OIDC userinfo.
 */
export const CrmLinkedinOverviewSchema = z.object({
  personId: z.string(),
  name: z.string().nullable(),
  headline: z.string().nullable(),
  email: z.string().nullable(),
  picture: z.string().nullable(),
})

export type CrmLinkedinOverview = z.infer<typeof CrmLinkedinOverviewSchema>

export const CrmLinkedinPublishSchema = z.object({
  text: z.string().min(1).max(3000),
})

export type CrmLinkedinPublishInput = z.infer<typeof CrmLinkedinPublishSchema>

export const CrmLinkedinPublishResultSchema = z.object({
  postUrn: z.string(),
})

export type CrmLinkedinPublishResult = z.infer<
  typeof CrmLinkedinPublishResultSchema
>
