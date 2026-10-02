import type { WorkspaceModuleAccess } from '@prisma/client'
import type { WorkspaceModuleAccessDTO } from '@/types/workspace-module-access'

export function toWorkspaceModuleAccessDTO(
  access: WorkspaceModuleAccess,
  /** Seeds que falharam na liberação — ver `seedWarnings` no DTO. */
  seedWarnings: string[] = [],
): WorkspaceModuleAccessDTO {
  return {
    id: access.id,
    workspaceId: access.workspaceId,
    module: access.module,
    enabled: access.enabled,
    grantedById: access.grantedById,
    createdAt: access.createdAt.toISOString(),
    updatedAt: access.updatedAt.toISOString(),
    seedWarnings,
  }
}
