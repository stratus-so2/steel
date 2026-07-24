import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendEmail } from '@/src/lib/mail/send'
import { ok } from '@/src/lib/result'
import type { CrmWorkflowDefinition } from '@/src/schemas/crm-workflow.schema'

vi.mock('@/src/lib/mail/send')

const { crmTask } = vi.hoisted(() => ({
  crmTask: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}))

vi.mock('@/src/lib/prisma', () => ({
  prisma: {
    crmTask,
    crmCompany: {},
    crmPerson: {},
    crmOpportunity: {},
    crmNote: {},
  },
}))

vi.mock('@/src/repositories/crm-workflow.repository', () => ({
  CrmWorkflowRunRepository: {
    setStatus: vi.fn().mockResolvedValue(ok({})),
    createStep: vi.fn().mockResolvedValue(ok({ id: 'step-1' })),
    updateStep: vi.fn().mockResolvedValue(ok({})),
    pause: vi.fn().mockResolvedValue(ok({})),
    clearPause: vi.fn().mockResolvedValue(ok({})),
  },
}))

import { CrmWorkflowRunRepository } from '@/src/repositories/crm-workflow.repository'
import { runCrmWorkflow } from '../crm-workflow-runner'

const mockedSendEmail = vi.mocked(sendEmail)
const mockedRunRepo = vi.mocked(CrmWorkflowRunRepository)

function baseParams(definition: CrmWorkflowDefinition) {
  return {
    runId: 'run-1',
    workspaceId: 'ws-1',
    actingUserId: 'user-1',
    definition,
    triggerType: 'launch-manually' as const,
    triggerPayload: { record: { id: 'lead-1', email: 'lead@acme.com' } },
    testMode: false,
  }
}

describe('runCrmWorkflow()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedRunRepo.setStatus.mockResolvedValue(ok({} as never))
    mockedRunRepo.createStep.mockResolvedValue(ok({ id: 'step-1' } as never))
    mockedRunRepo.updateStep.mockResolvedValue(ok({} as never))
    mockedRunRepo.pause.mockResolvedValue(ok({} as never))
    mockedRunRepo.clearPause.mockResolvedValue(ok({} as never))
  })

  it('should execute a create-record node and resolve trigger expressions', async () => {
    crmTask.create.mockResolvedValue({ id: 'task-1' })

    const definition: CrmWorkflowDefinition = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            type: 'create-record',
            entity: 'task',
            fields: { title: 'Falar com {{trigger.record.email}}' },
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'n1' }],
    }

    await runCrmWorkflow(baseParams(definition))

    expect(crmTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'Falar com lead@acme.com' }),
      }),
    )
    expect(mockedRunRepo.setStatus).toHaveBeenCalledWith(
      'run-1',
      'COMPLETED',
      expect.anything(),
    )
  })

  it('filter should stop the branch when the condition fails', async () => {
    const definition: CrmWorkflowDefinition = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'f1',
          position: { x: 0, y: 0 },
          data: {
            type: 'filter',
            conditions: [
              {
                field: '{{trigger.record.email}}',
                operator: 'equals',
                value: 'nope@x.com',
              },
            ],
          },
        },
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            type: 'create-record',
            entity: 'task',
            fields: { title: 'x' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'f1' },
        { id: 'e2', source: 'f1', target: 'n1' },
      ],
    }

    await runCrmWorkflow(baseParams(definition))

    expect(crmTask.create).not.toHaveBeenCalled()
    expect(mockedRunRepo.setStatus).toHaveBeenCalledWith(
      'run-1',
      'COMPLETED',
      expect.anything(),
    )
  })

  it('if-else should follow the true branch via sourceHandle', async () => {
    crmTask.create.mockResolvedValue({ id: 'task-1' })

    const definition: CrmWorkflowDefinition = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'if1',
          position: { x: 0, y: 0 },
          data: {
            type: 'if-else',
            conditions: [
              {
                field: '{{trigger.record.email}}',
                operator: 'equals',
                value: 'lead@acme.com',
              },
            ],
          },
        },
        {
          id: 'onTrue',
          position: { x: 0, y: 0 },
          data: {
            type: 'create-record',
            entity: 'task',
            fields: { title: 'true branch' },
          },
        },
        {
          id: 'onFalse',
          position: { x: 0, y: 0 },
          data: {
            type: 'create-record',
            entity: 'task',
            fields: { title: 'false branch' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'if1' },
        { id: 'e2', source: 'if1', target: 'onTrue', sourceHandle: 'true' },
        { id: 'e3', source: 'if1', target: 'onFalse', sourceHandle: 'false' },
      ],
    }

    await runCrmWorkflow(baseParams(definition))

    expect(crmTask.create).toHaveBeenCalledTimes(1)
    expect(crmTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: 'true branch' }),
      }),
    )
  })

  it('form node should pause the run as WAITING without enqueueing children', async () => {
    crmTask.create.mockResolvedValue({ id: 'task-1' })

    const definition: CrmWorkflowDefinition = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'form1',
          position: { x: 0, y: 0 },
          data: {
            type: 'form',
            title: 'Preencha',
            fields: [{ name: 'ok', type: 'boolean', required: false }],
          },
        },
        {
          id: 'n1',
          position: { x: 0, y: 0 },
          data: {
            type: 'create-record',
            entity: 'task',
            fields: { title: 'depois do form' },
          },
        },
      ],
      edges: [
        { id: 'e1', source: 'trigger', target: 'form1' },
        { id: 'e2', source: 'form1', target: 'n1' },
      ],
    }

    await runCrmWorkflow(baseParams(definition))

    expect(crmTask.create).not.toHaveBeenCalled()
    expect(mockedRunRepo.pause).toHaveBeenCalledWith(
      'run-1',
      expect.objectContaining({ waitingStepId: 'step-1' }),
    )
    expect(mockedRunRepo.setStatus).toHaveBeenCalledWith('run-1', 'WAITING')
    expect(mockedRunRepo.setStatus).not.toHaveBeenCalledWith(
      'run-1',
      'COMPLETED',
      expect.anything(),
    )
  })

  it('send-email should call the mail lib and mark the run completed', async () => {
    mockedSendEmail.mockResolvedValue({ id: 'msg-1' } as never)

    const definition: CrmWorkflowDefinition = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'mail1',
          position: { x: 0, y: 0 },
          data: {
            type: 'send-email',
            to: '{{trigger.record.email}}',
            subject: 'Oi',
            body: '<p>Oi</p>',
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'mail1' }],
    }

    await runCrmWorkflow(baseParams(definition))

    expect(mockedSendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'lead@acme.com', subject: 'Oi' }),
    )
    expect(mockedRunRepo.setStatus).toHaveBeenCalledWith(
      'run-1',
      'COMPLETED',
      expect.anything(),
    )
  })

  it('should mark the run FAILED and record the step error when a node throws', async () => {
    mockedSendEmail.mockRejectedValue(new Error('boom'))

    const definition: CrmWorkflowDefinition = {
      trigger: {
        id: 'trigger',
        position: { x: 0, y: 0 },
        data: { type: 'launch-manually', inputs: [] },
      },
      nodes: [
        {
          id: 'mail1',
          position: { x: 0, y: 0 },
          data: {
            type: 'send-email',
            to: 'x@y.com',
            subject: 'Oi',
            body: '<p>Oi</p>',
          },
        },
      ],
      edges: [{ id: 'e1', source: 'trigger', target: 'mail1' }],
    }

    await runCrmWorkflow(baseParams(definition))

    expect(mockedRunRepo.updateStep).toHaveBeenCalledWith(
      'step-1',
      expect.objectContaining({
        status: 'FAILED',
        error: expect.stringContaining('boom'),
      }),
    )
    expect(mockedRunRepo.setStatus).toHaveBeenCalledWith(
      'run-1',
      'FAILED',
      expect.objectContaining({ error: expect.stringContaining('boom') }),
    )
  })
})
