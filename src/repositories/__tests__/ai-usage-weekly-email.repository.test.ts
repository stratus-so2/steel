import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  seedAiUsage,
  seedWorkspaceAiSettings,
} from '@/src/__tests__/factories/ai-settings.factory'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import {
  seedSteelAgent,
  seedSteelAgentRun,
} from '@/src/__tests__/factories/steel-agent.factory'
import { seedAiPendingAction } from '@/src/__tests__/factories/steel-ai.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AiUsageWeeklyEmailRepository } from '../ai-usage-weekly-email.repository'

const WEEK = {
  from: new Date('2026-09-28T00:00:00.000Z'),
  to: new Date('2026-10-05T00:00:00.000Z'),
}
const NOW = new Date('2026-10-05T11:00:00.000Z')

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AiUsageWeeklyEmailRepository.listWorkspaceIdsWithUsage', () => {
  it('lists each workspace with spend in the range once', async () => {
    const [a, b, idle] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedWorkspace(),
    ])
    await Promise.all([
      seedAiUsage(a.id, { createdAt: new Date('2026-09-28T00:00:00.000Z') }),
      seedAiUsage(a.id, { createdAt: new Date('2026-10-04T23:59:59.000Z') }),
      seedAiUsage(b.id, { createdAt: new Date('2026-10-01T12:00:00.000Z') }),
      // Outside the range.
      seedAiUsage(idle.id, { createdAt: new Date('2026-10-05T00:00:00.000Z') }),
      seedAiUsage(idle.id, { createdAt: new Date('2026-09-27T23:59:59.000Z') }),
    ])

    const ids = expectOk(
      await AiUsageWeeklyEmailRepository.listWorkspaceIdsWithUsage(WEEK),
    )
    expect(ids).toEqual([a.id, b.id].sort())
  })

  it('returns a database error when the query fails', async () => {
    vi.spyOn(prisma.aiUsage, 'groupBy').mockRejectedValueOnce(new Error('x'))
    expectErr(
      await AiUsageWeeklyEmailRepository.listWorkspaceIdsWithUsage(WEEK),
      'DATABASE_ERROR',
    )
  })
})

describe('AiUsageWeeklyEmailRepository.findWorkspaces', () => {
  it('returns the workspaces with their AI settings row', async () => {
    const [withSettings, without] = await Promise.all([
      seedWorkspace({ name: 'Com ajustes' }),
      seedWorkspace({ name: 'Sem ajustes', status: 'SUSPENDED' }),
    ])
    await seedWorkspaceAiSettings(withSettings.id, {
      usageWeeklyEmailEnabled: false,
    })

    const rows = expectOk(
      await AiUsageWeeklyEmailRepository.findWorkspaces([
        withSettings.id,
        without.id,
      ]),
    )
    const byId = new Map(rows.map((row) => [row.id, row]))
    expect(byId.get(withSettings.id)).toMatchObject({
      name: 'Com ajustes',
      slug: withSettings.slug,
      status: 'ACTIVE',
      aiSettings: expect.objectContaining({ usageWeeklyEmailEnabled: false }),
    })
    expect(byId.get(without.id)).toMatchObject({
      status: 'SUSPENDED',
      aiSettings: null,
    })
  })

  it('skips the query for an empty list', async () => {
    expect(
      expectOk(await AiUsageWeeklyEmailRepository.findWorkspaces([])),
    ).toEqual([])
  })

  it('returns a database error when the query fails', async () => {
    vi.spyOn(prisma.workspace, 'findMany').mockRejectedValueOnce(new Error('x'))
    expectErr(
      await AiUsageWeeklyEmailRepository.findWorkspaces(['ws']),
      'DATABASE_ERROR',
    )
  })
})

describe('AiUsageWeeklyEmailRepository.listOwners', () => {
  it('returns only OWNERs not scheduled for deletion', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const [owner, leaving, admin, otherOwner] = await Promise.all([
      seedUser({ name: 'Ana Dona', email: 'ana-dona@example.com' }),
      seedUser({ name: 'Saindo' }),
      seedUser({ name: 'Admin' }),
      seedUser({ name: 'Outro' }),
    ])
    await prisma.user.update({
      where: { id: leaving.id },
      data: { deletionScheduledAt: new Date() },
    })
    await Promise.all([
      seedMembership({
        userId: owner.id,
        workspaceId: workspace.id,
        role: 'OWNER',
      }),
      seedMembership({
        userId: leaving.id,
        workspaceId: workspace.id,
        role: 'OWNER',
      }),
      seedMembership({
        userId: admin.id,
        workspaceId: workspace.id,
        role: 'ADMIN',
      }),
      seedMembership({
        userId: otherOwner.id,
        workspaceId: other.id,
        role: 'OWNER',
      }),
    ])

    expect(
      expectOk(await AiUsageWeeklyEmailRepository.listOwners(workspace.id)),
    ).toEqual([
      { id: owner.id, name: 'Ana Dona', email: 'ana-dona@example.com' },
    ])
  })

  it('returns a database error when the query fails', async () => {
    vi.spyOn(prisma.membership, 'findMany').mockRejectedValueOnce(
      new Error('x'),
    )
    expectErr(
      await AiUsageWeeklyEmailRepository.listOwners('ws'),
      'DATABASE_ERROR',
    )
  })
})

describe('AiUsageWeeklyEmailRepository.agentActivity', () => {
  it('counts runs and successful agent writes in the week and open approvals', async () => {
    const [workspace, other] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
    ])
    const agent = await seedSteelAgent({ workspaceId: workspace.id })
    const otherAgent = await seedSteelAgent({ workspaceId: other.id })
    const [run] = await Promise.all([
      seedSteelAgentRun({
        workspaceId: workspace.id,
        agentId: agent.id,
        createdAt: new Date('2026-09-29T10:00:00.000Z'),
      }),
      seedSteelAgentRun({
        workspaceId: workspace.id,
        agentId: agent.id,
        createdAt: new Date('2026-10-04T23:00:00.000Z'),
      }),
      // Outside the week / other workspace.
      seedSteelAgentRun({
        workspaceId: workspace.id,
        agentId: agent.id,
        createdAt: new Date('2026-10-05T00:00:00.000Z'),
      }),
      seedSteelAgentRun({
        workspaceId: other.id,
        agentId: otherAgent.id,
        createdAt: new Date('2026-09-30T10:00:00.000Z'),
      }),
    ])

    const log = (overrides: {
      source?: 'AGENT' | 'ASSISTANT'
      outcome?: string
      createdAt?: Date
    }) =>
      prisma.aiActionLog.create({
        data: {
          workspaceId: workspace.id,
          source: 'AGENT',
          toolName: 'crm_create_task',
          kind: 'CREATE',
          args: {},
          outcome: 'success',
          createdAt: new Date('2026-09-30T10:00:00.000Z'),
          ...overrides,
        },
      })
    await Promise.all([
      log({}),
      log({ outcome: 'failure' }),
      log({ source: 'ASSISTANT' }),
      log({ createdAt: new Date('2026-09-27T10:00:00.000Z') }),
    ])

    await Promise.all([
      seedAiPendingAction(workspace.id, {
        agentRunId: run.id,
        expiresAt: new Date('2026-10-06T00:00:00.000Z'),
      }),
      // Expired, decided, or from the assistant: not counted.
      seedAiPendingAction(workspace.id, {
        agentRunId: run.id,
        expiresAt: new Date('2026-10-05T10:00:00.000Z'),
      }),
      seedAiPendingAction(workspace.id, {
        agentRunId: run.id,
        status: 'EXECUTED',
        expiresAt: new Date('2026-10-06T00:00:00.000Z'),
      }),
      seedAiPendingAction(workspace.id, {
        expiresAt: new Date('2026-10-06T00:00:00.000Z'),
      }),
    ])

    expect(
      expectOk(
        await AiUsageWeeklyEmailRepository.agentActivity(
          workspace.id,
          WEEK,
          NOW,
        ),
      ),
    ).toEqual({ runs: 2, actions: 1, pendingApprovals: 1 })
  })

  it('returns a database error when a count fails', async () => {
    vi.spyOn(prisma.steelAgentRun, 'count').mockRejectedValueOnce(
      new Error('x'),
    )
    expectErr(
      await AiUsageWeeklyEmailRepository.agentActivity('ws', WEEK, NOW),
      'DATABASE_ERROR',
    )
  })
})
