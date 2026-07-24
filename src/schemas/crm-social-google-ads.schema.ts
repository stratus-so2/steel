import z from 'zod'

/**
 * Contratos da integração com o Google Ads (Google Ads API REST v23), sobre a
 * `CrmSocialConnection` já existente. Read-only: overview (totais dos
 * últimos 30d) e insights (série diária de campanhas).
 */

export const CrmSocialGoogleAdsOverviewSchema = z.object({
  customerId: z.string(),
  customerName: z.string().nullable(),
  currency: z.string(),
  totals: z.object({
    impressions: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
    costMicros: z.number().nonnegative(),
    conversions: z.number().nonnegative(),
    ctr: z.number().nonnegative(),
  }),
  activeCampaigns: z.number().int().nonnegative(),
})

export type CrmSocialGoogleAdsOverviewDTO = z.infer<
  typeof CrmSocialGoogleAdsOverviewSchema
>

export const CrmSocialGoogleAdsInsightsRangeSchema = z
  .enum(['7d', '30d', '90d'])
  .default('30d')

export type CrmSocialGoogleAdsInsightsRange = z.infer<
  typeof CrmSocialGoogleAdsInsightsRangeSchema
>

export const GOOGLE_ADS_INSIGHTS_RANGE_DAYS: Record<
  CrmSocialGoogleAdsInsightsRange,
  number
> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

export const CrmSocialGoogleAdsInsightsPointSchema = z.object({
  date: z.string(),
  impressions: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  costMicros: z.number().nonnegative(),
  conversions: z.number().nonnegative(),
})

export type CrmSocialGoogleAdsInsightsPointDTO = z.infer<
  typeof CrmSocialGoogleAdsInsightsPointSchema
>

export const CrmSocialGoogleAdsInsightsSchema = z.object({
  range: CrmSocialGoogleAdsInsightsRangeSchema,
  startDate: z.string(),
  endDate: z.string(),
  totals: z.object({
    impressions: z.number().int().nonnegative(),
    clicks: z.number().int().nonnegative(),
    costMicros: z.number().nonnegative(),
    conversions: z.number().nonnegative(),
  }),
  series: z.array(CrmSocialGoogleAdsInsightsPointSchema),
})

export type CrmSocialGoogleAdsInsightsDTO = z.infer<
  typeof CrmSocialGoogleAdsInsightsSchema
>
