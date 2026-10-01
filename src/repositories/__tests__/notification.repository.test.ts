import { afterEach, describe, expect, it, vi } from 'vitest'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { NotificationRepository } from '../notification.repository'

function notification(
  workspaceId: string,
  userId: string,
  title: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    workspaceId,
    userId,
    kind: 'WHATSAPP_NEGATIVE_SENTIMENT' as const,
    title,
    body: 'corpo',
    ...overrides,
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

describe('NotificationRepository — inbox folders, filters and actions', () => {
  async function seedInbox() {
    const [workspace, user, other] = await Promise.all([
      seedWorkspace(),
      seedUser(),
      seedUser(),
    ])
    const base = new Date('2026-09-18T12:00:00Z').getTime()
    await NotificationRepository.createMany([
      notification(workspace.id, user.id, 'Chamado INC-000123 atribuído', {
        kind: 'SD_TICKET_ASSIGNED',
        body: 'Rede sem acesso no 3º andar',
        createdAt: new Date(base),
      }),
      notification(workspace.id, user.id, 'SLA violado: INC-000124', {
        kind: 'SD_SLA_BREACHED',
        body: 'Prazo de resolução estourou',
        createdAt: new Date(base + 1000),
      }),
      notification(workspace.id, user.id, 'Sentimento negativo: Maria', {
        body: 'Média -0,50',
        createdAt: new Date(base + 2000),
      }),
      notification(workspace.id, other.id, 'De outra pessoa', {
        createdAt: new Date(base + 3000),
      }),
    ])
    const ids = Object.fromEntries(
      (
        await prisma.notification.findMany({
          where: { workspaceId: workspace.id },
          select: { id: true, title: true },
        })
      ).map((n) => [n.title, n.id]),
    )
    return { workspace, user, other, ids }
  }

  it('should page the "all" folder by cursor, newest first', async () => {
    const { workspace, user } = await seedInbox()

    const first = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'all',
        limit: 2,
      }),
    )
    expect(first.items.map((n) => n.title)).toEqual([
      'Sentimento negativo: Maria',
      'SLA violado: INC-000124',
    ])
    expect(first.nextCursor).toBe(first.items[1].id)

    const second = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'all',
        limit: 2,
        cursor: first.nextCursor ?? undefined,
      }),
    )
    expect(second.items.map((n) => n.title)).toEqual([
      'Chamado INC-000123 atribuído',
    ])
    expect(second.nextCursor).toBeNull()
  })

  it('should filter by kind and search title or body, case-insensitively', async () => {
    const { workspace, user } = await seedInbox()

    const byKind = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'all',
        kinds: ['SD_SLA_BREACHED'],
        limit: 10,
      }),
    )
    expect(byKind.items.map((n) => n.title)).toEqual([
      'SLA violado: INC-000124',
    ])

    const byTitle = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'all',
        search: 'inc-000123',
        limit: 10,
      }),
    )
    expect(byTitle.items.map((n) => n.title)).toEqual([
      'Chamado INC-000123 atribuído',
    ])

    const byBody = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'all',
        search: 'ANDAR',
        limit: 10,
      }),
    )
    expect(byBody.items.map((n) => n.title)).toEqual([
      'Chamado INC-000123 atribuído',
    ])

    expect(
      expectOk(
        await NotificationRepository.listPage({
          workspaceId: workspace.id,
          userId: user.id,
          folder: 'all',
          kinds: [],
          limit: 10,
        }),
      ).items,
    ).toEqual([])
  })

  it('should move a notification between folders and count each one', async () => {
    const { workspace, user, ids } = await seedInbox()
    const slaId = ids['SLA violado: INC-000124']

    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [slaId],
          action: 'archive',
        }),
      ),
    ).toBe(1)
    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [ids['Sentimento negativo: Maria']],
          action: 'read',
        }),
      ),
    ).toBe(1)

    expect(
      expectOk(
        await NotificationRepository.countFolders(workspace.id, user.id),
      ),
    ).toEqual({ all: 2, unread: 1, archived: 1 })
    expect(
      expectOk(
        await NotificationRepository.countUnread(workspace.id, user.id),
      ),
    ).toBe(1)

    const archived = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'archived',
        limit: 10,
      }),
    )
    expect(archived.items.map((n) => n.id)).toEqual([slaId])

    const unread = expectOk(
      await NotificationRepository.listPage({
        workspaceId: workspace.id,
        userId: user.id,
        folder: 'unread',
        limit: 10,
      }),
    )
    expect(unread.items.map((n) => n.title)).toEqual([
      'Chamado INC-000123 atribuído',
    ])

    // Desarquivar devolve a notificação para "Tudo".
    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [slaId],
          action: 'unarchive',
        }),
      ),
    ).toBe(1)
    expect(
      expectOk(
        await NotificationRepository.countFolders(workspace.id, user.id),
      ),
    ).toEqual({ all: 3, unread: 2, archived: 0 })
  })

  it('should mark as unread again', async () => {
    const { workspace, user, ids } = await seedInbox()
    const id = ids['Sentimento negativo: Maria']

    await NotificationRepository.applyAction({
      workspaceId: workspace.id,
      userId: user.id,
      ids: [id],
      action: 'read',
    })
    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [id],
          action: 'unread',
        }),
      ),
    ).toBe(1)

    expect(
      expectOk(
        await NotificationRepository.countUnread(workspace.id, user.id),
      ),
    ).toBe(3)
  })

  it('should hide a deleted notification from every folder and restore it', async () => {
    const { workspace, user, ids } = await seedInbox()
    const id = ids['Chamado INC-000123 atribuído']

    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [id],
          action: 'delete',
        }),
      ),
    ).toBe(1)
    expect(
      expectOk(
        await NotificationRepository.countFolders(workspace.id, user.id),
      ),
    ).toEqual({ all: 2, unread: 2, archived: 0 })
    expect(
      expectOk(
        await NotificationRepository.listByUser(workspace.id, user.id, 10),
      ).map((n) => n.id),
    ).not.toContain(id)

    // Uma ação normal não enxerga mais a excluída; `restore` enxerga.
    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [id],
          action: 'archive',
        }),
      ),
    ).toBe(0)
    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [id],
          action: 'restore',
        }),
      ),
    ).toBe(1)
    expect(
      expectOk(
        await NotificationRepository.countFolders(workspace.id, user.id),
      ),
    ).toEqual({ all: 3, unread: 3, archived: 0 })
  })

  it('should ignore ids that belong to someone else', async () => {
    const { workspace, user, other, ids } = await seedInbox()

    expect(
      expectOk(
        await NotificationRepository.applyAction({
          workspaceId: workspace.id,
          userId: user.id,
          ids: [ids['De outra pessoa'], ids['SLA violado: INC-000124']],
          action: 'delete',
        }),
      ),
    ).toBe(1)
    expect(
      expectOk(
        await NotificationRepository.countFolders(workspace.id, other.id),
      ),
    ).toEqual({ all: 1, unread: 1, archived: 0 })
  })

  it('should keep the archived ones out of listByUser and countUnread', async () => {
    const { workspace, user, ids } = await seedInbox()

    await NotificationRepository.applyAction({
      workspaceId: workspace.id,
      userId: user.id,
      ids: [ids['SLA violado: INC-000124']],
      action: 'archive',
    })

    expect(
      expectOk(
        await NotificationRepository.listByUser(workspace.id, user.id, 10),
      ).map((n) => n.title),
    ).toEqual(['Sentimento negativo: Maria', 'Chamado INC-000123 atribuído'])
    expect(
      expectOk(
        await NotificationRepository.countUnread(workspace.id, user.id),
      ),
    ).toBe(2)

    // "Marcar todas" não mexe nas arquivadas.
    expect(
      expectOk(await NotificationRepository.markRead(workspace.id, user.id)),
    ).toBe(2)
    expect(
      expectOk(
        await NotificationRepository.countFolders(workspace.id, user.id),
      ),
    ).toEqual({ all: 2, unread: 0, archived: 1 })
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
    vi.spyOn(prisma.notification, 'findMany').mockRejectedValue(
      new Error('boom'),
    )
    vi.spyOn(prisma.notification, 'count').mockRejectedValue(new Error('boom'))
    vi.spyOn(prisma.notification, 'updateMany').mockRejectedValue(
      new Error('boom'),
    )

    expectErr(
      await NotificationRepository.listByUser('w', 'u', 10),
      'DATABASE_ERROR',
    )
    expectErr(
      await NotificationRepository.listPage({
        workspaceId: 'w',
        userId: 'u',
        folder: 'all',
        limit: 10,
      }),
      'DATABASE_ERROR',
    )
    expectErr(
      await NotificationRepository.countUnread('w', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(
      await NotificationRepository.countFolders('w', 'u'),
      'DATABASE_ERROR',
    )
    expectErr(await NotificationRepository.markRead('w', 'u'), 'DATABASE_ERROR')
    expectErr(
      await NotificationRepository.applyAction({
        workspaceId: 'w',
        userId: 'u',
        ids: ['n1'],
        action: 'read',
      }),
      'DATABASE_ERROR',
    )
  })
})
