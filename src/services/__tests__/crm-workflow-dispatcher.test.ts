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
