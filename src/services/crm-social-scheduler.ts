import { logger } from '@/lib/axiom/logger'
import { getObject } from '@/src/lib/storage/s3'
import {
  CrmScheduledPostRepository,
  CrmScheduledPostTargetRepository,
  type CrmScheduledPostWithRelations,
} from '@/src/repositories/crm-social.repository'
import {
  type CrmSocialPublishMedia,
  publishToSocialPlatform,
} from './crm-social-publisher'

export const CRM_SCHEDULED_POST_BUCKET = 'crm-scheduled-posts'

/**
 * Publica todos os alvos PENDENTES/FAILED de um post: baixa a mídia do MinIO
 * uma vez, chama o publisher de cada plataforma e consolida o status do
 * post. Reaproveitado pelo publish manual e pelo cron tick. Não lança —
 * falhas viram status.
 */
export async function publishScheduledPost(
  post: CrmScheduledPostWithRelations,
): Promise<void> {
  const cache = new Map<string, CrmSocialPublishMedia>()
  const media = post.media ?? []
  const firstImage = media.find((m) => m.kind === 'IMAGE') ?? null
  const firstVideo = media.find((m) => m.kind === 'VIDEO') ?? null

  async function load(
    seed: { storageKey: string; contentType: string } | null,
  ): Promise<CrmSocialPublishMedia | null> {
    if (!seed) return null
    const cached = cache.get(seed.storageKey)
    if (cached) return cached
    const buffer = await getObject({
      bucket: CRM_SCHEDULED_POST_BUCKET,
      key: seed.storageKey,
    })
    const value: CrmSocialPublishMedia = {
      bytes: buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength,
      ) as ArrayBuffer,
      contentType: seed.contentType,
    }
    cache.set(seed.storageKey, value)
    return value
  }

  let image: CrmSocialPublishMedia | null = null
  let video: CrmSocialPublishMedia | null = null
  try {
    image = await load(firstImage)
    video = await load(firstVideo)
  } catch (error) {
    logger.error('crm_social_scheduler.media_load_failed', {
      component: 'CrmSocialScheduler',
      postId: post.id,
      message: error instanceof Error ? error.message : String(error),
    })
    await CrmScheduledPostRepository.setStatus(post.id, 'FAILED', {
      lastError: 'Falha ao carregar a mídia do armazenamento',
    })
    return
  }

  let published = 0
  let failed = 0
  let firstError: string | null = null

  for (const target of post.targets ?? []) {
    if (target.status === 'PUBLISHED' || target.status === 'CANCELED') {
      if (target.status === 'PUBLISHED') published++
      continue
    }

    await CrmScheduledPostTargetRepository.setStatus(target.id, 'PUBLISHING', {
      attempts: target.attempts + 1,
    })

    const result = await publishToSocialPlatform(target.platform, {
      actorId: post.createdById,
      workspaceId: post.workspaceId,
      content: post.content,
      title: post.title,
      options: post.options,
      image,
      video,
    })

    if (result.ok) {
      published++
      await CrmScheduledPostTargetRepository.setStatus(target.id, 'PUBLISHED', {
        externalPostId: result.externalPostId,
        error: null,
        publishedAt: new Date(),
      })
    } else {
      failed++
      firstError = firstError ?? result.error
      await CrmScheduledPostTargetRepository.setStatus(target.id, 'FAILED', {
        error: result.error,
      })
    }
  }

  const finalStatus =
    failed === 0 ? 'PUBLISHED' : published === 0 ? 'FAILED' : 'PARTIALLY_FAILED'

  await CrmScheduledPostRepository.setStatus(post.id, finalStatus, {
    publishedAt: finalStatus === 'FAILED' ? null : new Date(),
    lastError: firstError,
  })
}
