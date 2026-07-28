import type { ModuleKind } from './workspace-connection'

export interface WorkspaceModuleAccessDTO {
  id: string
  workspaceId: string
  module: ModuleKind
  enabled: boolean
  grantedById: string
  createdAt: string
  updatedAt: string
}
