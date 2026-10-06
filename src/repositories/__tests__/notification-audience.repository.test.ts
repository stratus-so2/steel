import { describe, expect, it, vi } from 'vitest'
import { seedMembership } from '@/src/__tests__/factories/membership.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { NotificationAudienceRepository } from '../notification-audience.repository'

describe('NotificationAudienceRepository', () => {
  it('lists only the OWNER/ADMIN members of the workspace, capped', async () => {
    const workspace = await seedWorkspace()
    const [owner, admin, member, other] = await Promise.all([
      seedUser(),
      seedUser(),
      seedUser(),
      seedUser(),
    ])
    await seedMembership({
      userId: owner.id,
      workspaceId: workspace.id,
      role: 'OWNER',
    })
    await seedMembership({
      userId: admin.id,
      workspaceId: workspace.id,
      role: 'ADMIN',
    })
    await seedMembership({ userId: member.id, workspaceId: workspace.id })
    const otherWorkspace = await seedWorkspace()
    await seedMembership({
      userId: other.id,
      workspaceId: otherWorkspace.id,
      role: 'OWNER',
    })

    const ids = expectOk(
      await NotificationAudienceRepository.listPrivilegedUserIds(
        workspace.id,
        10,
      ),
    )
    expect([...ids].sort()).toEqual([owner.id, admin.id].sort())
    expect(
      expectOk(
        await NotificationAudienceRepository.listPrivilegedUserIds(
          workspace.id,
          1,
        ),
      ),
    ).toHaveLength(1)
  })

  it('maps failures to DATABASE_ERROR', async () => {
    const many = vi
      .spyOn(prisma.membership, 'findMany')
      .mockRejectedValueOnce(new Error('boom'))
    expectErr(
      await NotificationAudienceRepository.listPrivilegedUserIds('w', 1),
      'DATABASE_ERROR',
    )
    many.mockRestore()
  })
})
