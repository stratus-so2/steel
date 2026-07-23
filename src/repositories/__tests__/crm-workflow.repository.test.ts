import { describe, expect, it } from 'vitest'
import {
  FAKE_WORKFLOW_DEFINITION,
  FAKE_WORKFLOW_DEFINITION_JSON,
  seedCrmWorkflow,
  seedCrmWorkflowRun,
} from '@/src/__tests__/factories/crm-workflow.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
  CrmWorkflowRunStepRepository,
} from '../crm-workflow.repository'

describe('CrmWorkflowRepository', () => {
  describe('listByWorkspace()', () => {
    it('should exclude soft-deleted workflows', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const kept = await seedCrmWorkflow(workspace.id, user.id)
      await seedCrmWorkflow(workspace.id, user.id, { deletedAt: new Date() })

      const list = expectOk(
        await CrmWorkflowRepository.listByWorkspace(workspace.id),
      )
      expect(list.map((w) => w.id)).toEqual([kept.id])
    })
  })

  describe('create()', () => {
    it('should persist the definition as json', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const workflow = expectOk(
        await CrmWorkflowRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Boas-vindas',
          triggerType: 'MANUAL',
          definition: FAKE_WORKFLOW_DEFINITION_JSON,
        }),
      )

      expect(workflow.definition).toEqual(FAKE_WORKFLOW_DEFINITION)
      expect(workflow.webhookToken).toBeNull()
    })

    it('should generate a webhookToken for WEBHOOK-triggered workflows', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const workflow = expectOk(
        await CrmWorkflowRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Webhook',
          triggerType: 'WEBHOOK',
          definition: FAKE_WORKFLOW_DEFINITION_JSON,
        }),
      )

      expect(workflow.webhookToken).toMatch(/^wfh_/)

      const found = expectOk(
        await CrmWorkflowRepository.findByWebhookToken(
          workflow.webhookToken as string,
        ),
      )
      expect(found.id).toBe(workflow.id)
    })
  })

  describe('setStatus()', () => {
    it('should update the workflow status', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)

      const updated = expectOk(
        await CrmWorkflowRepository.setStatus(workflow.id, 'ACTIVE'),
      )
      expect(updated.status).toBe('ACTIVE')
    })
  })
})

describe('CrmWorkflowRunRepository', () => {
  describe('create() & findById()', () => {
    it('should create a run and include its steps', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)

      const run = expectOk(
        await CrmWorkflowRunRepository.create({
          workflowId: workflow.id,
          triggerType: 'MANUAL',
          triggerPayload: { foo: 'bar' },
          startedById: user.id,
        }),
      )
      expect(run.status).toBe('RUNNING')

      const found = expectOk(
        await CrmWorkflowRunRepository.findById(run.id, workflow.id),
      )
      expect(found.steps).toEqual([])
    })
  })

  describe('finish()', () => {
    it('should mark the run completed', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      const run = await seedCrmWorkflowRun(workflow.id)

      const finished = expectOk(
        await CrmWorkflowRunRepository.finish(run.id, 'COMPLETED'),
      )
      expect(finished.status).toBe('COMPLETED')
      expect(finished.finishedAt).not.toBeNull()
    })
  })
})

describe('CrmWorkflowRunStepRepository', () => {
  describe('create() & finish()', () => {
    it('should create and complete a step', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      const run = await seedCrmWorkflowRun(workflow.id)

      const step = expectOk(
        await CrmWorkflowRunStepRepository.create({
          runId: run.id,
          nodeId: 'n1',
          nodeType: 'CREATE_TASK',
        }),
      )
      expect(step.status).toBe('RUNNING')

      const finished = expectOk(
        await CrmWorkflowRunStepRepository.finish(step.id, 'COMPLETED', {
          output: { taskId: 'abc' },
        }),
      )
      expect(finished.status).toBe('COMPLETED')
      expect(finished.output).toEqual({ taskId: 'abc' })
    })
  })
})
