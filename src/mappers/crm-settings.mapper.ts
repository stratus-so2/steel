import type { CrmSettings } from '@prisma/client'
import {
  CRM_SETTINGS_DEFAULTS,
  type CrmLeadOpenStage,
} from '@/src/schemas/crm-settings.schema'
import type { CrmSettingsDTO } from '@/types/crm-settings'

/** Linha salva (ou ausência dela, = valores padrão) → DTO. */
export function toCrmSettingsDTO(
  workspaceId: string,
  settings: CrmSettings | null,
): CrmSettingsDTO {
  if (!settings) {
    return {
      workspaceId,
      ...CRM_SETTINGS_DEFAULTS,
      isDefault: true,
      updatedById: null,
      updatedAt: null,
    }
  }
  return {
    workspaceId: settings.workspaceId,
    // O schema só aceita etapas abertas; CLOSED nunca chega a ser gravado.
    leadReopenStage: settings.leadReopenStage as CrmLeadOpenStage,
    proposalValidityDays: settings.proposalValidityDays,
    notifyProposalExpiry: settings.notifyProposalExpiry,
    isDefault: false,
    updatedById: settings.updatedById,
    updatedAt: settings.updatedAt.toISOString(),
  }
}
