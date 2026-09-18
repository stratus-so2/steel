import type { CrmLeadOpenStage } from '@/src/schemas/crm-settings.schema'

export interface CrmSettingsDTO {
  workspaceId: string
  /** Etapa para onde um lead perdido volta ao ser reaberto. */
  leadReopenStage: CrmLeadOpenStage
  /** Validade padrão (dias) das propostas novas. */
  proposalValidityDays: number
  /** Avisar o responsável por e-mail quando a proposta expira. */
  notifyProposalExpiry: boolean
  /** `true` enquanto a workspace nunca salvou configurações (valores padrão). */
  isDefault: boolean
  updatedById: string | null
  updatedAt: string | null
}
