import type { ModuleKind } from './workspace-connection'

export interface WorkspaceModuleAccessDTO {
  id: string
  workspaceId: string
  module: ModuleKind
  enabled: boolean
  grantedById: string
  createdAt: string
  updatedAt: string
  /**
   * Seeds that failed while granting the module, worded in pt-BR for display.
   * A failing seed does not block the grant (that decision stands), but the
   * failure used to go only to the log: whoever enabled the module got a clean
   * success and the module stayed half-configured — which is how a workspace
   * ended up with no ITIL phase at all and a blank kanban. Empty when every
   * seed succeeded.
   */
  seedWarnings: string[]
}

/** Visão completa dos 3 módulos para um workspace, incluindo os nunca concedidos. */
export interface WorkspaceModuleAccessSummaryDTO {
  module: ModuleKind
  enabled: boolean
  grantedById: string | null
  updatedAt: string | null
}
