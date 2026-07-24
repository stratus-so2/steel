import { z } from 'zod'

/** Contrato do Forecast (previsão de receita por responsável e período). */

export const ForecastRowSchema = z.object({
  ownerId: z.string().nullable(),
  ownerName: z.string(),
  periodKey: z.string(),
  /** Receita já ganha (etapas WON) no período. */
  wonAmount: z.number(),
  /** Pipeline aberto ponderado: Σ(amount × probability/100). */
  weightedOpenAmount: z.number(),
  /** Previsão = ganho + pipeline ponderado. */
  forecastAmount: z.number(),
  openCount: z.number(),
  wonCount: z.number(),
  /** Meta do responsável no período (0 quando não definida). */
  quotaAmount: z.number(),
  /** forecast / meta em %, ou null quando não há meta. */
  attainmentPct: z.number().nullable(),
})

export const ForecastSchema = z.object({
  period: z.enum(['MONTH', 'QUARTER']),
  rows: z.array(ForecastRowSchema),
})

export const GetCrmForecastSchema = z.object({
  period: z.enum(['MONTH', 'QUARTER']).default('MONTH'),
})

export type ForecastRow = z.infer<typeof ForecastRowSchema>
export type ForecastDTO = z.infer<typeof ForecastSchema>
export type GetCrmForecastDTO = z.infer<typeof GetCrmForecastSchema>
