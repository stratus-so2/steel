import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedAiUsage } from '@/src/__tests__/factories/ai-settings.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AiUsageAnalyticsRepository } from '../ai-usage-analytics.repository'

const RANGE = {
  from: new Date('2026-09-01T00:00:00.000Z'),
  to: new Date('2026-10-01T00:00:00.000Z'),
}

async function seedLedger() {
  const [workspace, other, ana, bob] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser({ name: 'Ana' }),
    seedUser({ name: 'Bob' }),
  ])
  await Promise.all([
    // 2026-09-02 (UTC): Ana gpt-4o-mini CRM + background WhatsApp.
    seedAiUsage(workspace.id, {
      userId: ana.id,
      feature: 'STEEL_ASSISTANT',
      module: 'CRM',
      costUsd: 1.5,
      inputTokens: 100,
      outputTokens: 10,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
    }),
    seedAiUsage(workspace.id, {
      userId: null,
      feature: 'WHATSAPP_REPLY',
      costUsd: 0.25,
      createdAt: new Date('2026-09-02T23:59:59.000Z'),
    }),
    // 2026-09-30: Bob on Opus.
    seedAiUsage(workspace.id, {
      userId: bob.id,
      feature: 'STEEL_ASSISTANT',
      provider: 'anthropic',
      model: 'claude-opus-5',
      costUsd: 2,
      createdAt: new Date('2026-09-30T23:00:00.000Z'),
    }),
    // Ana again, same group as the first row.
    seedAiUsage(workspace.id, {
      userId: ana.id,
      feature: 'STEEL_ASSISTANT',
      module: 'CRM',
      costUsd: 0.5,
      inputTokens: 50,
      outputTokens: 5,
      createdAt: new Date('2026-09-30T01:00:00.000Z'),
    }),
    // Outside the range and in another workspace: never counted.
    seedAiUsage(workspace.id, {
      userId: ana.id,
      costUsd: 9,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    }),
    seedAiUsage(workspace.id, {
      userId: ana.id,
      costUsd: 9,
      createdAt: new Date('2026-08-31T23:59:59.000Z'),
    }),
    seedAiUsage(other.id, {
      userId: ana.id,
      costUsd: 9,
      createdAt: new Date('2026-09-10T00:00:00.000Z'),
    }),
  ])
  return { workspace, ana, bob }
}

describe('AiUsageAnalyticsRepository', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sums cost per UTC day for the workspace and the given user', async () => {
    const { workspace, ana } = await seedLedger()

    const days = expectOk(
      await AiUsageAnalyticsRepository.dailyCosts(workspace.id, RANGE, ana.id),
    )
    expect(days).toEqual([
      { day: '2026-09-02', mineUsd: 1.5, workspaceUsd: 1.75 },
      { day: '2026-09-30', mineUsd: 0.5, workspaceUsd: 2.5 },
    ])

    const noUser = expectOk(
      await AiUsageAnalyticsRepository.dailyCosts(workspace.id, RANGE),
    )
    expect(noUser.map((d) => d.mineUsd)).toEqual([0, 0])
  })

  it('groups by provider, model, feature and module, optionally per user', async () => {
    const { workspace, ana } = await seedLedger()

    const all = expectOk(
      await AiUsageAnalyticsRepository.groupByDimensions(workspace.id, RANGE),
    )
    expect(all).toHaveLength(3)
    expect(all).toEqual(
      expect.arrayContaining([
        {
          provider: 'openai',
          model: 'gpt-4o-mini',
          feature: 'STEEL_ASSISTANT',
          module: 'CRM',
          costUsd: 2,
          inputTokens: 150,
          outputTokens: 15,
          calls: 2,
        },
        expect.objectContaining({
          model: 'claude-opus-5',
          module: null,
          calls: 1,
        }),
      ]),
    )

    const mine = expectOk(
      await AiUsageAnalyticsRepository.groupByDimensions(
        workspace.id,
        RANGE,
        ana.id,
      ),
    )
    expect(mine).toHaveLength(1)
    expect(mine[0].costUsd).toBe(2)
  })

  it('groups by user, with background usage as null, and finds names', async () => {
    const { workspace, ana, bob } = await seedLedger()

    const users = expectOk(
      await AiUsageAnalyticsRepository.groupByUser(workspace.id, RANGE),
    )
    const byId = new Map(users.map((u) => [u.userId, u.costUsd]))
    expect(byId).toEqual(
      new Map([
        [ana.id, 2],
        [bob.id, 2],
        [null, 0.25],
      ]),
    )

    expect(expectOk(await AiUsageAnalyticsRepository.findUsers([]))).toEqual([])
    const names = expectOk(
      await AiUsageAnalyticsRepository.findUsers([ana.id, bob.id]),
    )
    expect(names.map((u) => u.name).sort()).toEqual(['Ana', 'Bob'])
  })

  it('pages ledger rows oldest first with an id cursor', async () => {
    const { workspace, ana } = await seedLedger()

    const first = expectOk(
      await AiUsageAnalyticsRepository.exportPage(workspace.id, RANGE, {
        take: 3,
      }),
    )
    expect(first.map((r) => r.costUsd)).toEqual([1.5, 0.25, 0.5])
    expect(first[0]).toEqual(
      expect.objectContaining({
        userId: ana.id,
        userName: 'Ana',
        userEmail: ana.email,
        feature: 'STEEL_ASSISTANT',
        module: 'CRM',
      }),
    )
    expect(first[1].userName).toBeNull()

    const second = expectOk(
      await AiUsageAnalyticsRepository.exportPage(workspace.id, RANGE, {
        take: 3,
        cursor: first[2].id,
      }),
    )
    expect(second.map((r) => r.model)).toEqual(['claude-opus-5'])

    const mine = expectOk(
      await AiUsageAnalyticsRepository.exportPage(workspace.id, RANGE, {
        take: 10,
        userId: ana.id,
      }),
    )
    expect(mine).toHaveLength(2)
  })

  it('wraps database failures', async () => {
    const workspace = await seedWorkspace()
    vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('down'))
    vi.spyOn(prisma.aiUsage, 'groupBy')
      .mockRejectedValueOnce(new Error('down'))
      .mockRejectedValueOnce(new Error('down'))
    vi.spyOn(prisma.user, 'findMany').mockRejectedValueOnce(new Error('down'))
    vi.spyOn(prisma.aiUsage, 'findMany').mockRejectedValueOnce(
      new Error('down'),
    )

    expectErr(
      await AiUsageAnalyticsRepository.dailyCosts(workspace.id, RANGE),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiUsageAnalyticsRepository.groupByDimensions(workspace.id, RANGE),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiUsageAnalyticsRepository.groupByUser(workspace.id, RANGE),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiUsageAnalyticsRepository.findUsers(['x']),
      'DATABASE_ERROR',
    )
    expectErr(
      await AiUsageAnalyticsRepository.exportPage(workspace.id, RANGE, {
        take: 1,
      }),
      'DATABASE_ERROR',
    )
  })
})
