import type { WorkspaceModuleConnection } from '@prisma/client'
import type { WorkspaceConnectionDTO } from '@/types/workspace-connection'

export function toWorkspaceConnectionDTO(
  connection: WorkspaceModuleConnection,
): WorkspaceConnectionDTO {
  return {
    id: connection.id,
    workspaceId: connection.workspaceId,
    module: connection.module,
    host: connection.host,
    port: connection.port,
    username: connection.username,
    database: connection.database,
    sslEnabled: connection.sslEnabled,
    createdById: connection.createdById,
    createdAt: connection.createdAt.toISOString(),
    updatedAt: connection.updatedAt.toISOString(),
  }
}
