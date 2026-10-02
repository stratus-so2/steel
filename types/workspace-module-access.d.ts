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
   * Seeds que falharam ao liberar o módulo, em pt-BR. A liberação não é
   * bloqueada por um seed que falha (decisão mantida), mas antes a falha só
   * ia para o log: quem habilitava recebia sucesso e o módulo ficava pela
   * metade — foi assim que um workspace ficou sem nenhuma fase ITIL e com o
   * kanban em branco. Vazio quando tudo correu bem.
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
