export interface AiProviderStatusDTO {
  id: 'openai' | 'anthropic'
  label: string
  /** `false` quando a chave de API da plataforma não está configurada. */
  available: boolean
}

export interface AiModelOptionDTO {
  key: string
  provider: 'openai' | 'anthropic'
  model: string
  label: string
  available: boolean
  enabled: boolean
}

export interface AiUsageSummaryDTO {
  /** Início do ciclo de cobrança (1º dia do mês, UTC). */
  periodStart: string
  inputTokens: number
  outputTokens: number
  usedUsd: number
  remainingUsd: number
  exceeded: boolean
}

export interface WorkspaceAiSettingsDTO {
  workspaceId: string
  providers: AiProviderStatusDTO[]
  models: AiModelOptionDTO[]
  enabledModels: string[]
  crmAssistantModel: string
  whatsappReplyModel: string
  whatsappSentimentModel: string
  monthlyQuotaUsd: number
  usdPer1kTokens: number
  usage: AiUsageSummaryDTO
  /** Modelo escolhido pelo usuário atual (`null` = segue o padrão). */
  userPreference: string | null
  /** O usuário atual pode alterar os ajustes do workspace (OWNER/ADMIN). */
  canManage: boolean
}
