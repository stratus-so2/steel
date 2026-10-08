import type {
  Prisma,
  WorkspaceIntegration,
  WorkspaceIntegrationKind,
  WorkspaceIntegrationStatus,
} from '@prisma/client'
import { sdIntegrationNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

/**
 * Workspace-level integrations (Slack, GitHub, GitLab — Ajustes >
 * Integrações). Pure Prisma, no business rules.
 *
 * Disconnecting is logical (`deletedAt`) so the ticket links that point at a
 * connection stay in the ticket history; every lookup here only sees live
 * rows. One live connection per (workspace, kind): `connect` retires the
 * previous one of the same kind in the same transaction.
 */

export interface WorkspaceIntegrationData {
  status?: WorkspaceIntegrationStatus
  statusError?: string | null
  externalId?: string
  externalName?: string | null
  baseUrl?: string | null
  encryptedToken?: string
  encryptedSigningSecret?: string | null
  config?: Prisma.InputJsonValue
  lastCheckedAt?: Date | null
}

export interface WaitingConversationRow {
  id: string
  lastMessageAt: Date
  unreadCount: number
  contactName: string | null
}

const LIVE = { deletedAt: null } as const

export const WorkspaceIntegrationRepository = {
  /** Live connections of the workspace, newest first. */
  async list(workspaceId: string): Promise<Result<WorkspaceIntegration[]>> {
    return sdDb('Failed to list workspace integrations', () =>
      prisma.workspaceIntegration.findMany({
        where: { workspaceId, ...LIVE },
        orderBy: { updatedAt: 'desc' },
      }),
    )
  },

  async findByKind(
    workspaceId: string,
    kind: WorkspaceIntegrationKind,
  ): Promise<Result<WorkspaceIntegration | null>> {
    return sdDb('Failed to find workspace integration', () =>
      prisma.workspaceIntegration.findFirst({
        where: { workspaceId, kind, ...LIVE },
        orderBy: { updatedAt: 'desc' },
      }),
    )
  },

  async requireByKind(
    workspaceId: string,
    kind: WorkspaceIntegrationKind,
  ): Promise<Result<WorkspaceIntegration>> {
    return sdDbFind(
      'Failed to find workspace integration',
      () =>
        prisma.workspaceIntegration.findFirst({
          where: { workspaceId, kind, ...LIVE },
          orderBy: { updatedAt: 'desc' },
        }),
      sdIntegrationNotFound(),
    )
  },

  async findById(id: string): Promise<Result<WorkspaceIntegration | null>> {
    return sdDb('Failed to find workspace integration by id', () =>
      prisma.workspaceIntegration.findFirst({ where: { id, ...LIVE } }),
    )
  },

  /**
   * Live connections with this external identity — the public webhooks find
   * the workspace here (Slack team, GitHub `owner/repo`, GitLab project).
   * More than one workspace may connect the same repository: the webhook
   * picks the one whose secret verifies.
   */
  async findManyByExternalId(
    kind: WorkspaceIntegrationKind,
    externalId: string,
  ): Promise<Result<WorkspaceIntegration[]>> {
    return sdDb('Failed to find workspace integrations by external id', () =>
      prisma.workspaceIntegration.findMany({
        where: {
          kind,
          externalId: { equals: externalId, mode: 'insensitive' },
          ...LIVE,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
      }),
    )
  },

  /** Live connections of one kind across workspaces (worker ticks). */
  async listLiveByKind(
    kind: WorkspaceIntegrationKind,
  ): Promise<Result<WorkspaceIntegration[]>> {
    return sdDb('Failed to list workspace integrations by kind', () =>
      prisma.workspaceIntegration.findMany({
        where: { kind, status: { not: 'DISCONNECTED' }, ...LIVE },
        orderBy: { createdAt: 'asc' },
      }),
    )
  },

  /**
   * Creates or revives the (workspace, kind, externalId) connection and
   * retires any other live connection of the same kind (a workspace has one
   * Slack, one GitHub repository and one GitLab project).
   */
  async connect(
    workspaceId: string,
    kind: WorkspaceIntegrationKind,
    externalId: string,
    data: WorkspaceIntegrationData & {
      encryptedToken: string
      createdById: string
    },
  ): Promise<Result<WorkspaceIntegration>> {
    return sdDb('Failed to save workspace integration', () =>
      prisma.$transaction(async (tx) => {
        await tx.workspaceIntegration.updateMany({
          where: {
            workspaceId,
            kind,
            externalId: { not: externalId },
            ...LIVE,
          },
          data: {
            deletedAt: new Date(),
            status: 'DISCONNECTED',
            encryptedToken: '',
            encryptedSigningSecret: null,
          },
        })
        return tx.workspaceIntegration.upsert({
          where: {
            workspaceId_kind_externalId: { workspaceId, kind, externalId },
          },
          create: { ...data, workspaceId, kind, externalId },
          update: {
            ...data,
            status: data.status ?? 'ACTIVE',
            statusError: data.statusError ?? null,
            deletedAt: null,
          },
        })
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: WorkspaceIntegrationData,
  ): Promise<Result<WorkspaceIntegration>> {
    return sdDb('Failed to update workspace integration', () =>
      prisma.workspaceIntegration.update({ where: { id, workspaceId }, data }),
    )
  },

  /** Stamps the error returned by the provider (worker flow, no user). */
  async markError(id: string, statusError: string): Promise<Result<void>> {
    return sdDb('Failed to mark workspace integration error', async () => {
      await prisma.workspaceIntegration.update({
        where: { id },
        data: { status: 'ERROR', statusError: statusError.slice(0, 500) },
      })
    })
  },

  /**
   * Last event seen (webhook received, Slack message delivered). A
   * successful event also clears a previous error: the connection works.
   */
  async markEvent(id: string, type: string): Promise<Result<void>> {
    return sdDb('Failed to mark workspace integration event', async () => {
      await prisma.workspaceIntegration.updateMany({
        where: { id, ...LIVE },
        data: {
          lastEventAt: new Date(),
          lastEventType: type.slice(0, 120),
          status: 'ACTIVE',
          statusError: null,
        },
      })
    })
  },

  /** Disconnect: leaves the lists, stops the webhooks and loses the token. */
  async disconnect(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to disconnect workspace integration', async () => {
      await prisma.workspaceIntegration.update({
        where: { id, workspaceId },
        data: {
          deletedAt: new Date(),
          status: 'DISCONNECTED',
          encryptedToken: '',
          encryptedSigningSecret: null,
        },
      })
    })
  },

  /**
   * Comunicação conversations waiting for a reply: open, not archived, with
   * unread inbound messages and the last message inside the window
   * (`olderThan` ≥ lastMessageAt > `newerThan`).
   */
  async listWaitingConversations(
    workspaceId: string,
    olderThan: Date,
    newerThan: Date,
    limit: number,
  ): Promise<Result<WaitingConversationRow[]>> {
    return sdDb('Failed to list waiting conversations', async () => {
      const rows = await prisma.whatsAppConversation.findMany({
        where: {
          workspaceId,
          status: { not: 'CLOSED' },
          deletedAt: null,
          archivedAt: null,
          unreadCount: { gt: 0 },
          lastMessageAt: { lte: olderThan, gt: newerThan },
        },
        select: {
          id: true,
          lastMessageAt: true,
          unreadCount: true,
          contact: { select: { name: true } },
        },
        orderBy: { lastMessageAt: 'asc' },
        take: limit,
      })
      return rows.map((row) => ({
        id: row.id,
        // Never null here: the query filters on lastMessageAt.
        lastMessageAt: row.lastMessageAt as Date,
        unreadCount: row.unreadCount,
        contactName: row.contact.name,
      }))
    })
  },
}
