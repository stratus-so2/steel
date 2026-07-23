import type { CrmIntegrationApiKey } from '@prisma/client'
import type { CrmIntegrationKeyDTO } from '@/types/crm-integration-key'

export function toCrmIntegrationKeyDTO(
  key: CrmIntegrationApiKey,
): CrmIntegrationKeyDTO {
  return {
    id: key.id,
    name: key.name,
    prefix: key.prefix,
    workspaceId: key.workspaceId,
    createdById: key.createdById,
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
    createdAt: key.createdAt.toISOString(),
    updatedAt: key.updatedAt.toISOString(),
  }
}
