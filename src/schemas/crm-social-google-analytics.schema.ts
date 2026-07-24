import z from 'zod'

/**
 * Contratos da integração com o Google Analytics 4 (sobre a
 * `CrmSocialConnection` já existente). Read-only: overview (identidade +
 * totais de 28d) e insights (resumo + série diária).
 */

export const CrmSocialGoogleAnalyticsOverviewSchema = z.object({
  propertyId: z.string(), // "properties/<id>"
  propertyName: z.string(),
  accountName: z.string().nullable(),
  totals: z.object({
    activeUsers: z.number().int().nonnegative(),
    sessions: z.number().int().nonnegative(),
    screenPageViews: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
  }),
})

export type CrmSocialGoogleAnalyticsOverviewDTO = z.infer<
  typeof CrmSocialGoogleAnalyticsOverviewSchema
>

export const CrmSocialGoogleAnalyticsInsightsRangeSchema = z
  .enum(['7d', '28d', '90d'])
  .default('28d')

export type CrmSocialGoogleAnalyticsInsightsRange = z.infer<
  typeof CrmSocialGoogleAnalyticsInsightsRangeSchema
>

export const GOOGLE_ANALYTICS_INSIGHTS_RANGE_DAYS: Record<
  CrmSocialGoogleAnalyticsInsightsRange,
  number
> = {
  '7d': 7,
  '28d': 28,
  '90d': 90,
}

export const CrmSocialGoogleAnalyticsInsightsPointSchema = z.object({
  date: z.string(),
  activeUsers: z.number().int().nonnegative(),
  sessions: z.number().int().nonnegative(),
  screenPageViews: z.number().int().nonnegative(),
})

export type CrmSocialGoogleAnalyticsInsightsPointDTO = z.infer<
  typeof CrmSocialGoogleAnalyticsInsightsPointSchema
>

export const CrmSocialGoogleAnalyticsInsightsSchema = z.object({
  range: CrmSocialGoogleAnalyticsInsightsRangeSchema,
  startDate: z.string(),
  endDate: z.string(),
  totals: z.object({
    activeUsers: z.number().int().nonnegative(),
    sessions: z.number().int().nonnegative(),
    screenPageViews: z.number().int().nonnegative(),
    eventCount: z.number().int().nonnegative(),
  }),
  series: z.array(CrmSocialGoogleAnalyticsInsightsPointSchema),
})

export type CrmSocialGoogleAnalyticsInsightsDTO = z.infer<
  typeof CrmSocialGoogleAnalyticsInsightsSchema
>
