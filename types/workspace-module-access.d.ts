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

/** Visão completa dos 3 módulos para um workspace, incluindo os nunca concedidos. */
export interface WorkspaceModuleAccessSummaryDTO {
  module: ModuleKind
  enabled: boolean
  grantedById: string | null
  updatedAt: string | null
}
