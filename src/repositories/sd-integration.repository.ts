import type {
  Prisma,
  SdIntegration,
  SdIntegrationKind,
  SdIntegrationLink,
  SdIntegrationLinkKind,
  SdIntegrationStatus,
  SdMessageAuthorKind,
} from '@prisma/client'
import { sdIntegrationLinkNotFound, sdIntegrationNotFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import type { Result } from '@/src/lib/result'
import { sdDb, sdDbFind } from './sd-config-db'

/**
 * Integrações do ServiceDesk e os vínculos chamado ↔ thread/issue/PR.
 *
 * A exclusão da integração é lógica (`deletedAt`) para os vínculos já
 * registrados continuarem no histórico do chamado. O webhook só encontra
 * integrações **não excluídas** — desconectar corta a entrada na hora.
 */

export interface SdIntegrationData {
  status?: SdIntegrationStatus
  statusError?: string | null
  externalId?: string
  externalName?: string | null
  encryptedToken?: string
  encryptedSigningSecret?: string | null
  config?: Prisma.InputJsonValue
}

export interface SdIntegrationLinkData {
  externalUrl?: string | null
  externalState?: string | null
  meta?: Prisma.InputJsonValue
}

/** Vínculo com o recorte do chamado que o webhook precisa. */
export type SdIntegrationLinkWithTicket = SdIntegrationLink & {
  integration: SdIntegration
}

export const SdIntegrationRepository = {
  /** Integrações ativas (não excluídas) do workspace. */
  async list(workspaceId: string): Promise<Result<SdIntegration[]>> {
    return sdDb('Failed to list ServiceDesk integrations', () =>
      prisma.sdIntegration.findMany({
        where: { workspaceId, deletedAt: null },
        orderBy: { kind: 'asc' },
      }),
    )
  },

  async findByKind(
    workspaceId: string,
    kind: SdIntegrationKind,
  ): Promise<Result<SdIntegration | null>> {
    return sdDb('Failed to find ServiceDesk integration', () =>
      prisma.sdIntegration.findFirst({
        where: { workspaceId, kind, deletedAt: null },
      }),
    )
  },

  async requireByKind(
    workspaceId: string,
    kind: SdIntegrationKind,
  ): Promise<Result<SdIntegration>> {
    return sdDbFind(
      'Failed to find ServiceDesk integration',
      () =>
        prisma.sdIntegration.findFirst({
          where: { workspaceId, kind, deletedAt: null },
        }),
      sdIntegrationNotFound(),
    )
  },

  async findById(id: string): Promise<Result<SdIntegration | null>> {
    return sdDb('Failed to find ServiceDesk integration by id', () =>
      prisma.sdIntegration.findFirst({ where: { id, deletedAt: null } }),
    )
  },

  /**
   * Integração pela identificação externa — é por aqui que o webhook público
   * descobre o workspace (team do Slack, `owner/repo` do GitHub).
   */
  async findByExternalId(
    kind: SdIntegrationKind,
    externalId: string,
  ): Promise<Result<SdIntegration | null>> {
    return sdDb('Failed to find ServiceDesk integration by external id', () =>
      prisma.sdIntegration.findFirst({
        where: { kind, externalId, deletedAt: null },
      }),
    )
  },

  /**
   * Cria ou revive a integração do par `(workspace, kind, externalId)`: o
   * mesmo Slack reconectado volta a valer em vez de colidir na unicidade.
   */
  async upsert(
    workspaceId: string,
    kind: SdIntegrationKind,
    externalId: string,
    data: SdIntegrationData & { encryptedToken: string; createdById: string },
  ): Promise<Result<SdIntegration>> {
    return sdDb('Failed to save ServiceDesk integration', () =>
      prisma.sdIntegration.upsert({
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
      }),
    )
  },

  async update(
    id: string,
    workspaceId: string,
    data: SdIntegrationData,
  ): Promise<Result<SdIntegration>> {
    return sdDb('Failed to update ServiceDesk integration', () =>
      prisma.sdIntegration.update({ where: { id, workspaceId }, data }),
    )
  },

  /** Carimba o erro vindo do serviço externo (fluxo do worker, sem usuário). */
  async markError(id: string, statusError: string): Promise<Result<void>> {
    return sdDb('Failed to mark ServiceDesk integration error', async () => {
      await prisma.sdIntegration.update({
        where: { id },
        data: { status: 'ERROR', statusError: statusError.slice(0, 500) },
      })
    })
  },

  /** Desconecta: sai das listas, para de receber webhook e perde o token. */
  async disconnect(id: string, workspaceId: string): Promise<Result<void>> {
    return sdDb('Failed to disconnect ServiceDesk integration', async () => {
      await prisma.sdIntegration.update({
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

  /* --------------------------------- vínculos --------------------------------- */

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
   * Vínculo do GitHub por número da issue/PR, sem saber se é issue ou PR: a
   * `externalKey` (`owner/repo#n`) é a mesma nos dois casos.
   */
  async findGithubLinkByKey(
    integrationId: string,
    externalKey: string,
  ): Promise<Result<SdIntegrationLink | null>> {
    return sdDb('Failed to find ServiceDesk GitHub link', () =>
      prisma.sdIntegrationLink.findFirst({
        where: {
          integrationId,
          externalKey,
          kind: { in: ['GITHUB_ISSUE', 'GITHUB_PULL_REQUEST'] },
        },
      }),
    )
  },

  /** Thread do Slack: qual chamado a resposta deve alimentar. */
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
   * Vínculos de GitHub ainda abertos, para a reconciliação horária (webhook
   * perdido). Só os de integrações vivas, dos chamados ainda não fechados.
   */
  async listGithubLinksToSync(
    limit: number,
    workspaceId?: string,
  ): Promise<Result<SdIntegrationLinkWithTicket[]>> {
    return sdDb('Failed to list ServiceDesk GitHub links to sync', () =>
      prisma.sdIntegrationLink.findMany({
        where: {
          kind: { in: ['GITHUB_ISSUE', 'GITHUB_PULL_REQUEST'] },
          externalState: { not: 'merged' },
          integration: {
            kind: 'GITHUB',
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

  /* ------------------------------ apoio do fluxo ------------------------------ */

  /** Usuário da plataforma pelo e-mail (casa o autor do Slack com a conta). */
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

  /** Mensagem no histórico do chamado (resposta vinda do Slack). */
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
