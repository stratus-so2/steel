import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedSubscription } from '@/src/__tests__/factories/subscription.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AdminMetricsRepository } from '../admin-metrics.repository'

describe('AdminMetricsRepository', () => {
  it('countWorkspaces() counts every workspace', async () => {
    await Promise.all([seedWorkspace(), seedWorkspace()])
    expect(expectOk(await AdminMetricsRepository.countWorkspaces())).toBe(2)
  })

  it('countWorkspacesWithLoginSince() counts workspaces with a recent member session', async () => {
    const [active, idle, user, idleUser] = await Promise.all([
      seedWorkspace(),
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    await seedMembership({ userId: user.id, workspaceId: active.id })
    await seedMembership({ userId: idleUser.id, workspaceId: idle.id })
    await prisma.session.create({
      data: {
        token: `t-${user.id}`,
        userId: user.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    })

    const since = new Date(Date.now() - 30 * 86_400_000)
    expect(
      expectOk(
        await AdminMetricsRepository.countWorkspacesWithLoginSince(since),
      ),
    ).toBe(1)
  })

  it('listPayingSubscriptions() returns PAID subscriptions of paid-plan workspaces only', async () => {
    const [pro, downgraded] = await Promise.all([
      seedWorkspace({ activePlan: 'PRO' }),
      seedWorkspace({ activePlan: 'FREE' }),
    ])
    await seedSubscription({
      workspaceId: pro.id,
      status: 'PAID',
      amount: 4302,
    })
    await seedSubscription({ workspaceId: pro.id, status: 'PENDING' })
    await seedSubscription({
      workspaceId: downgraded.id,
      status: 'PAID',
      amount: 999,
    })

    const subs = expectOk(
      await AdminMetricsRepository.listPayingSubscriptions(),
    )
    expect(subs).toEqual([
      { workspaceId: pro.id, amount: 4302, interval: 'MONTHLY' },
    ])
  })

  it('listEndedSubscriptionsSince() returns cancelled and expired subscriptions', async () => {
    const workspace = await seedWorkspace()
    await seedSubscription({ workspaceId: workspace.id, status: 'CANCELLED' })
    await seedSubscription({ workspaceId: workspace.id, status: 'EXPIRED' })
    await seedSubscription({ workspaceId: workspace.id, status: 'PAID' })

    const ended = expectOk(
      await AdminMetricsRepository.listEndedSubscriptionsSince(
        new Date(Date.now() - 86_400_000),
      ),
    )
    expect(ended.map((s) => s.status).sort()).toEqual(['CANCELLED', 'EXPIRED'])
    expect(ended[0].endedAt).toBeInstanceOf(Date)
  })
})

describe('AdminMetricsRepository — database failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns DATABASE_ERROR when the queries throw', async () => {
    vi.spyOn(prisma.workspace, 'count')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))
    vi.spyOn(prisma.subscription, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
      .mockRejectedValueOnce(new Error('boom'))

    expectErr(await AdminMetricsRepository.countWorkspaces(), 'DATABASE_ERROR')
    expectErr(
      await AdminMetricsRepository.countWorkspacesWithLoginSince(new Date()),
      'DATABASE_ERROR',
    )
    expectErr(
      await AdminMetricsRepository.listPayingSubscriptions(),
      'DATABASE_ERROR',
    )
    expectErr(
      await AdminMetricsRepository.listEndedSubscriptionsSince(new Date()),
      'DATABASE_ERROR',
    )
  })
})
