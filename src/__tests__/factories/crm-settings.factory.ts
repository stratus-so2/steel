import { createId } from '@paralleldrive/cuid2'
import type { CrmSettings } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { CRM_SETTINGS_DEFAULTS } from '@/src/schemas/crm-settings.schema'
import type { CrmSettingsDTO } from '@/types/crm-settings'

export function createFakeCrmSettings(
  overrides?: Partial<CrmSettings>,
): CrmSettings {
  const now = new Date()
  return {
    id: createId(),
    workspaceId: createId(),
    ...CRM_SETTINGS_DEFAULTS,
    updatedById: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export function createFakeCrmSettingsDTO(
  overrides?: Partial<CrmSettingsDTO>,
): CrmSettingsDTO {
  return {
    workspaceId: createId(),
    ...CRM_SETTINGS_DEFAULTS,
    isDefault: true,
    updatedById: null,
    updatedAt: null,
    ...overrides,
  }
}

export async function seedCrmSettings(
  workspaceId: string,
  overrides?: Partial<
    Pick<
      CrmSettings,
      | 'leadReopenStage'
      | 'proposalValidityDays'
      | 'notifyProposalExpiry'
      | 'updatedById'
    >
  >,
) {
  return prisma.crmSettings.create({ data: { workspaceId, ...overrides } })
}
