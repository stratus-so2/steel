import { randomUUID } from 'node:crypto'
import { logger } from '@/lib/axiom/logger'
import { storageError } from '@/src/errors'
import { requireConsent } from '@/src/lib/consent'
import type {
  CrmSocialPublishJob,
  CrmSocialPublishJobPayload,
} from '@/src/lib/queue/jobs'
import { CRM_SOCIAL_PUBLISH_TMP_BUCKET } from '@/src/lib/queue/processors/crm-social-publish'
import { getCrmSocialPublishQueue } from '@/src/lib/queue/queues'
import { err, ok, type Result } from '@/src/lib/result'
import { ensureBucket, putObject } from '@/src/lib/storage/s3'
import { assertModuleMember } from './authz'

/** Mídia recebida no request, a ser gravada no bucket temporário. */
export interface QueuedPublishMedia {
  bytes: ArrayBuffer
  contentType: string
}

/** Campos do payload preenchidos pelo próprio service (dono + mídia). */
type ServiceOwnedKeys =
  | 'actorId'
  | 'workspaceId'
  | 'objectKey'
  | 'contentType'
  | 'coverObjectKey'
  | 'coverContentType'

export type QueuedPublishInput<N extends CrmSocialPublishJob> = Omit<
  CrmSocialPublishJobPayload[N],
  ServiceOwnedKeys
>

/**
 * Enfileira um publish de mídia grande (`crm-social-publish`). Confere o
 * consentimento LGPD e a permissão `social` × `CREATE` ANTES de gravar a mídia
 * e enfileirar — o mesmo gate do caminho síncrono. O worker ainda reconfere a
 * permissão (defesa em profundidade: o papel pode mudar enquanto o job espera).
 */
export async function enqueuePublish<N extends CrmSocialPublishJob>(
  actorId: string,
  workspaceId: string,
  name: N,
  input: QueuedPublishInput<N>,
  media: QueuedPublishMedia,
  cover?: QueuedPublishMedia,
): Promise<Result<{ jobId: string }>> {
  const consent = await requireConsent(
    actorId,
    'POST /api/workspaces/[id]/crm/social/[platform]/publish',
  )
  if (!consent.ok) return consent

  const membership = await assertModuleMember(actorId, workspaceId, 'CRM', {
    resource: 'social',
    action: 'CREATE',
  })
  if (!membership.ok) return membership

  let objectKey: string
  let coverObjectKey: string | undefined
  try {
    await ensureBucket(CRM_SOCIAL_PUBLISH_TMP_BUCKET)
    objectKey = await storeTmpMedia(workspaceId, media)
    if (cover) coverObjectKey = await storeTmpMedia(workspaceId, cover)
  } catch (error) {
    logger.error('crm.social.publish.tmp_store_failed', {
      component: 'CrmSocialPublishQueue',
      workspaceId,
      message: error instanceof Error ? error.message : String(error),
    })
    return err(storageError())
  }

  const payload = {
    ...input,
    actorId,
    workspaceId,
    objectKey,
    contentType: media.contentType,
    ...(cover
      ? { coverObjectKey, coverContentType: cover.contentType }
      : undefined),
  } as CrmSocialPublishJobPayload[N]

  const job = await getCrmSocialPublishQueue().add(name, payload, {
    attempts: 1,
  })
  return ok({ jobId: job.id as string })
}

/**
 * Grava os bytes num bucket privado temporário e devolve a key — só pra
 * atravessar o request/job boundary sem colocar o arquivo no payload do job.
 * O próprio worker apaga o objeto depois de publicar.
 */
async function storeTmpMedia(
  workspaceId: string,
  media: QueuedPublishMedia,
): Promise<string> {
  const key = `${workspaceId}/${randomUUID()}`
  await putObject({
    bucket: CRM_SOCIAL_PUBLISH_TMP_BUCKET,
    key,
    body: Buffer.from(media.bytes),
    contentType: media.contentType,
  })
  return key
}
