import { describe, expect, it, vi } from 'vitest'
import { createFakeWorkspaceDTO } from '@/src/__tests__/factories/workspace.factory'
import { createFakeWorkspaceModuleAccess } from '@/src/__tests__/factories/workspace-module-access.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { databaseError, forbidden } from '@/src/errors'
import { err, ok } from '@/src/lib/result'
import type { NotificationDTO, NotificationListDTO } from '@/types/notification'

vi.mock('@/src/services/workspace.service')
vi.mock('@/src/services/membership.service')
vi.mock('@/src/services/notification.service')
vi.mock('@/src/services/search.service')

import { WorkspaceModuleAccessRepository } from '@/src/repositories/workspace-module-access.repository'
import { MembershipService } from '@/src/services/membership.service'
import { NotificationService } from '@/src/services/notification.service'
import { SearchService } from '@/src/services/search.service'
import { WorkspaceService } from '@/src/services/workspace.service'
import {
  PLATFORM_AI_TOOLS,
  wsMembersTool,
  wsNotificationsTool,
  wsOverviewTool,
  wsSearchTool,
} from '../ai/tools/platform'

const ctx = { workspaceId: 'ws1', actorId: 'u1', source: 'assistant' as const }
const workspaces = vi.mocked(WorkspaceService)
const memberships = vi.mocked(MembershipService)
const notifications = vi.mocked(NotificationService)
const modules = vi.mocked(WorkspaceModuleAccessRepository)

function notification(
  id: string,
  read: boolean,
  body = 'Corpo',
): NotificationDTO {
  return {
    id,
    workspaceId: 'ws1',
    kind: 'SD_TICKET_ASSIGNED',
    title: `Notificação ${id}`,
    body,
    href: '/x',
    read,
    readAt: null,
    archived: false,
    archivedAt: null,
    module: 'SERVICE_DESK',
    moduleLabel: 'ServiceDesk',
    kindLabel: 'Chamado atribuído',
    icon: 'ticket',
    color: 'blue',
    createdAt: '2026-10-06T12:00:00.000Z',
  } as NotificationDTO
}

function page(items: NotificationDTO[], unread: number): NotificationListDTO {
  return {
    items,
    unreadCount: unread,
    nextCursor: null,
    counts: { all: items.length, unread, archived: 0, snoozed: 0 },
  }
}

describe('PLATFORM_AI_TOOLS', () => {
  it('should be read-only platform tools', () => {
    expect(PLATFORM_AI_TOOLS.map((t) => [t.name, t.kind, t.module])).toEqual([
      ['ws_overview', 'READ', null],
      ['ws_members', 'READ', null],
      ['ws_notifications', 'READ', null],
      ['ws_search', 'READ', null],
    ])
  })
})

describe('ws_overview', () => {
  it('should summarize the workspace, enabled modules and members', async () => {
    workspaces.getById.mockResolvedValue(
      ok(
        createFakeWorkspaceDTO({
          name: 'Acme',
          slug: 'acme',
          activePlan: 'PRO',
        }),
      ),
    )
    modules.listByWorkspace.mockResolvedValue(
      ok([
        createFakeWorkspaceModuleAccess({ module: 'CRM', enabled: true }),
        createFakeWorkspaceModuleAccess({
          module: 'COMMUNICATION',
          enabled: false,
        }),
      ]),
    )
    memberships.countByWorkspace.mockResolvedValue(ok(4))

    const out = expectOk(await wsOverviewTool.execute(ctx, {}))
    expect(out.data).toEqual(
      expect.objectContaining({
        name: 'Acme',
        slug: 'acme',
        plan: 'PRO',
        enabledModules: ['CRM'],
        memberCount: 4,
      }),
    )
    expect(out.summary).toBe('Acme: 4 membro(s), 1 módulo(s) habilitado(s)')
  })

  it('should validate args and propagate failures', async () => {
    expectErr(wsOverviewTool.parse({ extra: 1 }), 'VALIDATION_ERROR')
    expectOk(wsOverviewTool.parse(undefined as never))

    workspaces.getById.mockResolvedValue(err(forbidden()))
    expectErr(await wsOverviewTool.execute(ctx, {}), 'FORBIDDEN')

    workspaces.getById.mockResolvedValue(ok(createFakeWorkspaceDTO()))
    modules.listByWorkspace.mockResolvedValue(err(databaseError()))
    memberships.countByWorkspace.mockResolvedValue(ok(1))
    expectErr(await wsOverviewTool.execute(ctx, {}), 'DATABASE_ERROR')

    modules.listByWorkspace.mockResolvedValue(ok([]))
    memberships.countByWorkspace.mockResolvedValue(err(databaseError()))
    expectErr(await wsOverviewTool.execute(ctx, {}), 'DATABASE_ERROR')
  })
})

describe('ws_members', () => {
  const members = [
    {
      userId: 'a',
      name: 'Ana Souza',
      email: 'ana@acme.com',
      image: null,
      role: 'OWNER' as const,
      profileId: null,
    },
    {
      userId: 'b',
      name: 'Bruno',
      email: 'bruno@acme.com',
      image: null,
      role: 'MEMBER' as const,
      profileId: null,
    },
    {
      userId: 'c',
      name: 'Carla',
      email: 'carla@x.com',
      image: null,
      role: 'MEMBER' as const,
      profileId: null,
    },
  ]

  it('should filter by name/e-mail and paginate', async () => {
    memberships.listMembers.mockResolvedValue(ok(members))
    const args = expectOk(wsMembersTool.parse({ query: 'ACME', limit: 1 }))
    const out = expectOk(await wsMembersTool.execute(ctx, args))
    expect(out.data).toEqual({
      total: 2,
      items: [
        {
          userId: 'a',
          name: 'Ana Souza',
          email: 'ana@acme.com',
          role: 'OWNER',
        },
      ],
    })
    expect(out.summary).toBe('2 membro(s) encontrado(s)')

    const all = expectOk(
      await wsMembersTool.execute(ctx, expectOk(wsMembersTool.parse({}))),
    )
    expect((all.data as { total: number }).total).toBe(3)
    expect(wsMembersTool.permission).toEqual({
      resource: 'members',
      action: 'VIEW',
    })
  })

  it('should reject bad limits and propagate the service error', async () => {
    expectErr(wsMembersTool.parse({ limit: 500 }), 'VALIDATION_ERROR')
    memberships.listMembers.mockResolvedValue(err(forbidden()))
    expectErr(await wsMembersTool.execute(ctx, { limit: 20 }), 'FORBIDDEN')
  })
})

describe('ws_notifications', () => {
  it('should list unread first and fill with the most recent', async () => {
    notifications.listInbox
      .mockResolvedValueOnce(
        ok(page([notification('n1', false, 'x'.repeat(400))], 1)),
      )
      .mockResolvedValueOnce(
        ok(
          page(
            [
              notification('n1', false),
              notification('n2', true),
              notification('n3', true),
            ],
            1,
          ),
        ),
      )

    const args = expectOk(
      wsNotificationsTool.parse({ limit: 2, module: 'SERVICE_DESK' }),
    )
    const out = expectOk(await wsNotificationsTool.execute(ctx, args))
    const data = out.data as {
      unreadCount: number
      items: { id: string; body: string }[]
    }

    expect(data.items.map((n) => n.id)).toEqual(['n1', 'n2'])
    expect(data.items[0].body).toHaveLength(301)
    expect(notifications.listInbox).toHaveBeenNthCalledWith(1, 'u1', 'ws1', {
      folder: 'unread',
      limit: 2,
      module: 'SERVICE_DESK',
      search: undefined,
    })
    expect(notifications.listInbox).toHaveBeenNthCalledWith(2, 'u1', 'ws1', {
      folder: 'all',
      limit: 2,
      module: 'SERVICE_DESK',
      search: undefined,
    })
    expect(out.summary).toBe('1 não lida(s), 2 listada(s)')
  })

  it('should skip the second page when only unread is asked or the page is full', async () => {
    notifications.listInbox.mockResolvedValue(
      ok(page([notification('n1', false)], 1)),
    )
    await wsNotificationsTool.execute(
      ctx,
      expectOk(wsNotificationsTool.parse({ onlyUnread: true })),
    )
    await wsNotificationsTool.execute(
      ctx,
      expectOk(wsNotificationsTool.parse({ limit: 1 })),
    )
    expect(notifications.listInbox).toHaveBeenCalledTimes(2)
  })

  it('should propagate failures', async () => {
    notifications.listInbox.mockResolvedValueOnce(err(forbidden()))
    expectErr(
      await wsNotificationsTool.execute(
        ctx,
        expectOk(wsNotificationsTool.parse({})),
      ),
      'FORBIDDEN',
    )

    notifications.listInbox
      .mockResolvedValueOnce(ok(page([], 0)))
      .mockResolvedValueOnce(err(databaseError()))
    expectErr(
      await wsNotificationsTool.execute(
        ctx,
        expectOk(wsNotificationsTool.parse({})),
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('ws_search', () => {
  const search = vi.mocked(SearchService)

  it('should parse the query, cap the limit and validate the types', () => {
    expect(expectOk(wsSearchTool.parse({ query: ' INC-1 ' }))).toEqual({
      query: 'INC-1',
      limit: 10,
    })
    expect(
      expectOk(wsSearchTool.parse({ query: 'agro', types: ['crm-lead'] })),
    ).toMatchObject({ types: ['crm-lead'] })
    expectErr(wsSearchTool.parse({ query: '' }), 'VALIDATION_ERROR')
    expectErr(
      wsSearchTool.parse({ query: 'x', types: ['nope'] }),
      'VALIDATION_ERROR',
    )
  })

  it('should call the global search with the actor and return compact items', async () => {
    search.search.mockResolvedValue(
      ok({
        query: 'agro',
        tookMs: 3,
        results: [
          {
            type: 'crm-company',
            id: 'c1',
            title: 'Agro Telecom',
            subtitle: 'agro.com.br',
            snippet: null,
            href: '/acme/crm/companies?record=c1',
            module: 'CRM',
            group: 'Empresas',
            score: 400,
            isMine: false,
            updatedAt: '2026-10-07T00:00:00.000Z',
          },
        ],
      }),
    )

    const out = expectOk(
      await wsSearchTool.execute(ctx, { query: 'agro', limit: 5 }),
    )

    expect(search.search).toHaveBeenCalledWith('u1', 'ws1', {
      q: 'agro',
      types: undefined,
      limit: 5,
    })
    expect(out.summary).toBe('1 resultado(s) para "agro"')
    expect(out.data).toEqual({
      items: [
        {
          type: 'crm-company',
          id: 'c1',
          title: 'Agro Telecom',
          subtitle: 'agro.com.br',
          snippet: null,
          href: '/acme/crm/companies?record=c1',
        },
      ],
    })
  })

  it('should propagate the search error', async () => {
    search.search.mockResolvedValue(err(forbidden()))
    expectErr(
      await wsSearchTool.execute(ctx, { query: 'x', limit: 10 }),
      'FORBIDDEN',
    )
  })
})
