import { describe, expect, it, vi } from 'vitest'
import { seedWorkspaceIntegration } from '@/src/__tests__/factories/sd-integration.factory'
import { seedUser } from '@/src/__tests__/factories/user.factory'
import { seedWorkspace } from '@/src/__tests__/factories/workspace.factory'
import { expectErr, expectOk } from '@/src/__tests__/helpers/result.helpers'
import { prisma } from '@/src/lib/prisma'
import { WorkspaceIntegrationRepository } from '../workspace-integration.repository'

async function setup() {
  const [workspace, other, user] = await Promise.all([
    seedWorkspace(),
    seedWorkspace(),
    seedUser(),
  ])
  return { workspace, other, user }
}

let counter = 0

async function seedConversation(
  workspaceId: string,
  data: {
    lastMessageAt: Date | null
    unreadCount?: number
    status?: 'NEW' | 'IN_PROGRESS' | 'CLOSED'
    archivedAt?: Date | null
    name?: string | null
  },
) {
  counter += 1
  const user = await seedUser()
  const connection = await prisma.whatsAppConnection.create({
    data: {
      workspaceId,
      provider: 'ZAPI',
      label: 'Suporte',
      phoneNumber: `55119${String(counter).padStart(8, '0')}`,
      zapiInstanceId: `instance-wi-${counter}-${Date.now()}`,
      encryptedZapiToken: 'enc:token',
      createdById: user.id,
    },
  })
  const contact = await prisma.whatsAppContact.create({
    data: {
      workspaceId,
      waId: `55119${Math.floor(Math.random() * 1e8)}`,
      name: data.name ?? null,
    },
  })
  return prisma.whatsAppConversation.create({
    data: {
      workspaceId,
      connectionId: connection.id,
      contactId: contact.id,
      status: data.status ?? 'NEW',
      unreadCount: data.unreadCount ?? 2,
      lastMessageAt: data.lastMessageAt,
      archivedAt: data.archivedAt ?? null,
    },
  })
}

describe('WorkspaceIntegrationRepository — reads', () => {
  it('lists the live connections of the workspace, newest first', async () => {
    const { workspace, other, user } = await setup()
    await seedWorkspaceIntegration(workspace.id, user.id, { kind: 'SLACK' })
    await seedWorkspaceIntegration(workspace.id, user.id, {
      kind: 'GITLAB',
      externalId: 'grupo/projeto',
      baseUrl: 'https://gitlab.com',
    })
    const gone = await seedWorkspaceIntegration(workspace.id, user.id, {
      kind: 'GITHUB',
      externalId: 'owner/repo',
      deletedAt: new Date(),
    })
    await seedWorkspaceIntegration(other.id, user.id)

    const rows = expectOk(
      await WorkspaceIntegrationRepository.list(workspace.id),
    )
    expect(rows.map((r) => r.kind).sort()).toEqual(['GITLAB', 'SLACK'])
    expect(rows.every((r) => r.id !== gone.id)).toBe(true)
  })

  it('finds by kind (null when absent) and requireByKind errors', async () => {
    const { workspace, user } = await setup()
    const slack = await seedWorkspaceIntegration(workspace.id, user.id)
    expect(
      expectOk(
        await WorkspaceIntegrationRepository.findByKind(workspace.id, 'SLACK'),
      )?.id,
    ).toBe(slack.id)
    expect(
      expectOk(
        await WorkspaceIntegrationRepository.findByKind(workspace.id, 'GITLAB'),
      ),
    ).toBeNull()
    expectOk(
      await WorkspaceIntegrationRepository.requireByKind(workspace.id, 'SLACK'),
    )
    expectErr(
      await WorkspaceIntegrationRepository.requireByKind(
        workspace.id,
        'GITHUB',
      ),
      'SD_INTEGRATION_NOT_FOUND',
    )
  })

  it('finds by id and by external id across workspaces, case-insensitive', async () => {
    const { workspace, other, user } = await setup()
    const mine = await seedWorkspaceIntegration(workspace.id, user.id, {
      kind: 'GITHUB',
      externalId: 'Owner/Repo',
    })
    const theirs = await seedWorkspaceIntegration(other.id, user.id, {
      kind: 'GITHUB',
      externalId: 'owner/repo',
    })
    await seedWorkspaceIntegration(other.id, user.id, {
      kind: 'GITLAB',
      externalId: 'owner/repo',
    })

    const found = expectOk(
      await WorkspaceIntegrationRepository.findManyByExternalId(
        'GITHUB',
        'owner/repo',
      ),
    )
    expect(found.map((r) => r.id).sort()).toEqual([mine.id, theirs.id].sort())
    expect(
      expectOk(await WorkspaceIntegrationRepository.findById(mine.id))?.id,
    ).toBe(mine.id)
    expect(
      expectOk(await WorkspaceIntegrationRepository.findById('missing')),
    ).toBeNull()
  })

  it('lists the live connections of one kind across workspaces', async () => {
    const { workspace, other, user } = await setup()
    const a = await seedWorkspaceIntegration(workspace.id, user.id)
    const b = await seedWorkspaceIntegration(other.id, user.id)
    await seedWorkspaceIntegration(other.id, user.id, {
      status: 'DISCONNECTED',
      externalId: 'T-off',
    })
    await seedWorkspaceIntegration(other.id, user.id, {
      kind: 'GITHUB',
      externalId: 'o/r',
    })
    const rows = expectOk(
      await WorkspaceIntegrationRepository.listLiveByKind('SLACK'),
    )
    expect(rows.map((r) => r.id).sort()).toEqual([a.id, b.id].sort())
  })
})

describe('WorkspaceIntegrationRepository — writes', () => {
  it('connect creates, revives the same connection and retires the previous one', async () => {
    const { workspace, user } = await setup()
    const first = expectOk(
      await WorkspaceIntegrationRepository.connect(
        workspace.id,
        'GITHUB',
        'owner/one',
        {
          encryptedToken: 'enc:a',
          encryptedSigningSecret: 'enc:s',
          createdById: user.id,
          externalName: 'owner/one',
        },
      ),
    )
    const second = expectOk(
      await WorkspaceIntegrationRepository.connect(
        workspace.id,
        'GITHUB',
        'owner/two',
        { encryptedToken: 'enc:b', createdById: user.id },
      ),
    )
    const retired = await prisma.workspaceIntegration.findUnique({
      where: { id: first.id },
    })
    expect(retired?.deletedAt).not.toBeNull()
    expect(retired?.status).toBe('DISCONNECTED')
    expect(retired?.encryptedToken).toBe('')
    expect(retired?.encryptedSigningSecret).toBeNull()

    const revived = expectOk(
      await WorkspaceIntegrationRepository.connect(
        workspace.id,
        'GITHUB',
        'owner/one',
        { encryptedToken: 'enc:c', createdById: user.id, statusError: null },
      ),
    )
    expect(revived.id).toBe(first.id)
    expect(revived.deletedAt).toBeNull()
    expect(revived.status).toBe('ACTIVE')
    expect(revived.encryptedToken).toBe('enc:c')
    const secondNow = await prisma.workspaceIntegration.findUnique({
      where: { id: second.id },
    })
    expect(secondNow?.deletedAt).not.toBeNull()
  })

  it('update, markError and markEvent stamp status, reason and last event', async () => {
    const { workspace, user } = await setup()
    const integration = await seedWorkspaceIntegration(workspace.id, user.id)
    expectOk(
      await WorkspaceIntegrationRepository.update(
        integration.id,
        workspace.id,
        {
          config: { routes: [] },
          lastCheckedAt: new Date('2026-10-08T10:00:00.000Z'),
        },
      ),
    )
    expectOk(
      await WorkspaceIntegrationRepository.markError(
        integration.id,
        'x'.repeat(600),
      ),
    )
    let row = await prisma.workspaceIntegration.findUnique({
      where: { id: integration.id },
    })
    expect(row?.status).toBe('ERROR')
    expect(row?.statusError).toHaveLength(500)
    expect(row?.config).toEqual({ routes: [] })

    vi.useFakeTimers({
      now: new Date('2026-10-08T12:00:00.000Z'),
      toFake: ['Date'],
    })
    expectOk(
      await WorkspaceIntegrationRepository.markEvent(
        integration.id,
        `slack:${'e'.repeat(200)}`,
      ),
    )
    vi.useRealTimers()
    row = await prisma.workspaceIntegration.findUnique({
      where: { id: integration.id },
    })
    expect(row?.status).toBe('ACTIVE')
    expect(row?.statusError).toBeNull()
    expect(row?.lastEventAt?.toISOString()).toBe('2026-10-08T12:00:00.000Z')
    expect(row?.lastEventType).toHaveLength(120)
  })

  it('disconnect erases the token and hides the connection', async () => {
    const { workspace, user } = await setup()
    const integration = await seedWorkspaceIntegration(workspace.id, user.id, {
      externalId: 'T-X',
      encryptedSigningSecret: 'enc:hook',
    })
    expectOk(
      await WorkspaceIntegrationRepository.disconnect(
        integration.id,
        workspace.id,
      ),
    )
    const row = await prisma.workspaceIntegration.findUnique({
      where: { id: integration.id },
    })
    expect(row?.status).toBe('DISCONNECTED')
    expect(row?.encryptedToken).toBe('')
    expect(row?.encryptedSigningSecret).toBeNull()
    expect(
      expectOk(
        await WorkspaceIntegrationRepository.findManyByExternalId(
          'SLACK',
          'T-X',
        ),
      ),
    ).toEqual([])
    // markEvent on a disconnected row is a no-op, not an error.
    expectOk(
      await WorkspaceIntegrationRepository.markEvent(integration.id, 'x'),
    )
  })

  it('refuses to update or disconnect a connection of another workspace', async () => {
    const { workspace, other, user } = await setup()
    const integration = await seedWorkspaceIntegration(workspace.id, user.id)
    expectErr(
      await WorkspaceIntegrationRepository.update(integration.id, other.id, {
        externalName: 'nope',
      }),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await WorkspaceIntegrationRepository.disconnect(integration.id, other.id),
      'SD_CONFIG_NOT_FOUND',
    )
    expectErr(
      await WorkspaceIntegrationRepository.markError('missing', 'boom'),
      'SD_CONFIG_NOT_FOUND',
    )
  })

  it('connect with an unknown creator is a database error', async () => {
    const { workspace } = await setup()
    expectErr(
      await WorkspaceIntegrationRepository.connect(
        workspace.id,
        'SLACK',
        'T-1',
        { encryptedToken: 'enc', createdById: 'missing-user' },
      ),
      'DATABASE_ERROR',
    )
  })
})

describe('WorkspaceIntegrationRepository.listWaitingConversations', () => {
  it('returns open conversations with unread messages inside the window', async () => {
    const { workspace, other } = await setup()
    const now = Date.parse('2026-10-08T12:00:00.000Z')
    const minutesAgo = (m: number) => new Date(now - m * 60_000)
    const waiting = await seedConversation(workspace.id, {
      lastMessageAt: minutesAgo(30),
      name: 'Maria',
    })
    // Too recent, too old, closed, archived, read, other workspace.
    await seedConversation(workspace.id, { lastMessageAt: minutesAgo(5) })
    await seedConversation(workspace.id, { lastMessageAt: minutesAgo(60 * 30) })
    await seedConversation(workspace.id, {
      lastMessageAt: minutesAgo(30),
      status: 'CLOSED',
    })
    await seedConversation(workspace.id, {
      lastMessageAt: minutesAgo(30),
      archivedAt: new Date(now),
    })
    await seedConversation(workspace.id, {
      lastMessageAt: minutesAgo(30),
      unreadCount: 0,
    })
    await seedConversation(other.id, { lastMessageAt: minutesAgo(30) })

    const rows = expectOk(
      await WorkspaceIntegrationRepository.listWaitingConversations(
        workspace.id,
        minutesAgo(15),
        minutesAgo(60 * 24),
        10,
      ),
    )
    expect(rows).toEqual([
      {
        id: waiting.id,
        lastMessageAt: minutesAgo(30),
        unreadCount: 2,
        contactName: 'Maria',
      },
    ])
  })
})
