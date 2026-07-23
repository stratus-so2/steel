import type { CrmWorkflowDefinitionDTO } from '@/src/schemas/crm-workflow.schema'

export type CrmWorkflowStatusDTO = 'DRAFT' | 'ACTIVE' | 'DEACTIVATED'
export type CrmWorkflowTriggerTypeDTO = 'MANUAL' | 'WEBHOOK'
export type CrmWorkflowRunStatusDTO =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
export type CrmWorkflowRunStepStatusDTO =
  | 'PENDING'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'SKIPPED'

export interface CrmWorkflowDTO {
  id: string
  name: string
  description: string | null
  status: CrmWorkflowStatusDTO
  triggerType: CrmWorkflowTriggerTypeDTO
  webhookToken: string | null
  definition: CrmWorkflowDefinitionDTO
  workspaceId: string
  createdById: string
  updatedById: string | null
  lastRunAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CrmWorkflowRunStepDTO {
  id: string
  runId: string
  nodeId: string
  nodeType: string
  status: CrmWorkflowRunStepStatusDTO
  input: unknown
  output: unknown
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
}

export interface CrmWorkflowRunDTO {
  id: string
  workflowId: string
  status: CrmWorkflowRunStatusDTO
  triggerType: CrmWorkflowTriggerTypeDTO
  triggerPayload: unknown
  startedById: string | null
  error: string | null
  startedAt: string | null
  finishedAt: string | null
  createdAt: string
  updatedAt: string
  steps?: CrmWorkflowRunStepDTO[]
}
