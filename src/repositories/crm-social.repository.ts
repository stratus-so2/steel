import type {
  CrmScheduledPost,
  CrmScheduledPostStatus,
  CrmScheduledPostTarget,
  CrmScheduledPostTargetStatus,
  CrmSocialConnection,
  CrmSocialConnectionStatus,
  CrmSocialPlatform,
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

  async findByPlatform(
    workspaceId: string,
    platform: CrmSocialPlatform,
  ): Promise<Result<CrmSocialConnection | null>> {
    try {
      const connection = await prisma.crmSocialConnection.findUnique({
        where: { workspaceId_platform: { workspaceId, platform } },
      })
      return ok(connection)
    } catch (error) {
      return err(
        dbError('Failed to find CRM social connection by platform', error),
      )
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
   * Cria ou substitui a conexão OAuth da plataforma no workspace (uma por
   * par workspace/platform — reconectar sobrescreve tokens antigos). Tokens
   * já chegam cifrados (ver src/lib/social/crypto.ts) — o repositório não
   * sabe nem precisa saber disso.
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
  }): Promise<Result<CrmSocialConnection>> {
    try {
      const connection = await prisma.crmSocialConnection.upsert({
        where: {
          workspaceId_platform: {
            workspaceId: data.workspaceId,
            platform: data.platform,
          },
        },
        create: { ...data, status: 'CONNECTED' },
        update: {
          externalAccountId: data.externalAccountId,
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
}

export const CrmScheduledPostRepository = {
  async listByWorkspace(
    workspaceId: string,
  ): Promise<Result<CrmScheduledPost[]>> {
    try {
      const posts = await prisma.crmScheduledPost.findMany({
        where: { workspaceId, deletedAt: null },
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
  ): Promise<Result<CrmScheduledPost & { targets: CrmScheduledPostTarget[] }>> {
    try {
      const post = await prisma.crmScheduledPost.findFirst({
        where: { id, workspaceId, deletedAt: null },
        include: { targets: true },
      })
      if (!post) return err(notFound('CrmScheduledPost'))
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to find CRM scheduled post by id', error))
    }
  },

  async create(data: {
    workspaceId: string
    createdById: string
    content?: string
    title?: string
    scheduledFor?: Date
  }): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.create({
        data: {
          ...data,
          status: data.scheduledFor ? 'SCHEDULED' : 'DRAFT',
        },
      })
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
    publishedAt?: Date,
  ): Promise<Result<CrmScheduledPost>> {
    try {
      const post = await prisma.crmScheduledPost.update({
        where: { id },
        data: { status, publishedAt },
      })
      return ok(post)
    } catch (error) {
      return err(dbError('Failed to update CRM scheduled post status', error))
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
    data: { error?: string; publishedAt?: Date },
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
