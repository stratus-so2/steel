import type {
  CrmWorkflow,
  CrmWorkflowRun,
  CrmWorkflowRunStep,
} from '@prisma/client'
import type { CrmWorkflowDefinitionDTO } from '@/src/schemas/crm-workflow.schema'
import type {
  CrmWorkflowDTO,
  CrmWorkflowRunDTO,
  CrmWorkflowRunStepDTO,
} from '@/types/crm-workflow'

export function toCrmWorkflowDTO(workflow: CrmWorkflow): CrmWorkflowDTO {
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description,
    status: workflow.status,
    triggerType: workflow.triggerType,
    webhookToken: workflow.webhookToken,
    definition: workflow.definition as unknown as CrmWorkflowDefinitionDTO,
    workspaceId: workflow.workspaceId,
    createdById: workflow.createdById,
    updatedById: workflow.updatedById,
    lastRunAt: workflow.lastRunAt?.toISOString() ?? null,
    createdAt: workflow.createdAt.toISOString(),
    updatedAt: workflow.updatedAt.toISOString(),
  }
}

export function toCrmWorkflowRunStepDTO(
  step: CrmWorkflowRunStep,
): CrmWorkflowRunStepDTO {
  return {
    id: step.id,
    runId: step.runId,
    nodeId: step.nodeId,
    nodeType: step.nodeType,
    status: step.status,
    input: step.input,
    output: step.output,
    error: step.error,
    startedAt: step.startedAt?.toISOString() ?? null,
    finishedAt: step.finishedAt?.toISOString() ?? null,
    createdAt: step.createdAt.toISOString(),
  }
}

export function toCrmWorkflowRunDTO(
  run: CrmWorkflowRun & { steps?: CrmWorkflowRunStep[] },
): CrmWorkflowRunDTO {
  return {
    id: run.id,
    workflowId: run.workflowId,
    status: run.status,
    triggerType: run.triggerType,
    triggerPayload: run.triggerPayload,
    startedById: run.startedById,
    error: run.error,
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    steps: run.steps?.map(toCrmWorkflowRunStepDTO),
  }
}
