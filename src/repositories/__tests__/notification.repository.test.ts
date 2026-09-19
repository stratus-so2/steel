import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { NotificationRepository } from '../notification.repository'

function notification(workspaceId: string, userId: string, title: string) {
  return {
    workspaceId,
    userId,
    kind: 'WHATSAPP_NEGATIVE_SENTIMENT' as const,
    title,
    body: 'corpo',
  }
}

describe('NotificationRepository', () => {
  it('should create, list, count and mark notifications per user', async () => {
    const [workspace, alice, bob] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    expect(
      expectOk(
        await NotificationRepository.createMany([
          notification(workspace.id, alice.id, 'A1'),
          notification(workspace.id, alice.id, 'A2'),
          notification(workspace.id, bob.id, 'B1'),
        ]),
      ),
    ).toBe(3)

    const aliceList = expectOk(
      await NotificationRepository.listByUser(workspace.id, alice.id, 10),
    )
    expect(aliceList.map((n) => n.title).sort()).toEqual(['A1', 'A2'])
    expect(
      expectOk(
        await NotificationRepository.countUnread(workspace.id, alice.id),
      ),
    ).toBe(2)

    // Alice não consegue marcar a notificação do Bob.
    const bobId = expectOk(
      await NotificationRepository.listByUser(workspace.id, bob.id, 10),
    )[0].id
    expect(
      expectOk(
        await NotificationRepository.markRead(workspace.id, alice.id, [
          aliceList[0].id,
          bobId,
        ]),
      ),
    ).toBe(1)
    expect(
      expectOk(await NotificationRepository.countUnread(workspace.id, bob.id)),
    ).toBe(1)

    expect(
      expectOk(await NotificationRepository.markRead(workspace.id, alice.id)),
    ).toBe(1)
    expect(
      expectOk(
        await NotificationRepository.countUnread(workspace.id, alice.id),
      ),
    ).toBe(0)
  })
})

describe('NotificationRepository — edge cases and failures', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('createMany() should skip the query for an empty batch', async () => {
    const spy = vi.spyOn(prisma.notification, 'createMany')
    expect(expectOk(await NotificationRepository.createMany([]))).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })

  it('createMany() should return DATABASE_ERROR for an unknown workspace', async () => {
    const user = await seedUser()
    expectErr(
      await NotificationRepository.createMany([
        notification('missing', user.id, 'x'),
      ]),
      'DATABASE_ERROR',
    )
  })

  it('should return DATABASE_ERROR when reads and updates throw', async () => {
    vi.spyOn(prisma.notification, 'findMany').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.notification, 'count').mockRejectedValueOnce(
      new Error('boom'),
    )
    vi.spyOn(prisma.notification, 'updateMany').mockRejectedValueOnce(
      new Error('boom'),
    )

    expectErr(
      await NotificationRepository.listByUser('w', 'u', 10),
      'DATABASE_ERROR',
    )
    expectErr(
      await NotificationRepository.countUnread('w', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(await NotificationRepository.markRead('w', 'u'), 'DATABASE_ERROR')
  })
})
