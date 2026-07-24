import { createId } from '@paralleldrive/cuid2'
import type {
  CrmWorkflow,
  CrmWorkflowRun,
  CrmWorkflowRunStep,
  CrmWorkflowVersion,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import type { CrmWorkflowDefinition } from '@/src/schemas/crm-workflow.schema'

export const FAKE_WORKFLOW_DEFINITION: CrmWorkflowDefinition = {
  trigger: {
    id: 'trigger',
    position: { x: 0, y: 0 },
    data: { type: 'launch-manually', inputs: [] },
  },
  nodes: [
    {
      id: 'n1',
      position: { x: 200, y: 0 },
      data: {
        type: 'create-record',
        entity: 'task',
        fields: { title: 'Ligar para o lead' },
      },
    },
  ],
  edges: [{ id: 'e1', source: 'trigger', target: 'n1' }],
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
    workspaceId: createId(),
    createdById: createId(),
    updatedById: null,
    activeVersionId: null,
    lastRunAt: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides,
  }
}

export function createFakeCrmWorkflowVersion(
  overrides?: Partial<CrmWorkflowVersion>,
): CrmWorkflowVersion {
  const now = new Date()
  return {
    id: createId(),
    workflowId: createId(),
    version: 1,
    status: 'DRAFT',
    definition:
      FAKE_WORKFLOW_DEFINITION_JSON as CrmWorkflowVersion['definition'],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

export async function seedCrmWorkflow(
  workspaceId: string,
  createdById: string,
  overrides?: Partial<Pick<CrmWorkflow, 'name' | 'status' | 'deletedAt'>> & {
    definition?: Prisma.InputJsonValue
  },
) {
  const { definition, ...rest } = overrides ?? {}
  return prisma.crmWorkflow.create({
    data: {
      name: 'Seed Workflow',
      workspaceId,
      createdById,
      versions: {
        create: {
          version: 1,
          status: 'DRAFT',
          definition: definition ?? FAKE_WORKFLOW_DEFINITION_JSON,
        },
      },
      ...rest,
    },
    include: { versions: true },
  })
}

export function createFakeCrmWorkflowRun(
  overrides?: Partial<CrmWorkflowRun>,
): CrmWorkflowRun {
  const now = new Date()
  return {
    id: createId(),
    workflowId: createId(),
    versionId: createId(),
    status: 'PENDING',
    triggerType: 'LAUNCH_MANUALLY',
    triggerPayload: {},
    state: null,
    waitingStepId: null,
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
  versionId: string,
  overrides?: Partial<Pick<CrmWorkflowRun, 'status' | 'triggerType'>>,
) {
  return prisma.crmWorkflowRun.create({
    data: {
      workflowId,
      versionId,
      triggerType: 'LAUNCH_MANUALLY',
      ...overrides,
    },
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
    nodeType: 'create-record',
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
