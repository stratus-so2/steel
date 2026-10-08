import type {
  Prisma,
  SdIntegrationLink,
  SdIntegrationLinkKind,
  SdMessageAuthorKind,
  WorkspaceIntegration,
} from '@prisma/client'
import { sdIntegrationLinkNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

/**
 * ServiceDesk side of the integrations: the ticket ↔ Slack thread /
 * GitHub issue-PR / GitLab issue-MR links. The connections themselves are
 * workspace-level (`WorkspaceIntegrationRepository`, ADR 0024).
 */

export interface SdIntegrationLinkData {
  externalUrl?: string | null
  externalState?: string | null
  meta?: Prisma.InputJsonValue
}

/** Link with the connection it belongs to (reconciliation tick). */
export type SdIntegrationLinkWithTicket = SdIntegrationLink & {
  integration: WorkspaceIntegration
}

/** Link kinds of each repository provider. */
export const SD_REPO_LINK_KINDS = {
  GITHUB: ['GITHUB_ISSUE', 'GITHUB_PULL_REQUEST'],
  GITLAB: ['GITLAB_ISSUE', 'GITLAB_MERGE_REQUEST'],
} as const satisfies Record<string, readonly SdIntegrationLinkKind[]>

export type SdRepoProvider = keyof typeof SD_REPO_LINK_KINDS

export const SdIntegrationRepository = {
  async listLinks(
    workspaceId: string,
    ticketId: string,
  ): Promise<Result<SdIntegrationLink[]>> {
    return sdDb('Failed to list ServiceDesk integration links', () =>
      prisma.sdIntegrationLink.findMany({
        where: { workspaceId, ticketId },
        orderBy: { createdAt: 'asc' },
      }),
    )
  },

  async findLink(
    id: string,
    workspaceId: string,
  ): Promise<Result<SdIntegrationLink>> {
    return sdDbFind(
      'Failed to find ServiceDesk integration link',
      () => prisma.sdIntegrationLink.findFirst({ where: { id, workspaceId } }),
      sdIntegrationLinkNotFound(),
    )
  },

  async findLinkByExternalKey(
    integrationId: string,
    kind: SdIntegrationLinkKind,
    externalKey: string,
  ): Promise<Result<SdIntegrationLink | null>> {
    return sdDb('Failed to find ServiceDesk integration link by key', () =>
      prisma.sdIntegrationLink.findFirst({
        where: { integrationId, kind, externalKey },
      }),
    )
  },

  /**
   * Repository link by key, whatever the item kind: GitHub issues and PRs
   * share the number (`owner/repo#n`); GitLab keys carry the sigil
   * (`group/project#n` × `group/project!n`).
   */
  async findRepoLinkByKey(
    integrationId: string,
    provider: SdRepoProvider,
    externalKey: string,
  ): Promise<Result<SdIntegrationLink | null>> {
    return sdDb('Failed to find ServiceDesk repository link', () =>
      prisma.sdIntegrationLink.findFirst({
        where: {
          integrationId,
          externalKey,
          kind: { in: [...SD_REPO_LINK_KINDS[provider]] },
        },
      }),
    )
  },

  /** Slack thread: which ticket the reply feeds. */
  async findSlackThread(
    integrationId: string,
    externalKey: string,
  ): Promise<Result<SdIntegrationLink | null>> {
    return sdDb('Failed to find ServiceDesk Slack thread link', () =>
      prisma.sdIntegrationLink.findFirst({
        where: { integrationId, kind: 'SLACK_THREAD', externalKey },
      }),
    )
  },

  async createLink(data: {
    workspaceId: string
    integrationId: string
    ticketId: string
    kind: SdIntegrationLinkKind
    externalKey: string
    externalUrl?: string | null
    externalState?: string | null
    meta?: Prisma.InputJsonValue
    createdById?: string | null
  }): Promise<Result<SdIntegrationLink>> {
    return sdDb(
      'Failed to create ServiceDesk integration link',
      () => prisma.sdIntegrationLink.create({ data }),
      'Este item já está vinculado a um chamado',
    )
  },

  async updateLink(
    id: string,
    data: SdIntegrationLinkData,
  ): Promise<Result<SdIntegrationLink>> {
    return sdDb('Failed to update ServiceDesk integration link', () =>
      prisma.sdIntegrationLink.update({ where: { id }, data }),
    )
  },

  async removeLink(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to delete ServiceDesk integration link', async () => {
      await prisma.sdIntegrationLink.deleteMany({ where: { id, workspaceId } })
    })
  },

  /**
   * GitHub/GitLab links not merged yet, for the hourly reconciliation (lost
   * webhook). Only links of live connections, of tickets not closed.
   */
  async listRepoLinksToSync(
    limit: number,
    workspaceId?: string,
  ): Promise<Result<SdIntegrationLinkWithTicket[]>> {
    return sdDb('Failed to list ServiceDesk repository links to sync', () =>
      prisma.sdIntegrationLink.findMany({
        where: {
          kind: {
            in: [...SD_REPO_LINK_KINDS.GITHUB, ...SD_REPO_LINK_KINDS.GITLAB],
          },
          externalState: { not: 'merged' },
          integration: {
            kind: { in: ['GITHUB', 'GITLAB'] },
            deletedAt: null,
            ...(workspaceId ? { workspaceId } : {}),
          },
          ticket: { deletedAt: null, phase: { category: { not: 'CLOSED' } } },
        },
        include: { integration: true },
        orderBy: { updatedAt: 'asc' },
        take: limit,
      }),
    )
  },

  /**
   * Whether the ticket has the workspace's highest priority level (the
   * "urgent ticket" Slack event). No priority = not urgent.
   */
  async isTopPriorityTicket(
    workspaceId: string,
    ticketId: string,
  ): Promise<Result<boolean>> {
    return sdDb('Failed to check ServiceDesk ticket priority', async () => {
      const ticket = await prisma.sdTicket.findFirst({
        where: { id: ticketId, workspaceId },
        select: { priority: { select: { level: true } } },
      })
      if (!ticket?.priority) return false
      const top = await prisma.sdPriority.aggregate({
        where: { workspaceId },
        _max: { level: true },
      })
      return ticket.priority.level === top._max.level
    })
  },

  /* ------------------------------ flow support ------------------------------ */

  /** Platform user by e-mail (matches the Slack author with the account). */
  async findWorkspaceUserByEmail(
    workspaceId: string,
    email: string,
  ): Promise<Result<{ id: string } | null>> {
    return sdDb('Failed to find ServiceDesk user by email', async () => {
      const membership = await prisma.membership.findFirst({
        where: {
          workspaceId,
          user: { email: { equals: email, mode: 'insensitive' } },
        },
        select: { userId: true },
      })
      return membership ? { id: membership.userId } : null
    })
  },

  /** Message in the ticket history (reply that came from Slack). */
  async createTicketMessage(data: {
    workspaceId: string
    ticketId: string
    authorKind: SdMessageAuthorKind
    authorUserId: string | null
    body: string
  }): Promise<Result<{ id: string }>> {
    return sdDb('Failed to create ServiceDesk integration message', () =>
      prisma.sdTicketMessage.create({
        data: { ...data, visibility: 'PUBLIC' },
        select: { id: true },
      }),
    )
  },
}
