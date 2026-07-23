import { createId } from '@paralleldrive/cuid2'
import type {
  CrmWorkflow,
  CrmWorkflowRun,
  CrmWorkflowRunStep,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmWorkflowDefinitionDTO } from '@/src/schemas/crm-workflow.schema'

export const FAKE_WORKFLOW_DEFINITION: CrmWorkflowDefinitionDTO = {
  nodes: [
    { id: 'n1', type: 'CREATE_TASK', config: { title: 'Ligar para o lead' } },
  ],
}

export const FAKE_WORKFLOW_DEFINITION_JSON =
  FAKE_WORKFLOW_DEFINITION as unknown as Prisma.InputJsonValue

export function createFakeCrmWorkflow(
  overrides?: Partial<CrmWorkflow>,
): CrmWorkflow {
  const now = new Date()
  return {
    id: createId(),
    name: 'Boas-vindas',
    description: null,
    status: 'DRAFT',
    triggerType: 'MANUAL',
    webhookToken: null,
    definition: FAKE_WORKFLOW_DEFINITION_JSON as CrmWorkflow['definition'],
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export async function seedCrmWorkflow(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<
    Pick<CrmWorkflow, 'name' | 'status' | 'triggerType' | 'deletedAt'>
  >,
) {
  return prisma.crmWorkflow.create({
    data: {
      name: 'Seed Workflow',
      triggerType: 'MANUAL',
      definition: FAKE_WORKFLOW_DEFINITION_JSON,
      workspaceId,
      createdById,
      ...overrides,
    },
  })
}

export function createFakeCrmWorkflowRun(
  overrides?: Partial<CrmWorkflowRun>,
): CrmWorkflowRun {
  const now = new Date()
  return {
    id: createId(),
    workflowId: createId(),
    status: 'PENDING',
    triggerType: 'MANUAL',
    triggerPayload: {},
    startedById: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmWorkflowRun(
  workflowId: string,
  overrides?: Partial<Pick<CrmWorkflowRun, 'status' | 'triggerType'>>,
) {
  return prisma.crmWorkflowRun.create({
    data: { workflowId, triggerType: 'MANUAL', ...overrides },
  })
}

export function createFakeCrmWorkflowRunStep(
  overrides?: Partial<CrmWorkflowRunStep>,
): CrmWorkflowRunStep {
  const now = new Date()
  return {
    id: createId(),
    runId: createId(),
    nodeId: 'n1',
    nodeType: 'CREATE_TASK',
    status: 'PENDING',
    input: null,
    output: null,
    error: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}
