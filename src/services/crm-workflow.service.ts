import type { Prisma } from '@prisma/client'
import { auditMutation } from '@/lib/axiom/audit'
import { crmWorkflowNotActive } from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  toCrmWorkflowDTO,
  toCrmWorkflowRunDTO,
} from '@/src/mappers/crm-workflow.mapper'
import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
  CrmWorkflowRunStepRepository,
} from '@/src/repositories/crm-workflow.repository'
import type {
  CreateCrmWorkflowDTO,
  CrmWorkflowNodeType,
  UpdateCrmWorkflowDTO,
} from '@/src/schemas/crm-workflow.schema'
import type { CrmWorkflowDTO, CrmWorkflowRunDTO } from '@/types/crm-workflow'
import { assertMember } from './authz'
import { executeCrmWorkflowNode } from './crm-workflow-runner'

export const CrmWorkflowService = {
  async list(
    actorId: string,
    workspaceId: string,
  ): Promise<Result<CrmWorkflowDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmWorkflowRepository.listByWorkspace(workspaceId)
    if (!result.ok) return result

    return ok(result.value.map(toCrmWorkflowDTO))
  },

  async getById(
    actorId: string,
    workspaceId: string,
    workflowId: string,
  ): Promise<Result<CrmWorkflowDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmWorkflowRepository.findById(workflowId, workspaceId)
    if (!result.ok) return result

    return ok(toCrmWorkflowDTO(result.value))
  },

  async create(
    actorId: string,
    workspaceId: string,
    dto: CreateCrmWorkflowDTO,
  ): Promise<Result<CrmWorkflowDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const result = await CrmWorkflowRepository.create({
      workspaceId,
      createdById: actorId,
      name: dto.name,
      description: dto.description,
      triggerType: dto.triggerType,
      definition: dto.definition as unknown as Prisma.InputJsonValue,
    })

    if (!result.ok) {
      auditMutation({
        entity: 'crm_workflow',
        action: 'create',
        actorId,
        outcome: 'failure',
        reason: result.error.code,
      })
      return result
    }

    auditMutation({
      entity: 'crm_workflow',
      action: 'create',
      actorId,
      targetId: result.value.id,
    })

    return ok(toCrmWorkflowDTO(result.value))
  },

  async update(
    actorId: string,
    workspaceId: string,
    workflowId: string,
    dto: UpdateCrmWorkflowDTO,
  ): Promise<Result<CrmWorkflowDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmWorkflowRepository.findById(
      workflowId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmWorkflowRepository.update(workflowId, {
      name: dto.name,
      description: dto.description,
      triggerType: dto.triggerType,
      definition: dto.definition as unknown as
        | Prisma.InputJsonValue
        | undefined,
      updatedById: actorId,
    })
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_workflow',
      action: 'update',
      actorId,
      targetId: workflowId,
      meta: { fields: Object.keys(dto) },
    })

    return ok(toCrmWorkflowDTO(result.value))
  },

  async remove(
    actorId: string,
    workspaceId: string,
    workflowId: string,
  ): Promise<Result<void>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmWorkflowRepository.findById(
      workflowId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmWorkflowRepository.softDelete(workflowId)
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_workflow',
      action: 'delete',
      actorId,
      targetId: workflowId,
    })

    return ok(undefined)
  },

  async setActive(
    actorId: string,
    workspaceId: string,
    workflowId: string,
    active: boolean,
  ): Promise<Result<CrmWorkflowDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const existing = await CrmWorkflowRepository.findById(
      workflowId,
      workspaceId,
    )
    if (!existing.ok) return existing

    const result = await CrmWorkflowRepository.setStatus(
      workflowId,
      active ? 'ACTIVE' : 'DEACTIVATED',
    )
    if (!result.ok) return result

    auditMutation({
      entity: 'crm_workflow',
      action: 'update',
      actorId,
      targetId: workflowId,
      meta: { status: result.value.status },
    })

    return ok(toCrmWorkflowDTO(result.value))
  },

  async listRuns(
    actorId: string,
    workspaceId: string,
    workflowId: string,
  ): Promise<Result<CrmWorkflowRunDTO[]>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const workflow = await CrmWorkflowRepository.findById(
      workflowId,
      workspaceId,
    )
    if (!workflow.ok) return workflow

    const result = await CrmWorkflowRunRepository.listByWorkflow(workflowId)
    if (!result.ok) return result

    return ok(result.value.map((run) => toCrmWorkflowRunDTO(run)))
  },

  async runManually(
    actorId: string,
    workspaceId: string,
    workflowId: string,
    payload: Record<string, unknown> = {},
  ): Promise<Result<CrmWorkflowRunDTO>> {
    const membership = await assertMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const workflow = await CrmWorkflowRepository.findById(
      workflowId,
      workspaceId,
    )
    if (!workflow.ok) return workflow

    return runWorkflow(workflow.value, 'MANUAL', payload, actorId)
  },

  async runFromWebhook(
    workspaceId: string,
    workflowId: string,
    payload: Record<string, unknown>,
  ): Promise<Result<CrmWorkflowRunDTO>> {
    const workflow = await CrmWorkflowRepository.findById(
      workflowId,
      workspaceId,
    )
    if (!workflow.ok) return workflow
    if (
      workflow.value.triggerType !== 'WEBHOOK' ||
      workflow.value.status !== 'ACTIVE'
    ) {
      return err(crmWorkflowNotActive())
    }

    return runWorkflow(workflow.value, 'WEBHOOK', payload)
  },
}

async function runWorkflow(
  workflow: {
    id: string
    workspaceId: string
    createdById: string
    definition: unknown
  },
  triggerType: 'MANUAL' | 'WEBHOOK',
  payload: Record<string, unknown>,
  startedById?: string,
): Promise<Result<CrmWorkflowRunDTO>> {
  const runResult = await CrmWorkflowRunRepository.create({
    workflowId: workflow.id,
    triggerType,
    triggerPayload: payload as unknown as Prisma.InputJsonValue,
    startedById,
  })
  if (!runResult.ok) return runResult
  const run = runResult.value

  const definition = workflow.definition as {
    nodes: { id: string; type: string; config: Record<string, unknown> }[]
  }

  let failed = false
  for (const node of definition.nodes) {
    const step = await CrmWorkflowRunStepRepository.create({
      runId: run.id,
      nodeId: node.id,
      nodeType: node.type,
      input: node.config as unknown as Prisma.InputJsonValue,
    })
    if (!step.ok) {
      failed = true
      break
    }

    if (failed) {
      await CrmWorkflowRunStepRepository.finish(step.value.id, 'SKIPPED', {})
      continue
    }

    const execution = await executeCrmWorkflowNode(
      node.type as CrmWorkflowNodeType,
      node.config,
      {
        workspaceId: workflow.workspaceId,
        createdById: workflow.createdById,
        trigger: payload,
      },
    )

    if (execution.ok) {
      await CrmWorkflowRunStepRepository.finish(step.value.id, 'COMPLETED', {
        output: execution.output as never,
      })
    } else {
      failed = true
      await CrmWorkflowRunStepRepository.finish(step.value.id, 'FAILED', {
        error: execution.error,
      })
    }
  }

  const finished = await CrmWorkflowRunRepository.finish(
    run.id,
    failed ? 'FAILED' : 'COMPLETED',
    failed ? 'Um ou mais nodes falharam' : undefined,
  )
  if (!finished.ok) return finished

  await CrmWorkflowRepository.touchLastRunAt(workflow.id)

  return ok(toCrmWorkflowRunDTO(finished.value))
}
