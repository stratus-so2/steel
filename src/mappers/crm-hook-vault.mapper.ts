import type { CrmHookVaultItem } from '@prisma/client'
import type { CrmHookVaultItemDTO } from '@/types/crm-hook-vault'

export function toCrmHookVaultItemDTO(
  item: CrmHookVaultItem,
): CrmHookVaultItemDTO {
  return {
    id: item.id,
    text: item.text,
    platform: item.platform,
    usageCount: item.usageCount,
    notes: item.notes,
    workspaceId: item.workspaceId,
    createdById: item.createdById,
    updatedById: item.updatedById,
    position: item.position,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}
