import { randomUUID } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest, crmSocialNotConfigured } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { CrmSocialPublishJob } from '@/src/lib/queue/jobs'
import { CRM_SOCIAL_PUBLISH_TMP_BUCKET } from '@/src/lib/queue/processors/crm-social-publish'
import { getCrmSocialPublishQueue } from '@/src/lib/queue/queues'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { ensureBucket, putObject } from '@/src/lib/storage/s3'
import { parseCrmPlatformSlug } from '@/src/schemas/crm-social.schema'
import { CrmPublishFacebookPostSchema } from '@/src/schemas/crm-social-facebook.schema'
import { CrmPublishInstagramPostSchema } from '@/src/schemas/crm-social-instagram.schema'
import { CrmLinkedinPublishSchema } from '@/src/schemas/crm-social-linkedin.schema'
import { CrmPublishTiktokVideoSchema } from '@/src/schemas/crm-social-tiktok.schema'
import { CrmPublishTweetSchema } from '@/src/schemas/crm-social-twitter.schema'
import { CrmSocialYoutubePublishVideoSchema } from '@/src/schemas/crm-social-youtube.schema'
import * as CrmSocialFacebookService from '@/src/services/crm-social-facebook.service'
import * as CrmSocialLinkedinService from '@/src/services/crm-social-linkedin.service'
import {
  publishVideo as publishTiktokVideo,
  TIKTOK_SINGLE_CHUNK_MAX_BYTES,
} from '@/src/services/crm-social-tiktok.service'
import { publishTweetPost } from '@/src/services/crm-social-twitter.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; platform: string }> }

const MAX_VIDEO_BYTES = 256 * 1024 * 1024 // 256 MB
const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10 MB

/**
 * Grava os bytes recebidos num bucket privado temporário e devolve a key —
 * usado só pra atravessar o request/job boundary (a rota recebe o upload,
 * o worker consome de lá) sem colocar o arquivo inteiro no payload do job
 * do BullMQ. O próprio worker apaga o objeto depois de publicar.
 */
async function storeTmpMedia(workspaceId: string, file: File): Promise<string> {
  const key = `${workspaceId}/${randomUUID()}`
  await ensureBucket(CRM_SOCIAL_PUBLISH_TMP_BUCKET)
  await putObject({
    bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
    key,
    body: Buffer.from(await file.arrayBuffer()),
    contentType: file.type || 'application/octet-stream',
  })
  return key
}

/** Publica conteúdo na conta. Corpo: `multipart/form-data` (varia por plataforma). */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, platform: platformSlug } = await ctx.params
  const platform = parseCrmPlatformSlug(platformSlug)
  if (!platform) {
    return standardError('VALIDATION_ERROR', 'Plataforma inválida')
  }

  if (
    platform !== 'FACEBOOK' &&
    platform !== 'INSTAGRAM' &&
    platform !== 'YOUTUBE' &&
    platform !== 'LINKEDIN' &&
    platform !== 'TWITTER' &&
    platform !== 'TIKTOK'
  ) {
    return handleError(crmSocialNotConfigured())
  }

  const actorId = auth.value.user.id

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return handleError(
      badRequest('Corpo inválido (esperado multipart/form-data)'),
    )
  }

  const rawConnectionId = form.get('connectionId')
  const connectionId =
    typeof rawConnectionId === 'string' && rawConnectionId
      ? rawConnectionId
      : undefined

  if (platform === 'YOUTUBE') {
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return handleError(badRequest('Arquivo de vídeo ausente'))
    }
    if (file.size > MAX_VIDEO_BYTES) {
      return handleError(badRequest('Vídeo excede o tamanho máximo (256 MB)'))
    }

    const rawTags = form.get('tags')
    const tags =
      typeof rawTags === 'string' && rawTags.trim()
        ? rawTags
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean)
        : []

    const parsed = CrmSocialYoutubePublishVideoSchema.safeParse({
      title: form.get('title') ?? undefined,
      description: form.get('description') ?? undefined,
      privacyStatus: form.get('privacyStatus') ?? undefined,
      tags,
    })
    if (!parsed.success) {
      return standardError(
        'VALIDATION_ERROR',
        'Dados do vídeo inválidos',
        z.flattenError(parsed.error),
      )
    }

    const objectKey = await storeTmpMedia(id, file)
    const job = await getCrmSocialPublishQueue().add(
      CrmSocialPublishJob.PublishYoutubeVideo,
      {
        actorId,
        workspaceId: id,
        objectKey,
        contentType: file.type || 'video/*',
        ...parsed.data,
      },
      { attempts: 1 },
    )
    return successResponse({ jobId: job.id }, 202)
  }

  if (platform === 'TIKTOK') {
    const file = form.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return handleError(badRequest('Arquivo de vídeo ausente'))
    }
    if (file.size > TIKTOK_SINGLE_CHUNK_MAX_BYTES) {
      return handleError(badRequest('Vídeo excede o tamanho máximo (64 MB)'))
    }

    const asBool = (value: FormDataEntryValue | null): boolean =>
      value === 'true' || value === 'on' || value === '1'

    const parsed = CrmPublishTiktokVideoSchema.safeParse({
      title: form.get('title') ?? undefined,
      privacyLevel: form.get('privacyLevel') ?? undefined,
      disableComment: asBool(form.get('disableComment')),
      disableDuet: asBool(form.get('disableDuet')),
      disableStitch: asBool(form.get('disableStitch')),
    })
    if (!parsed.success) {
      return standardError(
        'VALIDATION_ERROR',
        'Dados da publicação inválidos',
        z.flattenError(parsed.error),
      )
    }

    const result = await publishTiktokVideo(actorId, id, parsed.data, {
      bytes: await file.arrayBuffer(),
      contentType: file.type || 'video/mp4',
    })
    if (!result.ok) return handleError(result.error)
    return successResponse(result.value, 201)
  }

  if (platform === 'LINKEDIN') {
    const parsed = CrmLinkedinPublishSchema.safeParse({
      text: form.get('text') ?? undefined,
    })
    if (!parsed.success) {
      return standardError(
        'VALIDATION_ERROR',
        'Dados da publicação inválidos',
        z.flattenError(parsed.error),
      )
    }

    const imageField = form.get('image')
    let image: { bytes: ArrayBuffer; contentType: string } | null = null
    if (imageField instanceof File && imageField.size > 0) {
      if (imageField.size > MAX_IMAGE_BYTES) {
        return handleError(badRequest('Imagem excede o tamanho máximo (10 MB)'))
      }
      image = {
        bytes: await imageField.arrayBuffer(),
        contentType: imageField.type || 'image/jpeg',
      }
    }

    const result = await CrmSocialLinkedinService.publishPost(
      actorId,
      id,
      parsed.data,
      image,
    )
    if (!result.ok) return handleError(result.error)
    return successResponse(result.value, 201)
  }

  if (platform === 'TWITTER') {
    const parsed = CrmPublishTweetSchema.safeParse({
      text: form.get('text') ?? undefined,
    })
    if (!parsed.success) {
      return standardError(
        'VALIDATION_ERROR',
        'Dados do tweet inválidos',
        z.flattenError(parsed.error),
      )
    }

    const imageField = form.get('image')
    let image: { bytes: ArrayBuffer; contentType: string } | null = null
    if (imageField instanceof File && imageField.size > 0) {
      if (imageField.size > MAX_IMAGE_BYTES) {
        return handleError(badRequest('Imagem excede o tamanho máximo (10 MB)'))
      }
      image = {
        bytes: await imageField.arrayBuffer(),
        contentType: imageField.type || 'image/jpeg',
      }
    }

    const result = await publishTweetPost(actorId, id, parsed.data, image)
    if (!result.ok) return handleError(result.error)
    return successResponse(result.value, 201)
  }

  if (platform === 'INSTAGRAM') {
    const parsed = CrmPublishInstagramPostSchema.safeParse({
      caption: form.get('caption') ?? undefined,
      postType: form.get('postType') ?? undefined,
    })
    if (!parsed.success) {
      return standardError(
        'VALIDATION_ERROR',
        'Dados da publicação inválidos',
        z.flattenError(parsed.error),
      )
    }

    // Reels exige vídeo; feed exige imagem; stories aceita os dois. A mídia
    // chega no campo `image` (imagem) ou `video` (vídeo).
    const imageField = form.get('image')
    const videoField = form.get('video')
    let mediaFile: File | null = null
    let kind: 'IMAGE' | 'VIDEO' | null = null

    if (videoField instanceof File && videoField.size > 0) {
      if (videoField.size > MAX_VIDEO_BYTES) {
        return handleError(badRequest('Vídeo excede o tamanho máximo (256 MB)'))
      }
      mediaFile = videoField
      kind = 'VIDEO'
    } else if (imageField instanceof File && imageField.size > 0) {
      if (imageField.size > MAX_IMAGE_BYTES) {
        return handleError(badRequest('Imagem excede o tamanho máximo (10 MB)'))
      }
      mediaFile = imageField
      kind = 'IMAGE'
    }

    if (!mediaFile || !kind) {
      return handleError(
        badRequest('Mídia obrigatória — o Instagram exige mídia para publicar'),
      )
    }
    if (parsed.data.postType === 'REELS' && kind !== 'VIDEO') {
      return handleError(badRequest('Reels exige um arquivo de vídeo'))
    }
    if (parsed.data.postType === 'FEED' && kind !== 'IMAGE') {
      return handleError(badRequest('Publicação no feed exige uma imagem'))
    }

    const objectKey = await storeTmpMedia(id, mediaFile)
    const job = await getCrmSocialPublishQueue().add(
      CrmSocialPublishJob.PublishInstagramMedia,
      {
        actorId,
        workspaceId: id,
        connectionId,
        objectKey,
        contentType:
          mediaFile.type || (kind === 'VIDEO' ? 'video/mp4' : 'image/jpeg'),
        kind,
        caption: parsed.data.caption,
        postType: parsed.data.postType,
      },
      { attempts: 1 },
    )
    return successResponse({ jobId: job.id }, 202)
  }

  const parsed = CrmPublishFacebookPostSchema.safeParse({
    message: form.get('message') ?? undefined,
    link: form.get('link') ? form.get('link') : null,
  })
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados da publicação inválidos',
      z.flattenError(parsed.error),
    )
  }

  // Vídeo é grande e pode demorar pra publicar (reencode + upload) — vai pra
  // fila, igual Instagram/YouTube. Imagem/texto continuam síncronos.
  const videoField = form.get('video')
  if (videoField instanceof File && videoField.size > 0) {
    if (videoField.size > MAX_VIDEO_BYTES) {
      return handleError(badRequest('Vídeo excede o tamanho máximo (256 MB)'))
    }

    const objectKey = await storeTmpMedia(id, videoField)
    const job = await getCrmSocialPublishQueue().add(
      CrmSocialPublishJob.PublishFacebookVideo,
      {
        actorId,
        workspaceId: id,
        connectionId,
        objectKey,
        contentType: videoField.type || 'video/mp4',
        message: parsed.data.message,
        link: parsed.data.link,
      },
      { attempts: 1 },
    )
    return successResponse({ jobId: job.id }, 202)
  }

  const imageField = form.get('image')
  let media: {
    bytes: ArrayBuffer
    contentType: string
    kind: 'IMAGE' | 'VIDEO'
  } | null = null
  if (imageField instanceof File && imageField.size > 0) {
    if (imageField.size > MAX_IMAGE_BYTES) {
      return handleError(badRequest('Imagem excede o tamanho máximo (10 MB)'))
    }
    media = {
      bytes: await imageField.arrayBuffer(),
      contentType: imageField.type || 'image/*',
      kind: 'IMAGE',
    }
  }

  const result = await CrmSocialFacebookService.publishPost(
    actorId,
    id,
    parsed.data,
    media,
    connectionId,
  )
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value, 201)
})
