import { describe, expect, it } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { AdminOverviewRepository } from '../admin-overview.repository'
import { BackupRepository } from '../backup.repository'
import { WorkspaceRepository } from '../workspace.repository'

describe('AdminOverviewRepository', () => {
  it('counts workspaces by status, trial and creation window', async () => {
    const now = new Date()
    await seedWorkspace()
    await seedWorkspace({ status: 'SUSPENDED' })
    await seedWorkspace({ trialEndsAt: new Date(now.getTime() + 86_400_000) })
    const old = await seedWorkspace()
    await prisma.workspace.update({
      where: { id: old.id },
      data: { createdAt: new Date(now.getTime() - 45 * 86_400_000) },
    })

    const counts = expectOk(await AdminOverviewRepository.workspaceCounts(now))

    expect(counts).toMatchObject({
      total: 4,
      active: 3,
      suspended: 1,
      deleting: 0,
      trial: 1,
      createdLast30d: 3,
      createdPrev30d: 1,
    })
  })

  it('counts users and lists recent signups newest first', async () => {
    await seedUser({ email: 'a@x.com' })
    await new Promise((r) => setTimeout(r, 5))
    await seedUser({ email: 'b@x.com' })

    const users = expectOk(await AdminOverviewRepository.userCounts(new Date()))
    expect(users).toMatchObject({ total: 2, createdLast7d: 2 })

    const signups = expectOk(await AdminOverviewRepository.recentSignups(1))
    expect(signups.map((s) => s.email)).toEqual(['b@x.com'])
  })
})

describe('BackupRepository', () => {
  it('lists by scope/workspace and reports which workspaces still exist', async () => {
    const workspace = await seedWorkspace()
    await prisma.backup.createMany({
      data: [
        { scope: 'FULL' },
        { scope: 'WORKSPACE', workspaceId: workspace.id },
        { scope: 'WORKSPACE', workspaceId: 'deleted-ws' },
      ],
    })

    expect(
      expectOk(await BackupRepository.list({ scope: 'WORKSPACE', limit: 10 })),
    ).toHaveLength(2)
    expect(
      expectOk(
        await BackupRepository.list({ workspaceId: workspace.id, limit: 10 }),
      ),
    ).toHaveLength(1)

    const existing = expectOk(
      await BackupRepository.existingWorkspaceIds([workspace.id, 'deleted-ws']),
    )
    expect([...existing]).toEqual([workspace.id])
  })
})

describe('WorkspaceRepository lifecycle', () => {
  it('sets status and plan (clearing the trial) and counts members', async () => {
    const workspace = await seedWorkspace({
      trialEndsAt: new Date(Date.now() + 86_400_000),
    })

    const suspended = expectOk(
      await WorkspaceRepository.setStatus(workspace.id, {
        status: 'SUSPENDED',
        suspendedReason: 'x',
      }),
    )
    expect(suspended.status).toBe('SUSPENDED')

    const planned = expectOk(
      await WorkspaceRepository.setPlan(workspace.id, 'ENTERPRISE'),
    )
    expect(planned).toMatchObject({
      activePlan: 'ENTERPRISE',
      trialEndsAt: null,
    })

    const found = expectOk(
      await WorkspaceRepository.findWithMemberCount(workspace.id),
    )
    expect(found?.memberCount).toBe(0)
    expect(
      expectOk(await WorkspaceRepository.findWithMemberCount('missing')),
    ).toBeNull()
  })
})
