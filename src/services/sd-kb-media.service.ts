import { createId } from '@paralleldrive/cuid2'
import { logger } from '@/lib/axiom/logger'
import {
  sdAttachmentInvalid,
  sdAttachmentNotFound,
  storageError,
} from '@/src/errors'
import { err, ok, type Result } from '@/src/lib/result'
import {
  deleteObjects,
  ensureBucket,
  getObjectWithContentType,
  listObjectKeys,
  putObject,
} from '@/src/lib/storage/s3'
import { SdKbArticleRepository } from '@/src/repositories/sd-kb-article.repository'
import {
  canReadSdKbArticle,
  resolveSdKbEditor,
  resolveSdKbReader,
} from './sd-kb-access'

/**
 * Mídia do editor da KB (port de `wiki-media` do Nexo). Bucket **privado**
 * `servicedesk`, chave `<workspaceId>/kb/<articleId>/<cuid>.<ext>`. O
 * conteúdo guarda a URL estável da própria API
 * (`/api/workspaces/<ws>/servicedesk/knowledge/<articleId>/media/<arquivo>`),
 * que confere o acesso a cada leitura — URL pré-assinada expiraria dentro do
 * documento.
 */
export const SD_BUCKET = 'servicedesk'

const MAX_IMAGE_BYTES = 10 * 1024 * 1024 // 10MB
const MAX_VIDEO_BYTES = 200 * 1024 * 1024 // 200MB
const MAX_AUDIO_BYTES = 50 * 1024 * 1024 // 50MB
const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25MB

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/webm': 'weba',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation':
    'pptx',
}

/** Nome do arquivo servido: `<cuid>.<ext>` — nada além disso é aceito. */
const FILE_NAME_PATTERN = /^[a-z0-9]{10,40}\.[a-z0-9]{2,5}$/

function maxBytesFor(contentType: string): number {
  if (contentType.startsWith('image/')) return MAX_IMAGE_BYTES
  if (contentType.startsWith('video/')) return MAX_VIDEO_BYTES
  if (contentType.startsWith('audio/')) return MAX_AUDIO_BYTES
  return MAX_FILE_BYTES
}

export function validateSdKbMedia(
  contentType: string,
  bytes: Buffer,
): Result<string> {
  const extension = EXTENSIONS[contentType]
  if (!extension)
    return err(sdAttachmentInvalid('Tipo de arquivo não permitido'))
  if (bytes.byteLength === 0) return err(sdAttachmentInvalid('Arquivo vazio'))
  const maxBytes = maxBytesFor(contentType)
  if (bytes.byteLength > maxBytes) {
    return err(
      sdAttachmentInvalid(
        `Arquivo muito grande. Máximo ${maxBytes / (1024 * 1024)}MB`,
      ),
    )
  }
  return ok(extension)
}

export function sdKbMediaPrefix(workspaceId: string, articleId: string) {
  return `${workspaceId}/kb/${articleId}/`
}

export function sdKbMediaUrl(
  workspaceId: string,
  articleId: string,
  fileName: string,
) {
  return `/api/workspaces/${workspaceId}/servicedesk/knowledge/${articleId}/media/${fileName}`
}

export const SdKbMediaService = {
  async upload(
    actorId: string,
    workspaceId: string,
    articleId: string,
    file: { buffer: Buffer; contentType: string; fileName: string },
  ): Promise<Result<{ key: string; url: string; name: string }>> {
    const ctx = await resolveSdKbEditor(actorId, workspaceId, 'EDIT')
    if (!ctx.ok) return ctx

    const article = await SdKbArticleRepository.findById(articleId, workspaceId)
    if (!article.ok) return article

    const extension = validateSdKbMedia(file.contentType, file.buffer)
    if (!extension.ok) return extension

    const fileName = `${createId()}.${extension.value}`
    const key = `${sdKbMediaPrefix(workspaceId, articleId)}${fileName}`

    try {
      await ensureBucket(SD_BUCKET)
      await putObject({
        bucket: SD_BUCKET,
        key,
        body: file.buffer,
        contentType: file.contentType,
      })
    } catch (error) {
      logger.error('sd_kb_media.persist_failed', {
        component: 'SdKbMediaService',
        key,
        message: error instanceof Error ? error.message : String(error),
      })
      return err(storageError('Falha ao armazenar o arquivo'))
    }

    return ok({
      key,
      url: sdKbMediaUrl(workspaceId, articleId, fileName),
      name: file.fileName,
    })
  },

  /** Lê o arquivo para a rota servir (mesma regra de leitura do artigo). */
  async download(
    actorId: string,
    workspaceId: string,
    articleId: string,
    fileName: string,
  ): Promise<Result<{ body: Buffer; contentType: string }>> {
    const ctx = await resolveSdKbReader(actorId, workspaceId)
    if (!ctx.ok) return ctx

    if (!FILE_NAME_PATTERN.test(fileName)) return err(sdAttachmentNotFound())

    const article = await SdKbArticleRepository.findById(articleId, workspaceId)
    if (!article.ok) return article
    if (!canReadSdKbArticle(ctx.value, article.value))
      return err(sdAttachmentNotFound())

    try {
      const object = await getObjectWithContentType({
        bucket: SD_BUCKET,
        key: `${sdKbMediaPrefix(workspaceId, articleId)}${fileName}`,
      })
      return ok({ body: object.body, contentType: object.contentType })
    } catch {
      return err(sdAttachmentNotFound())
    }
  },

  /** Remove a mídia dos artigos excluídos (melhor esforço, só loga falhas). */
  async purgeArticles(
    workspaceId: string,
    articleIds: string[],
  ): Promise<void> {
    for (const articleId of articleIds) {
      try {
        const keys = await listObjectKeys(
          SD_BUCKET,
          sdKbMediaPrefix(workspaceId, articleId),
        )
        if (keys.length > 0) await deleteObjects(SD_BUCKET, keys)
      } catch (error) {
        logger.warn('sd_kb_media.purge_failed', {
          component: 'SdKbMediaService',
          articleId,
          message: error instanceof Error ? error.message : String(error),
        })
      }
    }
  },
}
