import type { ModuleKind } from './workspace-connection'

export interface CrmDashboardDTO {
  id: string
  title: string
  workspaceId: string
  module: ModuleKind
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}

export type CrmWidgetTypeDTO = 'CHART' | 'VIEW' | 'IFRAME' | 'RICH_TEXT'

export interface CrmDashboardWidgetDTO {
  id: string
  dashboardId: string
  type: CrmWidgetTypeDTO
  x: number
  y: number
  w: number
  h: number
  config: Record<string, unknown>
  createdAt: string
  updatedAt: string
}
