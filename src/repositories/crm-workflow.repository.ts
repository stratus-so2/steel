import { createId } from '@paralleldrive/cuid2'
import type {
  CrmWorkflow,
  CrmWorkflowRun,
  CrmWorkflowRunStatus,
  CrmWorkflowRunStep,
  CrmWorkflowRunStepStatus,
  CrmWorkflowStatus,
  CrmWorkflowTriggerType,
  Prisma,
} from '@prisma/client'
import { notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmWorkflowRepository = {
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

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmWorkflow>> {
    try {
      const workflow = await prisma.crmWorkflow.findFirst({
        where: { id, workspaceId, deletedAt: null },
      })
      if (!workflow) return err(notFound('CrmWorkflow'))
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow by id', error))
    }
  },

  async findByWebhookToken(webhookToken: string): Promise<Result<CrmWorkflow>> {
    try {
      const workflow = await prisma.crmWorkflow.findFirst({
        where: { webhookToken, deletedAt: null },
      })
      if (!workflow) return err(notFound('CrmWorkflow'))
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow by webhook token', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    name: string
    description?: string
    triggerType: CrmWorkflowTriggerType
    definition: Prisma.InputJsonValue
  }): Promise<Result<CrmWorkflow>> {
    try {
      const workflow = await prisma.crmWorkflow.create({
        data: {
          ...data,
          webhookToken:
            data.triggerType === 'WEBHOOK' ? `wfh_${createId()}` : undefined,
        },
      })
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to create CRM workflow', error))
    }
  },

  async update(
    id: string,
    data: {
      name?: string
      description?: string
      triggerType?: CrmWorkflowTriggerType
      definition?: Prisma.InputJsonValue
      updatedById?: string
    },
  ): Promise<Result<CrmWorkflow>> {
    try {
      let webhookToken: string | undefined
      if (data.triggerType === 'WEBHOOK') {
        const current = await prisma.crmWorkflow.findUnique({
          where: { id },
          select: { webhookToken: true },
        })
        webhookToken = current?.webhookToken ?? `wfh_${createId()}`
      }

      const workflow = await prisma.crmWorkflow.update({
        where: { id },
        data: { ...data, webhookToken },
      })
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to update CRM workflow', error))
    }
  },

  async setStatus(
    id: string,
    status: CrmWorkflowStatus,
  ): Promise<Result<CrmWorkflow>> {
    try {
      const workflow = await prisma.crmWorkflow.update({
        where: { id },
        data: { status },
      })
      return ok(workflow)
    } catch (error) {
      return err(dbError('Failed to update CRM workflow status', error))
    }
  },

  async touchLastRunAt(id: string): Promise<Result<void>> {
    try {
      await prisma.crmWorkflow.update({
        where: { id },
        data: { lastRunAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to touch CRM workflow lastRunAt', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmWorkflow.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM workflow', error))
    }
  },
}

export const CrmWorkflowRunRepository = {
  async listByWorkflow(workflowId: string): Promise<Result<CrmWorkflowRun[]>> {
    try {
      const runs = await prisma.crmWorkflowRun.findMany({
        where: { workflowId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(runs)
    } catch (error) {
      return err(dbError('Failed to list CRM workflow runs', error))
    }
  },

  async findById(
    id: string,
    workflowId: string,
  ): Promise<Result<CrmWorkflowRun & { steps: CrmWorkflowRunStep[] }>> {
    try {
      const run = await prisma.crmWorkflowRun.findFirst({
        where: { id, workflowId },
        include: { steps: { orderBy: { createdAt: 'asc' } } },
      })
      if (!run) return err(notFound('CrmWorkflowRun'))
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to find CRM workflow run by id', error))
    }
  },

  async create(data: {
    workflowId: string
    triggerType: CrmWorkflowTriggerType
    triggerPayload: Prisma.InputJsonValue
    startedById?: string
  }): Promise<Result<CrmWorkflowRun>> {
    try {
      const run = await prisma.crmWorkflowRun.create({
        data: { ...data, status: 'RUNNING', startedAt: new Date() },
      })
      return ok(run)
    } catch (error) {
      return err(dbError('Failed to create CRM workflow run', error))
    }
  },

  async finish(
    id: string,
    status: CrmWorkflowRunStatus,
    error?: string,
  ): Promise<Result<CrmWorkflowRun>> {
    try {
      const run = await prisma.crmWorkflowRun.update({
        where: { id },
        data: { status, error, finishedAt: new Date() },
      })
      return ok(run)
    } catch (updateError) {
      return err(dbError('Failed to finish CRM workflow run', updateError))
    }
  },
}

export const CrmWorkflowRunStepRepository = {
  async create(data: {
    runId: string
    nodeId: string
    nodeType: string
    input?: Prisma.InputJsonValue
  }): Promise<Result<CrmWorkflowRunStep>> {
    try {
      const step = await prisma.crmWorkflowRunStep.create({
        data: { ...data, status: 'RUNNING', startedAt: new Date() },
      })
      return ok(step)
    } catch (error) {
      return err(dbError('Failed to create CRM workflow run step', error))
    }
  },

  async finish(
    id: string,
    status: CrmWorkflowRunStepStatus,
    data: { output?: Prisma.InputJsonValue; error?: string },
  ): Promise<Result<CrmWorkflowRunStep>> {
    try {
      const step = await prisma.crmWorkflowRunStep.update({
        where: { id },
        data: { status, ...data, finishedAt: new Date() },
      })
      return ok(step)
    } catch (error) {
      return err(dbError('Failed to finish CRM workflow run step', error))
    }
  },
}
