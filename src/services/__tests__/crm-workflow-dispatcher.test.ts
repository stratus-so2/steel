import { describe, expect, it, vi } from 'vitest'
import { ok } from '@/src/lib/result'

vi.mock('@/src/repositories/crm-workflow.repository')
vi.mock('@/src/services/crm-workflow-runner')

import {
  CrmWorkflowRepository,
  CrmWorkflowRunRepository,
} from '@/src/repositories/crm-workflow.repository'
import { dispatchCrmWorkflowRecordEvent } from '../crm-workflow-dispatcher'
import { runCrmWorkflow } from '../crm-workflow-runner'

const mockedWorkflowRepo = vi.mocked(CrmWorkflowRepository)
const mockedRunRepo = vi.mocked(CrmWorkflowRunRepository)
const mockedRun = vi.mocked(runCrmWorkflow)

function activeWorkflow(trigger: Record<string, unknown>) {
  return {
    id: 'wf1',
    activeVersion: {
      id: 'v1',
      definition: {
        trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: trigger },
        nodes: [],
        edges: [],
      },
    },
  } as never
}

function setup(trigger: Record<string, unknown>) {
  mockedWorkflowRepo.findActiveByWorkspace.mockResolvedValue(
    ok([activeWorkflow(trigger)]),
  )
  mockedRunRepo.create.mockResolvedValue(ok({ id: 'run1' } as never))
  mockedRun.mockResolvedValue(undefined as never)
}

const base = {
  workspaceId: 'ws1',
  actorUserId: 'u1',
  entity: 'lead' as const,
  record: { id: 'l1' },
}

describe('dispatchCrmWorkflowRecordEvent() — lead triggers', () => {
  it('should run a lead creation workflow on lead created', async () => {
    setup({ type: 'record-is-created', entity: 'lead' })

    await dispatchCrmWorkflowRecordEvent({ ...base, event: 'created' })

    expect(mockedRunRepo.create).toHaveBeenCalledTimes(1)
  })

  it('should not run a person workflow for a lead event', async () => {
    setup({ type: 'record-is-created', entity: 'person' })

    await dispatchCrmWorkflowRecordEvent({ ...base, event: 'created' })

    expect(mockedRunRepo.create).not.toHaveBeenCalled()
  })

  it('should run a "won" workflow only when the update carries the won event', async () => {
    setup({ type: 'record-is-updated', entity: 'lead', leadEvent: 'won' })

    await dispatchCrmWorkflowRecordEvent({
      ...base,
      event: 'updated',
      leadEvents: ['stage-changed', 'lost'],
    })
    expect(mockedRunRepo.create).not.toHaveBeenCalled()

    await dispatchCrmWorkflowRecordEvent({
      ...base,
      event: 'updated',
      leadEvents: ['stage-changed', 'won'],
    })
    expect(mockedRunRepo.create).toHaveBeenCalledTimes(1)
    expect(mockedRunRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerPayload: expect.objectContaining({
          leadEvents: ['stage-changed', 'won'],
        }),
      }),
    )
  })

  it('should not fire a lead-event workflow on creation', async () => {
    setup({
      type: 'record-is-created-or-updated',
      entity: 'lead',
      leadEvent: 'stage-changed',
    })

    await dispatchCrmWorkflowRecordEvent({ ...base, event: 'created' })

    expect(mockedRunRepo.create).not.toHaveBeenCalled()
  })
})

describe('dispatchCrmWorkflowRecordEvent() — matching and resilience', () => {
  const companyBase = {
    workspaceId: 'ws1',
    actorUserId: 'u1',
    entity: 'company' as const,
    record: { id: 'c1', name: 'Acme' },
  }

  it('should do nothing when loading workflows fails', async () => {
    mockedWorkflowRepo.findActiveByWorkspace.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'boom' },
    } as never)

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'created' })

    expect(mockedRunRepo.create).not.toHaveBeenCalled()
  })

  it('should do nothing when the workspace has no active workflow', async () => {
    mockedWorkflowRepo.findActiveByWorkspace.mockResolvedValue(ok([]))

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'created' })

    expect(mockedRunRepo.create).not.toHaveBeenCalled()
  })

  it('should skip workflows without an active version or trigger, and wrong trigger types', async () => {
    mockedWorkflowRepo.findActiveByWorkspace.mockResolvedValue(
      ok([
        { id: 'no-version', activeVersion: null },
        {
          id: 'no-trigger',
          activeVersion: {
            id: 'v0',
            definition: {
              trigger: { id: 'trigger', position: { x: 0, y: 0 }, data: null },
              nodes: [],
              edges: [],
            },
          },
        },
        activeWorkflow({ type: 'launch-manually', inputs: [] }),
        activeWorkflow({ type: 'record-is-deleted', entity: 'company' }),
      ] as never),
    )

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'created' })

    expect(mockedRunRepo.create).not.toHaveBeenCalled()
  })

  it('should fire a created-or-updated trigger on created and create the run with the payload', async () => {
    setup({ type: 'record-is-created-or-updated', entity: 'company' })

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'created' })

    expect(mockedRunRepo.create).toHaveBeenCalledWith({
      workflowId: 'wf1',
      versionId: 'v1',
      triggerType: 'RECORD_IS_CREATED_OR_UPDATED',
      triggerPayload: {
        event: 'created',
        record: companyBase.record,
        changedFields: [],
      },
      startedById: 'u1',
    })
    expect(mockedRun).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run1',
        workspaceId: 'ws1',
        actingUserId: 'u1',
        triggerType: 'record-is-created-or-updated',
        testMode: false,
      }),
    )
  })

  it('should fire a deleted trigger only on delete events', async () => {
    setup({ type: 'record-is-deleted', entity: 'company' })

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'updated' })
    expect(mockedRunRepo.create).not.toHaveBeenCalled()

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'deleted' })
    expect(mockedRunRepo.create).toHaveBeenCalledTimes(1)
  })

  it('should require an intersection with the watched fields', async () => {
    setup({ type: 'record-is-updated', entity: 'company', fields: ['name'] })

    await dispatchCrmWorkflowRecordEvent({
      ...companyBase,
      event: 'updated',
      changedFields: ['domain'],
    })
    expect(mockedRunRepo.create).not.toHaveBeenCalled()

    await dispatchCrmWorkflowRecordEvent({
      ...companyBase,
      event: 'updated',
      changedFields: ['domain', 'name'],
    })
    expect(mockedRunRepo.create).toHaveBeenCalledTimes(1)
    expect(mockedRunRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        triggerPayload: expect.objectContaining({
          changedFields: ['domain', 'name'],
        }),
      }),
    )
  })

  it('should fire a field-scoped trigger when the caller does not report changed fields', async () => {
    setup({ type: 'record-is-updated', entity: 'company', fields: ['name'] })

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'updated' })
    await dispatchCrmWorkflowRecordEvent({
      ...companyBase,
      event: 'updated',
      changedFields: [],
    })

    expect(mockedRunRepo.create).toHaveBeenCalledTimes(2)
  })

  it('should keep going to the next workflow when creating a run fails', async () => {
    mockedWorkflowRepo.findActiveByWorkspace.mockResolvedValue(
      ok([
        activeWorkflow({ type: 'record-is-created', entity: 'company' }),
        activeWorkflow({ type: 'record-is-created', entity: 'company' }),
      ]),
    )
    mockedRunRepo.create
      .mockResolvedValueOnce({
        ok: false,
        error: { code: 'DATABASE_ERROR', message: 'boom' },
      } as never)
      .mockResolvedValueOnce(ok({ id: 'run2' } as never))
    mockedRun.mockResolvedValue(undefined as never)

    await dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'created' })

    expect(mockedRunRepo.create).toHaveBeenCalledTimes(2)
    expect(mockedRun).toHaveBeenCalledTimes(1)
    expect(mockedRun).toHaveBeenCalledWith(
      expect.objectContaining({ runId: 'run2' }),
    )
  })

  it('should swallow a runner rejection (best-effort dispatch)', async () => {
    setup({ type: 'record-is-created', entity: 'company' })
    mockedRun.mockRejectedValue(new Error('runner down'))

    await expect(
      dispatchCrmWorkflowRecordEvent({ ...companyBase, event: 'created' }),
    ).resolves.toBeUndefined()
    // deixa a rejeição (e o `.catch`) assentarem sem unhandled rejection
    await new Promise((resolve) => setImmediate(resolve))
    expect(mockedRun).toHaveBeenCalledTimes(1)
  })
})
