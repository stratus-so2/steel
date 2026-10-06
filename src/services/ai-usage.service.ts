import type { AiUsageFeature } from '@prisma/client'
import { logger } from '@/lib/axiom/logger'
import { aiProviderUnavailable, aiQuotaExceeded } from '@/src/errors'
import {
  type AiModelDefinition,
  type AiProvider,
  type AiUsageTokens,
  findAiModel,
  getAiProvider,
} from '@/src/lib/ai'
import {
  currentPeriodStart,
  isQuotaExceeded,
  tokensToUsd,
} from '@/src/lib/ai/quota'
import { err, ok, type Result } from '@/src/lib/result'
import {
  type EffectiveAiSettings,
  toEffectiveAiSettings,
} from '@/src/mappers/ai-settings.mapper'
import {
  AiUsageRepository,
  UserAiPreferenceRepository,
  WorkspaceAiSettingsRepository,
} from '@/src/repositories/ai-settings.repository'
import { AI_FEATURE_SETTING_FIELDS, isModelUsable } from './ai-settings.service'

/**
 * Modelo padrão de cada funcionalidade. As do ServiceDesk ainda não têm
 * seletor próprio em Ajustes > Steel IA e herdam o de uma equivalente:
 * copiloto (conversa com o agente) = assistente do CRM; pré-atendimento
 * (conversa com o solicitante) = resposta automática do WhatsApp; triagem
 * (classificação) = análise de sentimento.
 */
const MODEL_FIELD_BY_FEATURE: Record<
  AiUsageFeature,
  keyof Pick<
    EffectiveAiSettings,
    'crmAssistantModel' | 'whatsappReplyModel' | 'whatsappSentimentModel'
  >
> = {
  ...AI_FEATURE_SETTING_FIELDS,
  SERVICEDESK_COPILOT: 'crmAssistantModel',
  SERVICEDESK_PRE_SERVICE: 'whatsappReplyModel',
  SERVICEDESK_TRIAGE: 'whatsappSentimentModel',
  // Steel AI reuses the assistant model setting (the CRM widget is gone).
  STEEL_ASSISTANT: 'crmAssistantModel',
  STEEL_AGENT: 'crmAssistantModel',
}

/** Features where the user's own model preference applies. */
const USER_PREFERENCE_FEATURES = new Set<AiUsageFeature>([
  'CRM_ASSISTANT',
  'STEEL_ASSISTANT',
])

export interface PreparedAiCall {
  feature: AiUsageFeature
  provider: AiProvider
  model: AiModelDefinition
  usdPer1kTokens: number
}

/**
 * Porta de entrada de toda chamada de IA do produto: resolve o provedor/
 * modelo e aplica a cota mensal *antes* da chamada; depois dela, `record`
 * lança o consumo no livro-razão (base da cota). Sem autorização aqui — o
 * chamador (service com usuário, ou job em background) já validou o escopo.
 */
export const AiUsageService = {
  /**
   * Ordem de resolução do modelo:
   *  1. preferência do usuário (só nos assistentes conversacionais — Steel AI
   *     e o antigo assistente do CRM; jobs em background não têm usuário e
   *     usam o padrão do workspace);
   *  2. padrão do workspace para a funcionalidade;
   *  3. primeiro modelo habilitado cujo provedor está disponível.
   * Candidatos desabilitados ou de provedor sem chave são pulados. Não
   * confere a cota — `prepare` faz isso.
   */
  async resolveModel(
    workspaceId: string,
    feature: AiUsageFeature,
    userId?: string | null,
  ): Promise<
    Result<{
      settings: EffectiveAiSettings
      model: AiModelDefinition | null
    }>
  > {
    const row = await WorkspaceAiSettingsRepository.findByWorkspace(workspaceId)
    if (!row.ok) return row
    const settings = toEffectiveAiSettings(row.value)

    const candidates: string[] = []
    if (USER_PREFERENCE_FEATURES.has(feature) && userId) {
      const preference = await UserAiPreferenceRepository.find(
        workspaceId,
        userId,
      )
      if (!preference.ok) return preference
      if (preference.value) candidates.push(preference.value.modelKey)
    }
    candidates.push(
      settings[MODEL_FIELD_BY_FEATURE[feature]],
      ...settings.enabledModels,
    )

    const key = candidates.find((candidate) =>
      isModelUsable(settings, candidate),
    )
    // isModelUsable() already guarantees the key is in the catalog.
    const model = key ? (findAiModel(key) as AiModelDefinition) : null
    return ok({ settings, model })
  },

  async prepare(
    workspaceId: string,
    feature: AiUsageFeature,
    userId?: string | null,
  ): Promise<Result<PreparedAiCall>> {
    const resolved = await AiUsageService.resolveModel(
      workspaceId,
      feature,
      userId,
    )
    if (!resolved.ok) return resolved
    const { settings, model } = resolved.value
    const provider = model ? getAiProvider(model.provider) : null
    if (!model || !provider) return err(aiProviderUnavailable())

    const usage = await AiUsageRepository.sumSince(
      workspaceId,
      currentPeriodStart(),
    )
    if (!usage.ok) return usage
    if (isQuotaExceeded(usage.value.costUsd, settings.monthlyQuotaUsd)) {
      logger.warn('ai.quota_exceeded', {
        component: 'AiUsageService',
        workspaceId,
        feature,
        usedUsd: usage.value.costUsd,
        quotaUsd: settings.monthlyQuotaUsd,
      })
      return err(
        aiQuotaExceeded(
          Math.round(usage.value.costUsd * 100) / 100,
          settings.monthlyQuotaUsd,
        ),
      )
    }

    return ok({
      feature,
      provider,
      model,
      usdPer1kTokens: settings.usdPer1kTokens,
    })
  },

  /**
   * Lança o consumo de uma interação (pode somar várias chamadas, ex.: o
   * loop de tools). Falha de escrita só é logada — a resposta já foi gerada.
   */
  async record(
    call: PreparedAiCall,
    input: {
      workspaceId: string
      userId: string | null
      usage: AiUsageTokens
    },
  ): Promise<void> {
    // Chamada que falhou antes de consumir qualquer token: nada a lançar.
    if (input.usage.inputTokens === 0 && input.usage.outputTokens === 0) {
      return
    }
    const costUsd = tokensToUsd(
      input.usage.inputTokens,
      input.usage.outputTokens,
      call.usdPer1kTokens,
    )
    const result = await AiUsageRepository.record({
      workspaceId: input.workspaceId,
      userId: input.userId,
      feature: call.feature,
      provider: call.model.provider,
      model: call.model.model,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      costUsd,
    })

    if (!result.ok) {
      logger.error('ai.usage_record_failed', {
        component: 'AiUsageService',
        workspaceId: input.workspaceId,
        feature: call.feature,
        message: result.error.message,
      })
      return
    }

    logger.info('ai.usage_recorded', {
      component: 'AiUsageService',
      workspaceId: input.workspaceId,
      feature: call.feature,
      provider: call.model.provider,
      model: call.model.model,
      inputTokens: input.usage.inputTokens,
      outputTokens: input.usage.outputTokens,
      costUsd,
    })
  },
}
