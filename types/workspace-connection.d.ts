export type ModuleKind = 'SERVICE_DESK' | 'CRM' | 'COMMUNICATION'

export interface WorkspaceConnectionDTO {
  id: string
  workspaceId: string
  module: ModuleKind
  host: string
  port: number
  username: string
  database: string
  sslEnabled: boolean
  createdById: string
  createdAt: string
  updatedAt: string
}
