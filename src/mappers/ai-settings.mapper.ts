import type { WorkspaceAiSettings } from '@prisma/client'
import {
  AI_MODEL_CATALOG,
  AI_PROVIDER_LABELS,
  AI_PROVIDERS,
  type AiModelKey,
  type AiProviderId,
  DEFAULT_AI_MODEL_KEY,
  DEFAULT_MONTHLY_QUOTA_USD,
  DEFAULT_USD_PER_1K_TOKENS,
  isAiModelKey,
} from '@/src/lib/ai/models'
import { isQuotaExceeded, remainingUsd } from '@/src/lib/ai/quota'
import type { AiUsageTotals } from '@/src/repositories/ai-settings.repository'
import type { WorkspaceAiSettingsDTO } from '@/types/ai-settings'

/** Ajustes efetivos: a linha salva ou, sem linha, os padrões da plataforma. */
export interface EffectiveAiSettings {
  enabledModels: AiModelKey[]
  crmAssistantModel: AiModelKey
  whatsappReplyModel: AiModelKey
  whatsappSentimentModel: AiModelKey
  monthlyQuotaUsd: number
  usdPer1kTokens: number
}

function modelOrDefault(key: string): AiModelKey {
  return isAiModelKey(key) ? key : DEFAULT_AI_MODEL_KEY
}

export function toEffectiveAiSettings(
  row: WorkspaceAiSettings | null,
): EffectiveAiSettings {
  if (!row) {
    return {
      enabledModels: AI_MODEL_CATALOG.map((m) => m.key),
      crmAssistantModel: DEFAULT_AI_MODEL_KEY,
      whatsappReplyModel: DEFAULT_AI_MODEL_KEY,
      whatsappSentimentModel: DEFAULT_AI_MODEL_KEY,
      monthlyQuotaUsd: DEFAULT_MONTHLY_QUOTA_USD,
      usdPer1kTokens: DEFAULT_USD_PER_1K_TOKENS,
    }
  }
  return {
    // Descarta chaves que saíram do catálogo (modelo descontinuado).
    enabledModels: row.enabledModels.filter(isAiModelKey),
    crmAssistantModel: modelOrDefault(row.crmAssistantModel),
    whatsappReplyModel: modelOrDefault(row.whatsappReplyModel),
    whatsappSentimentModel: modelOrDefault(row.whatsappSentimentModel),
    monthlyQuotaUsd: row.monthlyQuotaUsd.toNumber(),
    usdPer1kTokens: row.usdPer1kTokens.toNumber(),
  }
}

export function toWorkspaceAiSettingsDTO(input: {
  workspaceId: string
  settings: EffectiveAiSettings
  usage: AiUsageTotals
  periodStart: Date
  userPreference: string | null
  canManage: boolean
  isProviderAvailable: (provider: AiProviderId) => boolean
}): WorkspaceAiSettingsDTO {
  const { settings, usage } = input
  const enabled = new Set<string>(settings.enabledModels)
  const usedUsd = Math.round(usage.costUsd * 100) / 100

  return {
    workspaceId: input.workspaceId,
    providers: AI_PROVIDERS.map((id) => ({
      id,
      label: AI_PROVIDER_LABELS[id],
      available: input.isProviderAvailable(id),
    })),
    models: AI_MODEL_CATALOG.map((m) => ({
      key: m.key,
      provider: m.provider,
      model: m.model,
      label: m.label,
      available: input.isProviderAvailable(m.provider),
      enabled: enabled.has(m.key),
    })),
    enabledModels: settings.enabledModels,
    crmAssistantModel: settings.crmAssistantModel,
    whatsappReplyModel: settings.whatsappReplyModel,
    whatsappSentimentModel: settings.whatsappSentimentModel,
    monthlyQuotaUsd: settings.monthlyQuotaUsd,
    usdPer1kTokens: settings.usdPer1kTokens,
    usage: {
      periodStart: input.periodStart.toISOString(),
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      usedUsd,
      remainingUsd: remainingUsd(usage.costUsd, settings.monthlyQuotaUsd),
      exceeded: isQuotaExceeded(usage.costUsd, settings.monthlyQuotaUsd),
    },
    userPreference: input.userPreference,
    canManage: input.canManage,
  }
}
