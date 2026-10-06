/** Provider price of a catalog model and what workspaces pay (× margin). */
export interface PlatformAiModelPriceDTO {
  key: string
  provider: 'openai' | 'anthropic'
  label: string
  /** Provider list price, US$ per 1M tokens. */
  inputUsdPer1M: number
  outputUsdPer1M: number
  cachedInputUsdPer1M: number | null
  /** Price × margin, US$ per 1M tokens. */
  chargedInputUsdPer1M: number
  chargedOutputUsdPer1M: number
}

/** Global admin view of the platform AI settings. */
export interface PlatformAiSettingsDTO {
  costMargin: number
  /** ISO date of the last change, null while on defaults. */
  updatedAt: string | null
  models: PlatformAiModelPriceDTO[]
}
