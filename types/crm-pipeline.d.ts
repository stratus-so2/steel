export interface CrmPipelineDTO {
  id: string
  workspaceId: string
  name: string
  position: number
  isDefault: boolean
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

export type CrmStageCategoryDTO = 'OPEN' | 'WON' | 'LOST'

export interface CrmPipelineStageDTO {
  id: string
  pipelineId: string
  name: string
  position: number
  probability: number
  category: CrmStageCategoryDTO
  color: string | null
  createdAt: string
  updatedAt: string
}
