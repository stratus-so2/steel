import type { Job } from 'bullmq'
import { logger } from '@/lib/axiom/logger'
import { deleteObject, getObject } from '@/src/lib/storage/s3'
import * as CrmSocialInstagramService from '@/src/services/crm-social-instagram.service'
import * as CrmSocialYoutubeService from '@/src/services/crm-social-youtube.service'
import { CrmSocialPublishJob, type CrmSocialPublishJobPayload } from '../jobs'

/** Bucket privado e temporário — só o worker lê, não precisa de URL pública. */
export const CRM_SOCIAL_PUBLISH_TMP_BUCKET = 'crm-social-publish-tmp'

/** `getObject` devolve um `Buffer` (view sobre um ArrayBuffer possivelmente
 * compartilhado/maior) — os services de publish esperam um `ArrayBuffer`
 * exato, então copiamos para um novo buffer do tamanho certo. */
function toArrayBuffer(buffer: Buffer): ArrayBuffer {
  return new Uint8Array(buffer).buffer
}

/**
 * Resultado do job — usamos um valor de retorno em vez de `throw` pra falhas
 * de domínio (ex.: escopo faltando) porque isso preserva o `code` do
 * `AppError` até a rota de status, que a UI precisa pra saber se deve
 * oferecer "reconectar a conta". `throw` fica só pra erro inesperado
 * (bug, infra), que a UI trata como falha genérica.
 */
type PublishJobResult =
  | { ok: true; value: unknown }
  | { ok: false; code: string; message: string }

async function processPublishYoutubeVideo(
  job: Job<CrmSocialPublishJobPayload['publish-youtube-video']>,
): Promise<PublishJobResult> {
  const { actorId, workspaceId, objectKey, contentType, ...input } = job.data
  try {
    const bytes = toArrayBuffer(
      await getObject({
        bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
        key: objectKey,
      }),
    )

    const result = await CrmSocialYoutubeService.publishVideo(
      actorId,
      workspaceId,
      input,
      { bytes, contentType },
    )
    if (!result.ok) {
      return {
        ok: false,
        code: result.error.code,
        message: result.error.message,
      }
    }
    return { ok: true, value: result.value }
  } finally {
    await deleteObject({
      bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
      key: objectKey,
    }).catch((error) => {
      logger.error('queue.crm_social_publish.tmp_cleanup_failed', {
        component: 'CrmSocialPublish',
        jobId: job.id,
        objectKey,
        message: error instanceof Error ? error.message : String(error),
      })
    })
  }
}

async function processPublishInstagramMedia(
  job: Job<CrmSocialPublishJobPayload['publish-instagram-media']>,
): Promise<PublishJobResult> {
  const {
    actorId,
    workspaceId,
    connectionId,
    objectKey,
    contentType,
    kind,
    caption,
    postType,
  } = job.data
  try {
    const bytes = toArrayBuffer(
      await getObject({
        bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
        key: objectKey,
      }),
    )

    const result = await CrmSocialInstagramService.publishPost(
      actorId,
      workspaceId,
      { caption, postType },
      { bytes, contentType, kind },
      connectionId,
    )
    if (!result.ok) {
      return {
        ok: false,
        code: result.error.code,
        message: result.error.message,
      }
    }
    return { ok: true, value: result.value }
  } finally {
    await deleteObject({
      bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
      key: objectKey,
    }).catch((error) => {
      logger.error('queue.crm_social_publish.tmp_cleanup_failed', {
        component: 'CrmSocialPublish',
        jobId: job.id,
        objectKey,
        message: error instanceof Error ? error.message : String(error),
      })
    })
  }
}

export async function processCrmSocialPublish(
  job: Job,
): Promise<PublishJobResult> {
  switch (job.name) {
    case CrmSocialPublishJob.PublishYoutubeVideo:
      return processPublishYoutubeVideo(
        job as Job<CrmSocialPublishJobPayload['publish-youtube-video']>,
      )
    case CrmSocialPublishJob.PublishInstagramMedia:
      return processPublishInstagramMedia(
        job as Job<CrmSocialPublishJobPayload['publish-instagram-media']>,
      )
    default:
      throw new Error(
        `Unknown crm-social-publish job: ${job.name} (id=${job.id ?? 'unknown'})`,
      )
  }
}
