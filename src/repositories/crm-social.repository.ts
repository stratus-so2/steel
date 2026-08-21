import type {
  CrmScheduledMediaKind,
  CrmScheduledPost,
  CrmScheduledPostMedia,
  CrmScheduledPostStatus,
  CrmScheduledPostTarget,
  CrmScheduledPostTargetStatus,
  CrmSocialConnection,
  CrmSocialConnectionMetricSnapshot,
  CrmSocialConnectionStatus,
  CrmSocialPlatform,
  Prisma,
} from '@prisma/client'
import { crmSocialConnectionConflict, notFound } from '@/src/errors'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import { dbError } from './db-error'

export const CrmSocialConnectionRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmSocialConnection[]>> {
    try {
      const connections = await prisma.crmSocialConnection.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(connections)
    } catch (error) {
      return err(dbError('Failed to list CRM social connections', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmSocialConnection>> {
    try {
      const connection = await prisma.crmSocialConnection.findFirst({
        where: { id, workspaceId },
      })
      if (!connection) return err(notFound('CrmSocialConnection'))
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to find CRM social connection by id', error))
    }
  },

  async listByPlatform(
    workspaceId: string,
    platform: CrmSocialPlatform,
  ): Promise<Result<CrmSocialConnection[]>> {
    try {
      const connections = await prisma.crmSocialConnection.findMany({
        where: { workspaceId, platform },
        orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
      })
      return ok(connections)
    } catch (error) {
      return err(
        dbError('Failed to list CRM social connections by platform', error),
      )
    }
  },

  async findPrimaryByPlatform(
    workspaceId: string,
    platform: CrmSocialPlatform,
  ): Promise<Result<CrmSocialConnection | null>> {
    try {
      const connection = await prisma.crmSocialConnection.findFirst({
        where: { workspaceId, platform, isPrimary: true },
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to find primary CRM social connection', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    platform: CrmSocialPlatform
    externalAccountId: string
    accountName?: string
  }): Promise<Result<CrmSocialConnection>> {
    try {
      const connection = await prisma.crmSocialConnection.create({ data })
      return ok(connection)
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'P2002') {
        return err(crmSocialConnectionConflict())
      }
      return err(dbError('Failed to create CRM social connection', error))
    }
  },

  async setStatus(
    id: string,
    status: CrmSocialConnectionStatus,
  ): Promise<Result<CrmSocialConnection>> {
    try {
      const connection = await prisma.crmSocialConnection.update({
        where: { id },
        data: { status },
      })
      return ok(connection)
    } catch (error) {
      return err(
        dbError('Failed to update CRM social connection status', error),
      )
    }
  },

  /**
   * Cria ou substitui a conexão OAuth de UMA conta (chave workspace/platform/
   * externalAccountId — várias contas coexistem por plataforma; reconectar a
   * mesma conta sobrescreve só os tokens dela). Tokens já chegam cifrados
   * (ver src/lib/social/crypto.ts) — o repositório não sabe nem precisa
   * saber disso.
   */
  async upsertOAuthConnection(data: {
    workspaceId: string
    createdById: string
    platform: CrmSocialPlatform
    externalAccountId: string
    accountName?: string | null
    accessToken: string
    refreshToken?: string | null
    tokenExpiresAt?: Date | null
    scope?: string | null
    isPrimary: boolean
  }): Promise<Result<CrmSocialConnection>> {
    try {
      const connection = await prisma.crmSocialConnection.upsert({
        where: {
          workspaceId_platform_externalAccountId: {
            workspaceId: data.workspaceId,
            platform: data.platform,
            externalAccountId: data.externalAccountId,
          },
        },
        create: { ...data, status: 'CONNECTED' },
        update: {
          accountName: data.accountName,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          tokenExpiresAt: data.tokenExpiresAt,
          scope: data.scope,
          status: 'CONNECTED',
        },
      })
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to upsert CRM social OAuth connection', error))
    }
  },

  /** Torna esta conexão a primary da plataforma; desmarca as demais do grupo. */
  async setPrimary(
    workspaceId: string,
    platform: CrmSocialPlatform,
    connectionId: string,
  ): Promise<Result<CrmSocialConnection>> {
    try {
      const [, connection] = await prisma.$transaction([
        prisma.crmSocialConnection.updateMany({
          where: { workspaceId, platform, NOT: { id: connectionId } },
          data: { isPrimary: false },
        }),
        prisma.crmSocialConnection.update({
          where: { id: connectionId },
          data: { isPrimary: true },
        }),
      ])
      return ok(connection)
    } catch (error) {
      return err(dbError('Failed to set primary CRM social connection', error))
    }
  },

  /** Atualiza tokens após um refresh (sem tocar em conta/plataforma). */
  async updateTokens(
    id: string,
    data: {
      accessToken: string
      refreshToken?: string | null
      tokenExpiresAt?: Date | null
      scope?: string | null
    },
  ): Promise<Result<CrmSocialConnection>> {
    try {
      const connection = await prisma.crmSocialConnection.update({
        where: { id },
        data: { ...data, status: 'CONNECTED' },
      })
      return ok(connection)
    } catch (error) {
      return err(
        dbError('Failed to update CRM social connection tokens', error),
      )
    }
  },

  async remove(id: string): Promise<Result<void>> {
    try {
      await prisma.crmSocialConnection.delete({ where: { id } })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to remove CRM social connection', error))
    }
  },

  /**
   * Novo ponto na série histórica de seguidores/posts da PRÓPRIA conta
   * conectada — contraparte de `CrmCompetitorRepository.createSnapshot`,
   * usada para comparar "nós vs. concorrente" na mesma escala de tempo.
   */
  async createMetricSnapshot(
    connectionId: string,
    data: { followersCount: number; postsCount?: number | null },
  ): Promise<Result<CrmSocialConnectionMetricSnapshot>> {
    try {
      const snapshot = await prisma.crmSocialConnectionMetricSnapshot.create({
        data: { connectionId, ...data },
      })
      return ok(snapshot)
    } catch (error) {
      return err(
        dbError(
          'Failed to create CRM social connection metric snapshot',
          error,
        ),
      )
    }
  },

  /** Série histórica da conexão a partir de `since`, mais antigo primeiro. */
  async listMetricSnapshotsSince(
    connectionId: string,
    since: Date,
  ): Promise<Result<CrmSocialConnectionMetricSnapshot[]>> {
    try {
      const snapshots = await prisma.crmSocialConnectionMetricSnapshot.findMany(
        {
          where: { connectionId, capturedAt: { gte: since } },
          orderBy: { capturedAt: 'asc' },
        },
      )
      return ok(snapshots)
    } catch (error) {
      return err(
        dbError('Failed to list CRM social connection metric snapshots', error),
      )
    }
  },
}

/** Mídia a persistir junto do post — já enviada ao MinIO pelo service. */
export type CrmScheduledMediaSeed = {
  kind: CrmScheduledMediaKind
  storageKey: string
  contentType: string
  sizeBytes: number
  order: number
}

export type CrmScheduledPostWithRelations = CrmScheduledPost & {
  targets: CrmScheduledPostTarget[]
  media: CrmScheduledPostMedia[]
}

export const CrmScheduledPostRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmScheduledPostWithRelations[]>> {
    try {
      const posts = await prisma.crmScheduledPost.findMany({
        where: { workspaceId, deletedAt: null },
        include: { targets: true, media: true },
        orderBy: { createdAt: 'desc' },
      })
      return ok(posts)
    } catch (error) {
      return err(dbError('Failed to list CRM scheduled posts', error))
    }
  },

  async findById(
    id: string,
    workspaceId: string,
  ): Promise<Result<CrmScheduledPostWithRelations>> {
    try {
      const post = await prisma.crmScheduledPost.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: { targets: true, media: true },
      })
      if (!post) return err(notFound('CrmScheduledPost'))
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to find CRM scheduled post by id', error))
    }
  },

  /** Posts SCHEDULED já vencidos — consumido pelo cron tick. */
  async findDue(now: Date): Promise<Result<CrmScheduledPostWithRelations[]>> {
    try {
      const posts = await prisma.crmScheduledPost.findMany({
        where: {
          status: 'SCHEDULED',
          scheduledFor: { lte: now },
          deletedAt: null,
        },
        include: { targets: true, media: true },
      })
      return ok(posts)
    } catch (error) {
      return err(dbError('Failed to list due CRM scheduled posts', error))
    }
  },

  /**
   * Reivindica um post atomicamente (SCHEDULED→PUBLISHING). Retorna `false`
   * quando outro tick concorrente já assumiu — garante que só um publica.
   */
  async claim(id: string): Promise<Result<boolean>> {
    try {
      const result = await prisma.crmScheduledPost.updateMany({
        where: { id, status: 'SCHEDULED' },
        data: { status: 'PUBLISHING' },
      })
      return ok(result.count > 0)
    } catch (error) {
      return err(dbError('Failed to claim CRM scheduled post', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    content?: string
    title?: string
    options?: Prisma.InputJsonValue
    status: CrmScheduledPostStatus
    scheduledFor?: Date
  }): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.create({ data })
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to create CRM scheduled post', error))
    }
  },

  async update(
    id: string,
    data: { content?: string; title?: string; scheduledFor?: Date },
  ): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.update({
        where: { id },
        data,
      })
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to update CRM scheduled post', error))
    }
  },

  async setStatus(
    id: string,
    status: CrmScheduledPostStatus,
    data?: { publishedAt?: Date | null; lastError?: string | null },
  ): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.update({
        where: { id },
        data: { status, ...data },
      })
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to update CRM scheduled post status', error))
    }
  },

  async cancel(id: string): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.update({
        where: { id },
        data: { status: 'CANCELED' },
      })
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to cancel CRM scheduled post', error))
    }
  },

  async reschedule(
    id: string,
    scheduledFor: Date,
  ): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.update({
        where: { id },
        data: { scheduledFor, status: 'SCHEDULED' },
      })
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to reschedule CRM scheduled post', error))
    }
  },

  async softDelete(id: string): Promise<Result<void>> {
    try {
      await prisma.crmScheduledPost.update({
        where: { id },
        data: { deletedAt: new Date() },
      })
      return ok(undefined)
    } catch (error) {
      return err(dbError('Failed to delete CRM scheduled post', error))
    }
  },
}

export const CrmScheduledPostTargetRepository = {
  async createMany(
    postId: string,
    platforms: CrmSocialPlatform[],
  ): Promise<Result<number>> {
    try {
      const result = await prisma.crmScheduledPostTarget.createMany({
        data: platforms.map((platform) => ({ postId, platform })),
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to create CRM scheduled post targets', error))
    }
  },

  async listByPost(postId: string): Promise<Result<CrmScheduledPostTarget[]>> {
    try {
      const targets = await prisma.crmScheduledPostTarget.findMany({
        where: { postId },
      })
      return ok(targets)
    } catch (error) {
      return err(dbError('Failed to list CRM scheduled post targets', error))
    }
  },

  async setStatus(
    id: string,
    status: CrmScheduledPostTargetStatus,
    data?: {
      externalPostId?: string | null
      error?: string | null
      attempts?: number
      publishedAt?: Date | null
    },
  ): Promise<Result<CrmScheduledPostTarget>> {
    try {
      const target = await prisma.crmScheduledPostTarget.update({
        where: { id },
        data: { status, ...data },
      })
      return ok(target)
    } catch (error) {
      return err(
        dbError('Failed to update CRM scheduled post target status', error),
      )
    }
  },
}

export const CrmScheduledPostMediaRepository = {
  async createMany(
    postId: string,
    seeds: CrmScheduledMediaSeed[],
  ): Promise<Result<number>> {
    if (seeds.length === 0) return ok(0)
    try {
      const result = await prisma.crmScheduledPostMedia.createMany({
        data: seeds.map((seed) => ({ postId, ...seed })),
      })
      return ok(result.count)
    } catch (error) {
      return err(dbError('Failed to create CRM scheduled post media', error))
    }
  },

  async listByPost(postId: string): Promise<Result<CrmScheduledPostMedia[]>> {
    try {
      const media = await prisma.crmScheduledPostMedia.findMany({
        where: { postId },
        orderBy: { order: 'asc' },
      })
      return ok(media)
    } catch (error) {
      return err(dbError('Failed to list CRM scheduled post media', error))
    }
  },
}
