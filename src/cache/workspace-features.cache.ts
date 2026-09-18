import type { PlanTier } from '@/src/schemas/plan.schema'
import { createKeyedCache } from './_cache'

/**
 * Insumos (não o resultado) da resolução de features de um workspace: o
 * cálculo roda a cada leitura porque overrides podem expirar no meio do TTL.
 */
export interface WorkspaceFeatureSnapshot {
  plan: PlanTier
  overrides: { key: string; enabled: boolean; expiresAt: string | null }[]
}

/**
 * Invalidado ao gravar um override (`FeatureFlagService.setOverride`) e nas
 * trocas de plano (webhook de pagamento, fim de trial). O TTL curto (5 min)
 * cobre qualquer outro caminho que altere `activePlan`.
 */
export const WorkspaceFeaturesCache =
  createKeyedCache<WorkspaceFeatureSnapshot>({
    prefix: 'workspace-features:',
    ttl: 5 * 60,
    name: 'workspace_features',
  })
