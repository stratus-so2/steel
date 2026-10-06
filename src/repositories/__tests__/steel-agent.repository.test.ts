import { describe, expect, it, vi } from 'vitest'
import {
  seedSteelAgent,
  seedSteelAgentRun,
} from '@/src/__tests__/factories/steel-agent.factory'
import { seedAiPendingAction } from '@/src/__tests__/factories/steel-ai.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import {
  SteelAgentRepository,
  SteelAgentRunRepository,
  SteelAgentRunStepRepository,
} from '../steel-agent.repository'

async function context() {
  const [workspace, owner] = await Promise.all([seedWorkspace(), seedUser()])
  return { workspace, owner }
}

const fields = (ownerId: string) => ({
  name: 'Triagem',
  description: null,
  instructions: 'Classifique.',
  triggerType: 'SCHEDULE' as const,
  cron: '0 9 * * *',
  timezone: 'America/Sao_Paulo',
  eventKey: null,
  enabled: true,
  ownerId,
  maxToolRounds: 8,
  monthlyRunCap: null,
  nextRunAt: null,
})

describe('SteelAgentRepository', () => {
  it('should create with tools and read back with owner and last run', async () => {
    const { workspace, owner } = await context()
    const created = expectOk(
      await SteelAgentRepository.create({
        ...fields(owner.id),
        workspaceId: workspace.id,
        createdById: owner.id,
        tools: [
          { toolName: 'sd_list_tickets', mode: 'AUTO' },
          { toolName: 'crm_create_task', mode: 'APPROVAL' },
        ],
      }),
    )
    expect(created.tools.map((t) => t.toolName)).toEqual([
      'crm_create_task',
      'sd_list_tickets',
    ])
    expect(created.owner?.id).toBe(owner.id)
    expect(created.runs).toEqual([])

    await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: created.id,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    })
    const latest = await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: created.id,
      status: 'SUCCEEDED',
    })
    const found = expectOk(
      await SteelAgentRepository.findById(created.id, workspace.id),
    )
    expect(found.runs.map((r) => r.id)).toEqual([latest.id])

    const list = expectOk(
      await SteelAgentRepository.listByWorkspace(workspace.id),
    )
    expect(list.map((a) => a.id)).toEqual([created.id])
  })

  it('should scope findById to the workspace', async () => {
    const { workspace, owner } = await context()
    const other = await seedWorkspace()
    const agent = await seedSteelAgent({
      workspaceId: workspace.id,
      ownerId: owner.id,
    })
    expectErr(
      await SteelAgentRepository.findById(agent.id, other.id),
      'STEEL_AGENT_NOT_FOUND',
    )
  })

  it('should update fields and replace tools only when given', async () => {
    const { workspace, owner } = await context()
    const agent = await seedSteelAgent({
      workspaceId: workspace.id,
      ownerId: owner.id,
      tools: [{ toolName: 'sd_list_tickets', mode: 'AUTO' }],
    })
    const renamed = expectOk(
      await SteelAgentRepository.update(agent.id, { name: 'Novo' }),
    )
    expect(renamed.name).toBe('Novo')
    expect(renamed.tools).toHaveLength(1)

    const replaced = expectOk(
      await SteelAgentRepository.update(agent.id, {}, [
        { toolName: 'crm_create_task', mode: 'APPROVAL' },
      ]),
    )
    expect(replaced.tools.map((t) => t.toolName)).toEqual(['crm_create_task'])

    const cleared = expectOk(
      await SteelAgentRepository.update(agent.id, {}, []),
    )
    expect(cleared.tools).toEqual([])
  })

  it('should delete an agent and its runs', async () => {
    const { workspace, owner } = await context()
    const agent = await seedSteelAgent({
      workspaceId: workspace.id,
      ownerId: owner.id,
    })
    await seedSteelAgentRun({ workspaceId: workspace.id, agentId: agent.id })
    expectOk(await SteelAgentRepository.delete(agent.id))
    expect(
      await prisma.steelAgentRun.count({ where: { agentId: agent.id } }),
    ).toBe(0)
  })

  it('should list scheduled and event agents', async () => {
    const { workspace, owner } = await context()
    const cron = await seedSteelAgent({
      workspaceId: workspace.id,
      ownerId: owner.id,
      triggerType: 'SCHEDULE',
      cron: '0 9 * * *',
    })
    await seedSteelAgent({
      workspaceId: workspace.id,
      triggerType: 'SCHEDULE',
      cron: '0 9 * * *',
      enabled: false,
    })
    const event = await seedSteelAgent({
      workspaceId: workspace.id,
      triggerType: 'EVENT',
      eventKey: 'sd.ticket.created',
    })
    await seedSteelAgent({
      workspaceId: workspace.id,
      triggerType: 'EVENT',
      eventKey: 'crm.lead.created',
    })

    expect(
      expectOk(await SteelAgentRepository.listScheduled()).map((a) => a.id),
    ).toEqual([cron.id])
    expect(
      expectOk(
        await SteelAgentRepository.listByEvent(
          workspace.id,
          'sd.ticket.created',
        ),
      ).map((a) => a.id),
    ).toEqual([event.id])
  })

  it('should let only one tick claim an occurrence', async () => {
    const { workspace } = await context()
    const agent = await seedSteelAgent({ workspaceId: workspace.id })
    const occurrence = new Date('2026-10-06T12:00:00.000Z')
    const next = new Date('2026-10-07T12:00:00.000Z')
    const [a, b] = await Promise.all([
      SteelAgentRepository.claimOccurrence(agent.id, occurrence, next),
      SteelAgentRepository.claimOccurrence(agent.id, occurrence, next),
    ])
    expect([expectOk(a), expectOk(b)].filter(Boolean)).toHaveLength(1)
    const row = await prisma.steelAgent.findUniqueOrThrow({
      where: { id: agent.id },
    })
    expect(row.lastRunAt).toEqual(occurrence)
    expect(row.nextRunAt).toEqual(next)
    expect(
      expectOk(
        await SteelAgentRepository.claimOccurrence(
          agent.id,
          new Date('2026-10-07T12:00:00.000Z'),
          null,
        ),
      ),
    ).toBe(true)
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await SteelAgentRepository.create({
        ...fields('missing-user'),
        workspaceId: 'missing',
        createdById: 'missing',
        tools: [],
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRepository.update('missing', { name: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(await SteelAgentRepository.delete('missing'), 'DATABASE_ERROR')
    vi.spyOn(prisma.steelAgent, 'findMany')
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
    vi.spyOn(prisma.steelAgent, 'findFirst').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.steelAgent, 'updateMany').mockRejectedValueOnce(
      new Error('down'),
    )
    expectErr(await SteelAgentRepository.listByWorkspace('w'), 'DATABASE_ERROR')
    expectErr(await SteelAgentRepository.listScheduled(), 'DATABASE_ERROR')
    expectErr(
      await SteelAgentRepository.listByEvent('w', 'e'),
      'DATABASE_ERROR',
    )
    expectErr(await SteelAgentRepository.findById('a', 'w'), 'DATABASE_ERROR')
    expectErr(
      await SteelAgentRepository.claimOccurrence('a', new Date(), null),
      'DATABASE_ERROR',
    )
  })
})

describe('SteelAgentRunRepository', () => {
  it('should create, load for execution and list by agent', async () => {
    const { workspace, owner } = await context()
    const agent = await seedSteelAgent({
      workspaceId: workspace.id,
      ownerId: owner.id,
      tools: [{ toolName: 'sd_list_tickets', mode: 'AUTO' }],
    })
    const run = expectOk(
      await SteelAgentRunRepository.create({
        workspaceId: workspace.id,
        agentId: agent.id,
        triggerType: 'EVENT',
        triggerPayload: { ticketId: 't1' },
      }),
    )
    expect(run.status).toBe('QUEUED')

    const loaded = expectOk(
      await SteelAgentRunRepository.findForExecution(run.id),
    )
    expect(loaded.agent.tools).toHaveLength(1)
    expectErr(
      await SteelAgentRunRepository.findForExecution('missing'),
      'STEEL_AGENT_RUN_NOT_FOUND',
    )

    await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
      status: 'FAILED',
    })
    expect(
      expectOk(
        await SteelAgentRunRepository.listByAgent(agent.id, { limit: 10 }),
      ),
    ).toHaveLength(2)
    expect(
      expectOk(
        await SteelAgentRunRepository.listByAgent(agent.id, {
          limit: 10,
          status: 'FAILED',
        }),
      ),
    ).toHaveLength(1)
  })

  it('should claim conditionally and update', async () => {
    const { workspace } = await context()
    const agent = await seedSteelAgent({ workspaceId: workspace.id })
    const run = await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
    })
    expect(
      expectOk(
        await SteelAgentRunRepository.claim(run.id, ['QUEUED'], {
          status: 'RUNNING',
        }),
      ),
    ).toBe(true)
    expect(
      expectOk(
        await SteelAgentRunRepository.claim(run.id, ['QUEUED'], {
          status: 'RUNNING',
        }),
      ),
    ).toBe(false)
    const updated = expectOk(
      await SteelAgentRunRepository.update(run.id, {
        status: 'SUCCEEDED',
        inputTokens: { increment: 10 },
      }),
    )
    expect(updated.inputTokens).toBe(10)
  })

  it('should count runs of the period except SKIPPED', async () => {
    const { workspace } = await context()
    const agent = await seedSteelAgent({ workspaceId: workspace.id })
    await seedSteelAgentRun({ workspaceId: workspace.id, agentId: agent.id })
    await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
      status: 'SKIPPED',
    })
    await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
    })
    expect(
      expectOk(
        await SteelAgentRunRepository.countSince(
          agent.id,
          new Date('2026-01-01T00:00:00.000Z'),
        ),
      ),
    ).toBe(1)
  })

  it('should return the detail with steps and actions, scoped to the workspace', async () => {
    const { workspace } = await context()
    const other = await seedWorkspace()
    const agent = await seedSteelAgent({ workspaceId: workspace.id })
    const run = await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
    })
    const action = await seedAiPendingAction(workspace.id, {
      agentRunId: run.id,
    })
    expectOk(
      await SteelAgentRunStepRepository.create({
        runId: run.id,
        kind: 'APPROVAL',
        status: 'PENDING',
        pendingActionId: action.id,
        toolName: 'crm_create_task',
      }),
    )
    await SteelAgentRunStepRepository.create({
      runId: run.id,
      kind: 'MODEL',
      status: 'OK',
      output: { text: 'oi' },
    })

    const detail = expectOk(
      await SteelAgentRunRepository.findDetail(run.id, workspace.id),
    )
    expect(detail.agent.id).toBe(agent.id)
    expect(detail.steps).toHaveLength(2)
    expect(detail.pendingActions.map((a) => a.id)).toEqual([action.id])
    expectErr(
      await SteelAgentRunRepository.findDetail(run.id, other.id),
      'STEEL_AGENT_RUN_NOT_FOUND',
    )

    expect(
      expectOk(await SteelAgentRunRepository.listActions(run.id)),
    ).toHaveLength(1)
    expect(
      expectOk(
        await SteelAgentRunStepRepository.updateByPendingAction(action.id, {
          status: 'APPROVED',
          output: { summary: 'ok' },
        }),
      ),
    ).toBe(1)
  })

  it('should list overdue agent actions only', async () => {
    const { workspace } = await context()
    const agent = await seedSteelAgent({ workspaceId: workspace.id })
    const run = await seedSteelAgentRun({
      workspaceId: workspace.id,
      agentId: agent.id,
    })
    const overdue = await seedAiPendingAction(workspace.id, {
      agentRunId: run.id,
      expiresAt: new Date(Date.now() - 1_000),
    })
    await seedAiPendingAction(workspace.id, { agentRunId: run.id })
    await seedAiPendingAction(workspace.id, {
      expiresAt: new Date(Date.now() - 1_000),
    })
    expect(
      expectOk(
        await SteelAgentRunRepository.listOverdueActions(new Date()),
      ).map((a) => a.id),
    ).toEqual([overdue.id])
  })

  it('should return DATABASE_ERROR on failures', async () => {
    expectErr(
      await SteelAgentRunRepository.create({
        workspaceId: 'missing',
        agentId: 'missing',
        triggerType: 'MANUAL',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunRepository.update('missing', { summary: 'x' }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunStepRepository.create({
        runId: 'missing',
        kind: 'MODEL',
        status: 'OK',
      }),
      'DATABASE_ERROR',
    )
    vi.spyOn(prisma.steelAgentRun, 'findFirst').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.steelAgentRun, 'findUnique').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.steelAgentRun, 'findMany').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.steelAgentRun, 'updateMany').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.steelAgentRun, 'count').mockRejectedValueOnce(
      new Error('down'),
    )
    vi.spyOn(prisma.aiPendingAction, 'findMany')
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
    vi.spyOn(prisma.steelAgentRunStep, 'updateMany').mockRejectedValueOnce(
      new Error('down'),
    )
    expectErr(
      await SteelAgentRunRepository.findDetail('r', 'w'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunRepository.findForExecution('r'),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunRepository.listByAgent('a', { limit: 1 }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunRepository.claim('r', ['QUEUED'], {
        status: 'RUNNING',
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunRepository.countSince('a', new Date()),
      'DATABASE_ERROR',
    )
    expectErr(await SteelAgentRunRepository.listActions('r'), 'DATABASE_ERROR')
    expectErr(
      await SteelAgentRunRepository.listOverdueActions(new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await SteelAgentRunStepRepository.updateByPendingAction('p', {
        status: 'EXPIRED',
      }),
      'DATABASE_ERROR',
    )
  })
})
