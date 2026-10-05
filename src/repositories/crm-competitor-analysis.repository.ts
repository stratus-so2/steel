import type {
  CrmCompetitorIdeaSet,
  CrmCompetitorPost,
  CrmSocialConnectionPost,
  Prisma,
} from '@prisma/client'
import { prisma } from '@/src/lib/prisma'
import { err, ok, type Result } from '@/src/lib/result'
import type { DiscoveredPost } from '@/src/lib/social/discovery'
import { dbError } from './db-error'

export type CreateCrmCompetitorIdeaSetData = {
  competitorId: string
  range: string
  ideas: Prisma.InputJsonValue
  modelKey: string
  createdById: string
}

function postFields(post: DiscoveredPost) {
  return {
    format: post.format,
    caption: post.caption,
    permalink: post.permalink,
    likeCount: post.likeCount,
    commentsCount: post.commentsCount,
    viewCount: post.viewCount,
    publishedAt: post.publishedAt,
  }
}

/**
 * Posts collected for the competitor analysis (competitor and own account)
 * plus the AI idea sets. Upserts by `externalId`, so each collection run
 * refreshes the counts of posts already stored.
 */
export const CrmCompetitorAnalysisRepository = {
  async upsertCompetitorPosts(
    competitorId: string,
    posts: DiscoveredPost[],
  ): Promise<Result<number>> {
    try {
      await prisma.$transaction(
        posts.map((post) =>
          prisma.crmCompetitorPost.upsert({
            where: {
              competitorId_externalId: {
                competitorId,
                externalId: post.externalId,
              },
            },
            create: {
              competitorId,
              externalId: post.externalId,
              ...postFields(post),
            },
            update: postFields(post),
          }),
        ),
      )
      return ok(posts.length)
    } catch (error) {
      return err(dbError('Failed to upsert CRM competitor posts', error))
    }
  },

  async upsertConnectionPosts(
    connectionId: string,
    posts: DiscoveredPost[],
  ): Promise<Result<number>> {
    try {
      await prisma.$transaction(
        posts.map((post) =>
          prisma.crmSocialConnectionPost.upsert({
            where: {
              connectionId_externalId: {
                connectionId,
                externalId: post.externalId,
              },
            },
            create: {
              connectionId,
              externalId: post.externalId,
              ...postFields(post),
            },
            update: postFields(post),
          }),
        ),
      )
      return ok(posts.length)
    } catch (error) {
      return err(dbError('Failed to upsert CRM social connection posts', error))
    }
  },

  /** Competitor posts published since `since`, newest first. */
  async listCompetitorPostsSince(
    competitorId: string,
    since: Date,
  ): Promise<Result<CrmCompetitorPost[]>> {
    try {
      const posts = await prisma.crmCompetitorPost.findMany({
        where: { competitorId, publishedAt: { gte: since } },
        orderBy: { publishedAt: 'desc' },
      })
      return ok(posts)
    } catch (error) {
      return err(dbError('Failed to list CRM competitor posts', error))
    }
  },

  /** Own-account posts published since `since`, newest first. */
  async listConnectionPostsSince(
    connectionId: string,
    since: Date,
  ): Promise<Result<CrmSocialConnectionPost[]>> {
    try {
      const posts = await prisma.crmSocialConnectionPost.findMany({
        where: { connectionId, publishedAt: { gte: since } },
        orderBy: { publishedAt: 'desc' },
      })
      return ok(posts)
    } catch (error) {
      return err(dbError('Failed to list CRM social connection posts', error))
    }
  },

  async createIdeaSet(
    data: CreateCrmCompetitorIdeaSetData,
  ): Promise<Result<CrmCompetitorIdeaSet>> {
    try {
      const item = await prisma.crmCompetitorIdeaSet.create({ data })
      return ok(item)
    } catch (error) {
      return err(dbError('Failed to create CRM competitor idea set', error))
    }
  },

  /** Latest generation for the competitor, or `null` when there is none. */
  async findLatestIdeaSet(
    competitorId: string,
  ): Promise<Result<CrmCompetitorIdeaSet | null>> {
    try {
      const item = await prisma.crmCompetitorIdeaSet.findFirst({
        where: { competitorId },
        orderBy: { createdAt: 'desc' },
      })
      return ok(item)
    } catch (error) {
      return err(
        dbError('Failed to find latest CRM competitor idea set', error),
      )
    }
  },
}
