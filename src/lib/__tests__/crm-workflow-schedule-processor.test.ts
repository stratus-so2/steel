import type { Job } from 'bullmq'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  loggerMock: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  findAllActive: vi.fn(),
  updateWorkflow: vi.fn(),
  createRun: vi.fn(),
  runCrmWorkflow: vi.fn(),
}))

vi.mock('@/lib/axiom/logger', () => ({ logger: mocks.loggerMock }))
vi.mock('@/src/repositories/crm-workflow.repository', () => ({
  CrmWorkflowRepository: {
    findAllActive: mocks.findAllActive,
    update: mocks.updateWorkflow,
  },
  CrmWorkflowRunRepository: { create: mocks.createRun },
}))
vi.mock('@/src/services/crm-workflow-runner', () => ({
  runCrmWorkflow: mocks.runCrmWorkflow,
}))

import { CrmWorkflowScheduleJob } from '@/src/lib/queue/jobs'
import { processCrmWorkflowSchedule } from '@/src/lib/queue/processors/crm-workflow-schedule'

const NOW = new Date('2026-09-18T15:30:20.000Z')
const PREV_MINUTE = new Date('2026-09-18T15:30:00.000Z')

function tickJob(name: string = CrmWorkflowScheduleJob.RunTick): Job {
  return { id: 'tick-1', name, data: {} } as unknown as Job
}

function scheduleDefinition(cron: string) {
  return {
    trigger: {
      id: 'trigger',
      position: { x: 0, y: 0 },
      data: { type: 'on-a-schedule', cron, timezone: 'UTC' },
    },
    nodes: [],
    edges: [],
  }
}

function workflow(
  id: string,
  definition: unknown,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    workspaceId: 'ws-1',
    createdById: 'user-1',
    lastRunAt: null,
    activeVersion: { id: `${id}-v1`, definition },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  mocks.runCrmWorkflow.mockResolvedValue(undefined)
  mocks.updateWorkflow.mockResolvedValue({ ok: true, value: {} })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('processCrmWorkflowSchedule', () => {
  it('dispatches a due schedule, marks lastRunAt and starts the runner', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: true,
      value: [workflow('wf-1', scheduleDefinition('* * * * *'))],
    })
    mocks.createRun.mockResolvedValue({ ok: true, value: { id: 'run-1' } })

    const result = await processCrmWorkflowSchedule(tickJob())

    expect(result).toEqual({ considered: 1, dispatched: 1, errors: 0 })
    expect(mocks.createRun).toHaveBeenCalledWith({
      workflowId: 'wf-1',
      versionId: 'wf-1-v1',
      triggerType: 'ON_A_SCHEDULE',
      triggerPayload: { scheduledFor: PREV_MINUTE.toISOString() },
      startedById: null,
    })
    expect(mocks.updateWorkflow).toHaveBeenCalledWith('wf-1', {
      updatedById: 'user-1',
      lastRunAt: PREV_MINUTE,
    })
    expect(mocks.runCrmWorkflow).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-1',
        workspaceId: 'ws-1',
        actingUserId: 'user-1',
        triggerType: 'on-a-schedule',
        testMode: false,
      }),
    )
    expect(mocks.loggerMock.info).toHaveBeenCalledWith(
      'queue.crm_workflow_schedule.tick_completed',
      expect.objectContaining({ considered: 1, dispatched: 1, errors: 0 }),
    )
  })

  it('swallows runner failures since they are persisted in the run', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: true,
      value: [workflow('wf-1', scheduleDefinition('* * * * *'))],
    })
    mocks.createRun.mockResolvedValue({ ok: true, value: { id: 'run-1' } })
    mocks.runCrmWorkflow.mockRejectedValue(new Error('boom'))

    const result = await processCrmWorkflowSchedule(tickJob())
    await vi.runAllTimersAsync()

    expect(result.dispatched).toBe(1)
  })

  it('skips workflows without an active version or with another trigger', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: true,
      value: [
        workflow('no-version', null, { activeVersion: null }),
        workflow('manual', {
          trigger: {
            id: 'trigger',
            position: { x: 0, y: 0 },
            data: { type: 'launch-manually' },
          },
          nodes: [],
          edges: [],
        }),
        // Definição inválida vira trigger `null`.
        workflow('broken', { garbage: true }),
      ],
    })

    const result = await processCrmWorkflowSchedule(tickJob())

    expect(result).toEqual({ considered: 0, dispatched: 0, errors: 0 })
    expect(mocks.createRun).not.toHaveBeenCalled()
  })

  it('does not dispatch twice for a slot already recorded in lastRunAt', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: true,
      value: [
        workflow('wf-1', scheduleDefinition('* * * * *'), {
          lastRunAt: PREV_MINUTE,
        }),
      ],
    })

    const result = await processCrmWorkflowSchedule(tickJob())

    expect(result).toEqual({ considered: 1, dispatched: 0, errors: 0 })
    expect(mocks.createRun).not.toHaveBeenCalled()
  })

  it('ignores slots older than the tolerance window and one-shot dates in the future', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: true,
      value: [
        // Última execução há ~15h — fora da tolerância de 5 min.
        workflow('stale', scheduleDefinition('0 0 * * *')),
        // Data única no futuro — não há execução anterior.
        workflow('future', scheduleDefinition('2099-01-01T00:00:00')),
      ],
    })

    const result = await processCrmWorkflowSchedule(tickJob())

    expect(result).toEqual({ considered: 2, dispatched: 0, errors: 0 })
    expect(mocks.createRun).not.toHaveBeenCalled()
  })

  it('counts invalid crons and failed run creation as errors', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: true,
      value: [
        workflow('bad-cron', scheduleDefinition('not a cron')),
        workflow('run-fails', scheduleDefinition('* * * * *')),
      ],
    })
    mocks.createRun.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    const result = await processCrmWorkflowSchedule(tickJob())

    expect(result).toEqual({ considered: 2, dispatched: 0, errors: 2 })
    expect(mocks.updateWorkflow).not.toHaveBeenCalled()
    expect(mocks.runCrmWorkflow).not.toHaveBeenCalled()
  })

  it('reports a single error when listing active workflows fails', async () => {
    mocks.findAllActive.mockResolvedValue({
      ok: false,
      error: { code: 'DATABASE_ERROR', message: 'down' },
    })

    const result = await processCrmWorkflowSchedule(tickJob())

    expect(result).toEqual({ considered: 0, dispatched: 0, errors: 1 })
  })

  it('throws on an unknown job name', async () => {
    await expect(processCrmWorkflowSchedule(tickJob('other'))).rejects.toThrow(
      'Unknown crm-workflow-schedule job: other (id=tick-1)',
    )
  })

  it('falls back to an unknown id in the error when the job has none', async () => {
    await expect(
      processCrmWorkflowSchedule({ name: 'nope', data: {} } as unknown as Job),
    ).rejects.toThrow('Unknown crm-workflow-schedule job: nope (id=unknown)')
  })
})
