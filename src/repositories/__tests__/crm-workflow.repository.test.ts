import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  FAKE_WORKFLOW_DEFINITION,
  seedCrmWorkflow,
  seedCrmWorkflowRun,
} from '@/src/__tests__/factories/crm-workflow.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
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
      expect(discarded?.definition).toEqual(activated.activated.definition)
    })

    it('should return null when the workflow has no draft', async () => {
      const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
      const workflow = await seedCrmWorkflow(workspace.id, user.id)
      await prisma.crmWorkflowVersion.deleteMany({
        where: { workflowId: workflow.id },
      })

      expect(
        expectOk(await CrmWorkflowVersionRepository.discardDraft(workflow.id)),
      ).toBeNull()
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

function webhookDefinition(token: string) {
  return {
    trigger: {
      id: 'trigger',
      position: { x: 0, y: 0 },
      data: { type: 'webhook', token },
    },
    nodes: [],
    edges: [],
  } as never
}

async function seedActiveWorkflow(
  workspaceId: string,
  userId: string,
  definition?: never,
) {
  const workflow = await seedCrmWorkflow(workspaceId, userId, { definition })
  const { activated, newDraft } = expectOk(
    await CrmWorkflowVersionRepository.activateDraft(
      workflow.id,
      workflow.versions[0].id,
    ),
  )
  return { workflow, activated, newDraft }
}

describe('CrmWorkflowRepository — lookups and lifecycle', () => {
  it('should return null for a missing workflow id', async () => {
    expect(expectOk(await CrmWorkflowRepository.findById('missing'))).toBeNull()
  })

  it('should soft delete and deactivate the workflow', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const workflow = await seedCrmWorkflow(workspace.id, user.id)

    const deleted = expectOk(
      await CrmWorkflowRepository.softDelete(workflow.id, user.id),
    )
    expect(deleted.deletedAt).not.toBeNull()
    expect(deleted.status).toBe('DEACTIVATED')
    expect(deleted.updatedById).toBe(user.id)
    expect(
      expectOk(await CrmWorkflowRepository.listByWorkspace(workspace.id)),
    ).toEqual([])
  })

  it('should list only ACTIVE workflows of the workspace with their active version', async () => {
    const [workspace, other, user] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
    ])
    const { workflow, activated } = await seedActiveWorkflow(
      workspace.id,
      user.id,
    )
    await seedCrmWorkflow(workspace.id, user.id)
    const deleted = await seedActiveWorkflow(workspace.id, user.id)
    await CrmWorkflowRepository.softDelete(deleted.workflow.id, user.id)
    const foreign = await seedActiveWorkflow(other.id, user.id)

    const list = expectOk(
      await CrmWorkflowRepository.findActiveByWorkspace(workspace.id),
    )
    expect(list.map((w) => w.id)).toEqual([workflow.id])
    expect(list[0].activeVersion?.id).toBe(activated.id)

    const all = expectOk(await CrmWorkflowRepository.findAllActive())
    expect(all.map((w) => w.id).sort()).toEqual(
      [workflow.id, foreign.workflow.id].sort(),
    )
  })

  it('should return null when no active webhook workflow matches the token', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    await seedActiveWorkflow(workspace.id, user.id, webhookDefinition('tok_a'))
    // gatilho que não é webhook
    await seedActiveWorkflow(workspace.id, user.id)
    // versão ativa sem gatilho algum
    await seedActiveWorkflow(workspace.id, user.id, {} as never)

    expect(
      expectOk(await CrmWorkflowRepository.findActiveByWebhookToken('tok_b')),
    ).toBeNull()
  })

  it('should propagate DATABASE_ERROR when creating for a missing workspace', async () => {
    const user = await seedUser()
    expectErr(
      await CrmWorkflowRepository.create({
        workspaceId: 'missing',
        createdById: user.id,
        name: 'X',
        description: 'Descrição',
        initialDefinition: FAKE_WORKFLOW_DEFINITION,
      }),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when updating or deleting a missing workflow', async () => {
    const user = await seedUser()
    expectErr(
      await CrmWorkflowRepository.update('missing', {
        updatedById: user.id,
        name: 'X',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowRepository.softDelete('missing', user.id),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmWorkflowVersionRepository — lookups and transitions', () => {
  it('should find versions by id, draft, active and list them newest first', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const { workflow, activated, newDraft } = await seedActiveWorkflow(
      workspace.id,
      user.id,
    )

    expect(
      expectOk(await CrmWorkflowVersionRepository.findById(activated.id))?.id,
    ).toBe(activated.id)
    expect(
      expectOk(await CrmWorkflowVersionRepository.findById('missing')),
    ).toBeNull()
    expect(
      expectOk(await CrmWorkflowVersionRepository.findDraft(workflow.id))?.id,
    ).toBe(newDraft.id)
    expect(
      expectOk(await CrmWorkflowVersionRepository.findActive(workflow.id))?.id,
    ).toBe(activated.id)

    const list = expectOk(
      await CrmWorkflowVersionRepository.listByWorkflow(workflow.id),
    )
    expect(list.map((v) => v.id)).toEqual([newDraft.id, activated.id])
  })

  it('should archive the previous ACTIVE version on a second activation', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const { workflow, activated, newDraft } = await seedActiveWorkflow(
      workspace.id,
      user.id,
    )

    const second = expectOk(
      await CrmWorkflowVersionRepository.activateDraft(
        workflow.id,
        newDraft.id,
      ),
    )
    expect(second.activated.version).toBe(2)
    const previous = expectOk(
      await CrmWorkflowVersionRepository.findById(activated.id),
    )
    expect(previous?.status).toBe('ARCHIVED')
  })

  it('should refuse to activate a missing, foreign or non-draft version', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const { workflow, activated } = await seedActiveWorkflow(
      workspace.id,
      user.id,
    )
    const other = await seedCrmWorkflow(workspace.id, user.id)

    expectErr(
      await CrmWorkflowVersionRepository.activateDraft(workflow.id, 'missing'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowVersionRepository.activateDraft(
        workflow.id,
        other.versions[0].id,
      ),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowVersionRepository.activateDraft(
        workflow.id,
        activated.id,
      ),
      'DATABASE_ERROR',
    )
  })

  it('should reset the draft to an empty definition when nothing is active', async () => {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const workflow = await seedCrmWorkflow(workspace.id, user.id)

    const discarded = expectOk(
      await CrmWorkflowVersionRepository.discardDraft(workflow.id),
    )
    expect(discarded?.id).toBe(workflow.versions[0].id)
    expect(discarded?.definition).toEqual({
      trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
      nodes: [],
      edges: [],
    })
  })

  it('should return DATABASE_ERROR when updating the definition of a missing version', async () => {
    expectErr(
      await CrmWorkflowVersionRepository.updateDefinition(
        'missing',
        FAKE_WORKFLOW_DEFINITION,
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmWorkflowRunRepository — runs and steps', () => {
  async function seedRunBase() {
    const [workspace, user] = await Promise.all([seedWorkspace(), seedUser()])
    const workflow = await seedCrmWorkflow(workspace.id, user.id)
    return { workspace, user, workflow, versionId: workflow.versions[0].id }
  }

  it('should create a run without a starter', async () => {
    const { workflow, versionId } = await seedRunBase()

    const run = expectOk(
      await CrmWorkflowRunRepository.create({
        workflowId: workflow.id,
        versionId,
        triggerType: 'WEBHOOK',
        triggerPayload: {},
        startedById: null,
      }),
    )
    expect(run.startedById).toBeNull()
    expect(run.triggerType).toBe('WEBHOOK')
  })

  it('should return DATABASE_ERROR when creating a run for a missing version', async () => {
    const { workflow } = await seedRunBase()
    expectErr(
      await CrmWorkflowRunRepository.create({
        workflowId: workflow.id,
        versionId: 'missing',
        triggerType: 'LAUNCH_MANUALLY',
        triggerPayload: {},
        startedById: null,
      }),
      'DATABASE_ERROR',
    )
  })

  it('should return null for a missing run and list runs newest first with a limit', async () => {
    const { workflow, versionId } = await seedRunBase()
    const first = await seedCrmWorkflowRun(workflow.id, versionId)
    const second = await seedCrmWorkflowRun(workflow.id, versionId)
    await prisma.crmWorkflowRun.update({
      where: { id: second.id },
      data: { createdAt: new Date(first.createdAt.getTime() + 1000) },
    })

    expect(
      expectOk(await CrmWorkflowRunRepository.findById('missing')),
    ).toBeNull()
    expect(
      expectOk(await CrmWorkflowRunRepository.listByWorkflow(workflow.id)).map(
        (r) => r.id,
      ),
    ).toEqual([second.id, first.id])
    expect(
      expectOk(
        await CrmWorkflowRunRepository.listByWorkflow(workflow.id, 1),
      ).map((r) => r.id),
    ).toEqual([second.id])
  })

  it('should stamp startedAt only when the run moves to RUNNING', async () => {
    const { workflow, versionId } = await seedRunBase()
    const run = await seedCrmWorkflowRun(workflow.id, versionId)

    const running = expectOk(
      await CrmWorkflowRunRepository.setStatus(run.id, 'RUNNING'),
    )
    expect(running.startedAt).not.toBeNull()

    const failed = expectOk(
      await CrmWorkflowRunRepository.setStatus(run.id, 'FAILED', {
        error: 'boom',
      }),
    )
    expect(failed.error).toBe('boom')
    expect(failed.startedAt).toEqual(running.startedAt)
  })

  it('should create a step with an explicit status and input, ordered in the run', async () => {
    const { workflow, versionId } = await seedRunBase()
    const run = await seedCrmWorkflowRun(workflow.id, versionId)

    const step = expectOk(
      await CrmWorkflowRunRepository.createStep({
        runId: run.id,
        nodeId: 'n1',
        nodeType: 'create-record',
        status: 'RUNNING',
        input: { a: 1 },
      }),
    )
    expect(step.status).toBe('RUNNING')
    expect(step.input).toEqual({ a: 1 })

    const found = expectOk(await CrmWorkflowRunRepository.findById(run.id))
    expect(found?.steps.map((s) => s.id)).toEqual([step.id])
  })

  it('should return DATABASE_ERROR for writes on missing runs and steps', async () => {
    expectErr(
      await CrmWorkflowRunRepository.setStatus('missing', 'COMPLETED'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowRunRepository.createStep({
        runId: 'missing',
        nodeId: 'n1',
        nodeType: 'form',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowRunRepository.updateStep('missing', {
        status: 'FAILED',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowRunRepository.pause('missing', {
        state: {},
        waitingStepId: 'missing',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowRunRepository.clearPause('missing'),
      'DATABASE_ERROR',
    )
  })
})

describe('CrmWorkflow repositories — database failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should return DATABASE_ERROR when workflow reads throw', async () => {
    vi.spyOn(prisma.crmWorkflow, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmWorkflow, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(await CrmWorkflowRepository.findById('w'), 'DATABASE_ERROR')
    expectErr(
      await CrmWorkflowRepository.listByWorkspace('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowRepository.findActiveByWorkspace('w'),
      'DATABASE_ERROR',
    )
    expectErr(await CrmWorkflowRepository.findAllActive(), 'DATABASE_ERROR')
    expectErr(
      await CrmWorkflowRepository.findActiveByWebhookToken('t'),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when version reads and transactions throw', async () => {
    vi.spyOn(prisma.crmWorkflowVersion, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmWorkflowVersion, 'findFirst')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.crmWorkflowVersion, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma, '$transaction').mockRejectedValueOnce(new Error('boom'))

    expectErr(
      await CrmWorkflowVersionRepository.findById('v'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowVersionRepository.findDraft('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowVersionRepository.findActive('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowVersionRepository.listByWorkflow('w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await CrmWorkflowVersionRepository.discardDraft('w'),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when run reads throw', async () => {
    vi.spyOn(prisma.crmWorkflowRun, 'findUnique').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.crmWorkflowRun, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(await CrmWorkflowRunRepository.findById('r'), 'DATABASE_ERROR')
    expectErr(
      await CrmWorkflowRunRepository.listByWorkflow('w'),
      'DATABASE_ERROR',
    )
  })
})
