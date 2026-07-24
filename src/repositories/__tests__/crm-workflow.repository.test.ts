import { describe, expect, it } from 'vitest'
import {
  FAKE_WORKFLOW_DEFINITION,
  seedCrmWorkflow,
  seedCrmWorkflowRun,
} from '@/src/__tests__/factories/crm-workflow.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
  CrmWorkflowVersionRepository,
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
    it('should create the workflow with its first DRAFT version', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])

      const workflow = expectOk(
        await CrmWorkflowRepository.create({
          workspaceId: workspace.id,
          createdById: user.id,
          name: 'Boas-vindas',
          description: null,
          initialDefinition: FAKE_WORKFLOW_DEFINITION,
        }),
      )

      expect(workflow.versions).toHaveLength(1)
      expect(workflow.versions[0].status).toBe('DRAFT')
      expect(workflow.versions[0].definition).toEqual(FAKE_WORKFLOW_DEFINITION)
      expect(workflow.activeVersionId).toBeNull()
    })
  })

  describe('update()', () => {
    it('should update the workflow status', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)

      const updated = expectOk(
        await CrmWorkflowRepository.update(workflow.id, {
          updatedById: user.id,
          status: 'ACTIVE',
        }),
      )
      expect(updated.status).toBe('ACTIVE')
    })
  })

  describe('findActiveByWebhookToken()', () => {
    it('should match a workflow whose active version has a webhook trigger with that token', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const definition = {
        trigger: {
          id: 'trigger',
          position: { x: 0, y: 0 },
          data: { type: 'webhook', token: 'tok_abc123' },
        },
        nodes: [],
        edges: [],
      }
      const workflow = await seedCrmWorkflow(workspace.id, user.id, {
        definition: definition as never,
      })
      const activated = expectOk(
        await CrmWorkflowVersionRepository.activateDraft(
          workflow.id,
          workflow.versions[0].id,
        ),
      )
      expect(activated.activated.status).toBe('ACTIVE')

      const found = expectOk(
        await CrmWorkflowRepository.findActiveByWebhookToken('tok_abc123'),
      )
      expect(found?.id).toBe(workflow.id)
    })
  })
})

describe('CrmWorkflowVersionRepository', () => {
  describe('activateDraft()', () => {
    it('should promote the draft to ACTIVE and create a new draft', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)

      const result = expectOk(
        await CrmWorkflowVersionRepository.activateDraft(
          workflow.id,
          workflow.versions[0].id,
        ),
      )
      expect(result.activated.status).toBe('ACTIVE')
      expect(result.newDraft.status).toBe('DRAFT')
      expect(result.newDraft.version).toBe(result.activated.version + 1)

      const wf = expectOk(await CrmWorkflowRepository.findById(workflow.id))
      expect(wf?.status).toBe('ACTIVE')
      expect(wf?.activeVersionId).toBe(result.activated.id)
    })
  })

  describe('discardDraft()', () => {
    it('should reset the draft definition back to the active version', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      const activated = expectOk(
        await CrmWorkflowVersionRepository.activateDraft(
          workflow.id,
          workflow.versions[0].id,
        ),
      )

      await CrmWorkflowVersionRepository.updateDefinition(
        activated.newDraft.id,
        {
          trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
          nodes: [],
          edges: [],
        },
      )

      const discarded = expectOk(
        await CrmWorkflowVersionRepository.discardDraft(workflow.id),
      )
      expect(discarded.definition).toEqual(activated.activated.definition)
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
          versionId: workflow.versions[0].id,
          triggerType: 'LAUNCH_MANUALLY',
          triggerPayload: { foo: 'bar' },
          startedById: user.id,
        }),
      )
      expect(run.status).toBe('PENDING')

      const found = expectOk(await CrmWorkflowRunRepository.findById(run.id))
      expect(found?.steps).toEqual([])
    })
  })

  describe('setStatus()', () => {
    it('should mark the run completed', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      const run = await seedCrmWorkflowRun(workflow.id, workflow.versions[0].id)

      const finished = expectOk(
        await CrmWorkflowRunRepository.setStatus(run.id, 'COMPLETED', {
          finishedAt: new Date(),
        }),
      )
      expect(finished.status).toBe('COMPLETED')
      expect(finished.finishedAt).not.toBeNull()
    })
  })

  describe('createStep() & updateStep()', () => {
    it('should create and complete a step', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      const run = await seedCrmWorkflowRun(workflow.id, workflow.versions[0].id)

      const step = expectOk(
        await CrmWorkflowRunRepository.createStep({
          runId: run.id,
          nodeId: 'n1',
          nodeType: 'create-record',
        }),
      )
      expect(step.status).toBe('PENDING')

      const finished = expectOk(
        await CrmWorkflowRunRepository.updateStep(step.id, {
          status: 'COMPLETED',
          output: { taskId: 'abc' },
        }),
      )
      expect(finished.status).toBe('COMPLETED')
      expect(finished.output).toEqual({ taskId: 'abc' })
    })
  })

  describe('pause() & clearPause()', () => {
    it('should persist and clear the paused state', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      const run = await seedCrmWorkflowRun(workflow.id, workflow.versions[0].id)
      const step = expectOk(
        await CrmWorkflowRunRepository.createStep({
          runId: run.id,
          nodeId: 'form1',
          nodeType: 'form',
        }),
      )

      const paused = expectOk(
        await CrmWorkflowRunRepository.pause(run.id, {
          state: { steps: {} },
          waitingStepId: step.id,
        }),
      )
      expect(paused.waitingStepId).toBe(step.id)

      const cleared = expectOk(
        await CrmWorkflowRunRepository.clearPause(run.id),
      )
      expect(cleared.waitingStepId).toBeNull()
      expect(cleared.state).toBeNull()
    })
  })
})
