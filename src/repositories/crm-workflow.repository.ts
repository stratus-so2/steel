import type {
  CrmWorkflow,
  CrmWorkflowRun,
  CrmWorkflowRunStatus,
  CrmWorkflowRunStep,
  CrmWorkflowRunStepStatus,
  CrmWorkflowStatus,
  CrmWorkflowTriggerType,
  CrmWorkflowVersion,
} from '@prisma/client'
import { Prisma } from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { CrmWorkflowDefinition } from '@/src/schemas/crm-workflow.schema'
import { dbError } from './db-error'

export type CrmWorkflowWithDraft = CrmWorkflow & {
  versions: CrmWorkflowVersion[]
}
export type CrmWorkflowWithActiveVersion = CrmWorkflow & {
  activeVersion: CrmWorkflowVersion | null
}

/** Acesso a dados de CrmWorkflow + criação do primeiro CrmWorkflowVersion (DRAFT). */
export const CrmWorkflowRepository = {
  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    description: string | null
    initialDefinition: CrmWorkflowDefinition
  }): Promise<Result<CrmWorkflowWithDraft>> {
    try {
      const created = await prisma.crmWorkflow.create({
        data: {
          name: data.name,
          description: data.description,
          workspace: { connect: { id: data.workspaceId } },
          createdBy: { connect: { id: data.createdById } },
          versions: {
            create: {
              version: 1,
              status: 'DRAFT',
              definition:
                data.initialDefinition as unknown as Prisma.JsonObject,
            },
          },
        },
        include: { versions: true },
      })
      return ok(created)
    } catch (error) {
      return err(dbError('Failed to create CRM workflow', error))
    }
  },

  async findById(id: string): Promise<Result<CrmWorkflow | null>> {
    try {
      const workflow = await prisma.crmWorkflow.findUnique({ where: { id } })
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow by id', error))
    }
  },

  async listByWorkspace(workspaceId: string): Promise<Result<CrmWorkflow[]>> {
    try {
      const workflows = await prisma.crmWorkflow.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      })
      return ok(workflows)
    } catch (error) {
      return err(dbError('Failed to list CRM workflows', error))
    }
  },

  async update(
    id: string,
    data: {
      updatedById: string
      name?: string
      description?: string | null
      status?: CrmWorkflowStatus
      activeVersionId?: string | null
      lastRunAt?: Date | null
    },
  ): Promise<Result<CrmWorkflow>> {
    try {
      const workflow = await prisma.crmWorkflow.update({ where: { id }, data })
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to update CRM workflow', error))
    }
  },

  async softDelete(
    id: string,
    updatedById: string,
  ): Promise<Result<CrmWorkflow>> {
    try {
      const workflow = await prisma.crmWorkflow.update({
        where: { id },
        data: { deletedAt: new Date(), status: 'DEACTIVATED', updatedById },
      })
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to delete CRM workflow', error))
    }
  },

  /** Workflows ACTIVE de um workspace, com versão ativa carregada — usado pro dispatch de record-is-*. */
  async findActiveByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmWorkflowWithActiveVersion[]>> {
    try {
      const list = await prisma.crmWorkflow.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          status: 'ACTIVE',
          activeVersionId: { not: null },
        },
        include: { activeVersion: true },
      })
      return ok(list)
    } catch (error) {
      return err(
        dbError('Failed to find active CRM workflows by workspace', error),
      )
    }
  },

  /** Cross-workspace: todos os workflows ACTIVE — usado pelo scheduler de cron. */
  async findAllActive(): Promise<Result<CrmWorkflowWithActiveVersion[]>> {
    try {
      const list = await prisma.crmWorkflow.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          activeVersionId: { not: null },
        },
        include: { activeVersion: true },
      })
      return ok(list)
    } catch (error) {
      return err(dbError('Failed to find all active CRM workflows', error))
    }
  },

  /**
   * Todos os workflows ACTIVE com trigger `webhook`, filtrados em memória
   * pelo token no JSON da versão ativa (volume pequeno por workspace).
   */
  async findActiveByWebhookToken(
    token: string,
  ): Promise<Result<CrmWorkflowWithActiveVersion | null>> {
    try {
      const list = await prisma.crmWorkflow.findMany({
        where: {
          deletedAt: null,
          status: 'ACTIVE',
          activeVersionId: { not: null },
        },
        include: { activeVersion: true },
      })
      const match = list.find((wf) => {
        const trigger = (wf.activeVersion?.definition as { trigger?: unknown })
          ?.trigger as { data?: { type?: string; token?: string } } | undefined
        return trigger?.data?.type === 'webhook' && trigger.data.token === token
      })
      return ok(match ?? null)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow by webhook token', error))
    }
  },
}

export const CrmWorkflowVersionRepository = {
  async findById(id: string): Promise<Result<CrmWorkflowVersion | null>> {
    try {
      const version = await prisma.crmWorkflowVersion.findUnique({
        where: { id },
      })
      return ok(version)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow version by id', error))
    }
  },

  async findDraft(
    workflowId: string,
  ): Promise<Result<CrmWorkflowVersion | null>> {
    try {
      const version = await prisma.crmWorkflowVersion.findFirst({
        where: { workflowId, status: 'DRAFT' },
        orderBy: { version: 'desc' },
      })
      return ok(version)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow draft version', error))
    }
  },

  async findActive(
    workflowId: string,
  ): Promise<Result<CrmWorkflowVersion | null>> {
    try {
      const version = await prisma.crmWorkflowVersion.findFirst({
        where: { workflowId, status: 'ACTIVE' },
        orderBy: { version: 'desc' },
      })
      return ok(version)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow active version', error))
    }
  },

  async listByWorkflow(
    workflowId: string,
  ): Promise<Result<CrmWorkflowVersion[]>> {
    try {
      const list = await prisma.crmWorkflowVersion.findMany({
        where: { workflowId },
        orderBy: { version: 'desc' },
      })
      return ok(list)
    } catch (error) {
      return err(dbError('Failed to list CRM workflow versions', error))
    }
  },

  async updateDefinition(
    id: string,
    definition: CrmWorkflowDefinition,
  ): Promise<Result<CrmWorkflowVersion>> {
    try {
      const updated = await prisma.crmWorkflowVersion.update({
        where: { id },
        data: { definition: definition as unknown as Prisma.JsonObject },
      })
      return ok(updated)
    } catch (error) {
      return err(
        dbError('Failed to update CRM workflow version definition', error),
      )
    }
  },

  /**
   * Activate: arquiva a versão ACTIVE atual e promove o DRAFT para ACTIVE.
   * Cria um novo DRAFT vazio espelhando o `definition` recém-ativado, pra
   * que o usuário continue editando sem perder o estado.
   */
  async activateDraft(
    workflowId: string,
    draftId: string,
  ): Promise<
    Result<{ activated: CrmWorkflowVersion; newDraft: CrmWorkflowVersion }>
  > {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const draft = await tx.crmWorkflowVersion.findUnique({
          where: { id: draftId },
        })
        if (
          !draft ||
          draft.workflowId !== workflowId ||
          draft.status !== 'DRAFT'
        ) {
          throw new Error('draft-invalid')
        }
        await tx.crmWorkflowVersion.updateMany({
          where: { workflowId, status: 'ACTIVE' },
          data: { status: 'ARCHIVED' },
        })
        const activated = await tx.crmWorkflowVersion.update({
          where: { id: draftId },
          data: { status: 'ACTIVE' },
        })
        const newDraft = await tx.crmWorkflowVersion.create({
          data: {
            workflowId,
            version: activated.version + 1,
            status: 'DRAFT',
            definition: activated.definition as Prisma.InputJsonValue,
          },
        })
        await tx.crmWorkflow.update({
          where: { id: workflowId },
          data: { status: 'ACTIVE', activeVersionId: activated.id },
        })
        return { activated, newDraft }
      })
      return ok(result)
    } catch (error) {
      return err(dbError('Failed to activate CRM workflow draft', error))
    }
  },

  /** Discard: descarta as alterações no draft, copiando de volta da versão ACTIVE. */
  async discardDraft(workflowId: string): Promise<Result<CrmWorkflowVersion>> {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const active = await tx.crmWorkflowVersion.findFirst({
          where: { workflowId, status: 'ACTIVE' },
        })
        const draft = await tx.crmWorkflowVersion.findFirst({
          where: { workflowId, status: 'DRAFT' },
          orderBy: { version: 'desc' },
        })
        if (!draft) throw new Error('draft-missing')
        const definition = active
          ? (active.definition as Prisma.InputJsonValue)
          : ({
              trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
              nodes: [],
              edges: [],
            } as Prisma.InputJsonValue)
        return tx.crmWorkflowVersion.update({
          where: { id: draft.id },
          data: { definition },
        })
      })
      return ok(result)
    } catch (error) {
      return err(dbError('Failed to discard CRM workflow draft', error))
    }
  },
}

export const CrmWorkflowRunRepository = {
  async create(data: {
    workflowId: string
    versionId: string
    triggerType: CrmWorkflowTriggerType
    triggerPayload: Prisma.InputJsonValue
    startedById: string | null
  }): Promise<Result<CrmWorkflowRun>> {
    try {
      const run = await prisma.crmWorkflowRun.create({
        data: {
          workflow: { connect: { id: data.workflowId } },
          version: { connect: { id: data.versionId } },
          triggerType: data.triggerType,
          triggerPayload: data.triggerPayload,
          startedBy: data.startedById
            ? { connect: { id: data.startedById } }
            : undefined,
        },
      })
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to create CRM workflow run', error))
    }
  },

  async findById(
    id: string,
  ): Promise<
    Result<(CrmWorkflowRun & { steps: CrmWorkflowRunStep[] }) | null>
  > {
    try {
      const run = await prisma.crmWorkflowRun.findUnique({
        where: { id },
        include: { steps: { orderBy: { createdAt: 'asc' } } },
      })
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow run by id', error))
    }
  },

  async listByWorkflow(
    workflowId: string,
    limit = 50,
  ): Promise<Result<CrmWorkflowRun[]>> {
    try {
      const list = await prisma.crmWorkflowRun.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })
      return ok(list)
    } catch (error) {
      return err(dbError('Failed to list CRM workflow runs', error))
    }
  },

  async setStatus(
    id: string,
    status: CrmWorkflowRunStatus,
    extra: { error?: string | null; finishedAt?: Date | null } = {},
  ): Promise<Result<CrmWorkflowRun>> {
    try {
      const run = await prisma.crmWorkflowRun.update({
        where: { id },
        data: {
          status,
          error: extra.error,
          finishedAt: extra.finishedAt,
          startedAt: status === 'RUNNING' ? new Date() : undefined,
        },
      })
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to update CRM workflow run status', error))
    }
  },

  async createStep(data: {
    runId: string
    nodeId: string
    nodeType: string
    status?: CrmWorkflowRunStepStatus
    input?: Prisma.InputJsonValue
  }): Promise<Result<CrmWorkflowRunStep>> {
    try {
      const step = await prisma.crmWorkflowRunStep.create({
        data: {
          runId: data.runId,
          nodeId: data.nodeId,
          nodeType: data.nodeType,
          status: data.status ?? 'PENDING',
          input: data.input,
        },
      })
      return ok(step)
    } catch (error) {
      return err(dbError('Failed to create CRM workflow run step', error))
    }
  },

  async updateStep(
    id: string,
    data: {
      status?: CrmWorkflowRunStepStatus
      output?: Prisma.InputJsonValue
      error?: string | null
      startedAt?: Date | null
      finishedAt?: Date | null
    },
  ): Promise<Result<CrmWorkflowRunStep>> {
    try {
      const step = await prisma.crmWorkflowRunStep.update({
        where: { id },
        data,
      })
      return ok(step)
    } catch (error) {
      return err(dbError('Failed to update CRM workflow run step', error))
    }
  },

  /** Marca run como pausado em um form: persiste scope e o step alvo. */
  async pause(
    id: string,
    data: { state: Prisma.InputJsonValue; waitingStepId: string },
  ): Promise<Result<CrmWorkflowRun>> {
    try {
      const run = await prisma.crmWorkflowRun.update({
        where: { id },
        data: { state: data.state, waitingStepId: data.waitingStepId },
      })
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to pause CRM workflow run', error))
    }
  },

  async clearPause(id: string): Promise<Result<CrmWorkflowRun>> {
    try {
      const run = await prisma.crmWorkflowRun.update({
        where: { id },
        data: { state: Prisma.DbNull, waitingStepId: null },
      })
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to clear CRM workflow run pause', error))
    }
  },
}
