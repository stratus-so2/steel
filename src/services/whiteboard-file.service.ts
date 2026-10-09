import { logger } from '@/lib/axiom/logger'
import {
  storageError,
  validationError,
  whiteboardFileNotFound,
} from '../errors'
import { err, ok, type Result } from '../lib/result'
import {
  ensureBucket,
  getObjectWithContentType,
  putObject,
} from '../lib/storage/s3'
import { WhiteboardRepository } from '../repositories/whiteboard.repository'
import {
  WHITEBOARD_IMAGE_MAX_BYTES,
  WHITEBOARD_IMAGE_TYPES,
  WHITEBOARD_THUMBNAIL_MAX_BYTES,
  WhiteboardFileIdSchema,
} from '../schemas/whiteboard.schema'
import {
  assertWhiteboardEditor,
  assertWhiteboardMember,
  loadWorkspaceBoard,
} from './_whiteboard-access'

/**
 * Private bucket of the whiteboard: images pasted on the canvas in
 * `<ws>/files/<fileId>` (Excalidraw ids are content hashes, so the same image
 * is stored once per workspace and shared by duplicates and versions) and
 * the list previews in `<ws>/thumbnails/<boardId>.png`.
 */
export const WHITEBOARD_BUCKET = 'whiteboards'

export interface WhiteboardBinary {
  body: Buffer
  contentType: string
}

const imageKey = (workspaceId: string, fileId: string) =>
  `${workspaceId}/files/${fileId}`
const thumbnailKey = (workspaceId: string, whiteboardId: string) =>
  `${workspaceId}/thumbnails/${whiteboardId}.png`

async function store(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<Result<void>> {
  try {
    await ensureBucket(WHITEBOARD_BUCKET)
    await putObject({ bucket: WHITEBOARD_BUCKET, key, body, contentType })
    return ok(undefined)
  } catch (error) {
    logger.error('whiteboard.storage.put_failed', {
      component: 'WhiteboardFileService',
      key,
      message: error instanceof Error ? error.message : String(error),
    })
    return err(storageError('Falha ao armazenar o arquivo'))
  }
}

async function read(key: string): Promise<Result<WhiteboardBinary>> {
  try {
    return ok(
      await getObjectWithContentType({ bucket: WHITEBOARD_BUCKET, key }),
    )
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (
      name === 'NoSuchKey' ||
      name === 'NoSuchBucket' ||
      name === 'NotFound'
    ) {
      return err(whiteboardFileNotFound())
    }
    logger.error('whiteboard.storage.get_failed', {
      component: 'WhiteboardFileService',
      key,
      message: error instanceof Error ? error.message : String(error),
    })
    return err(storageError('Falha ao ler o arquivo'))
  }
}

function validateImage(contentType: string, bytes: Buffer): Result<void> {
  if (!(WHITEBOARD_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return err(validationError('Envie uma imagem PNG, JPEG, GIF, WebP ou SVG'))
  }
  if (bytes.byteLength === 0) return err(validationError('Arquivo vazio'))
  if (bytes.byteLength > WHITEBOARD_IMAGE_MAX_BYTES) {
    return err(validationError('Imagem muito grande. Máximo 10MB'))
  }
  return ok(undefined)
}

export const WhiteboardFileService = {
  /** Image pasted/inserted on a canvas, keyed by its Excalidraw file id. */
  async uploadImage(
    actorId: string,
    workspaceId: string,
    file: { fileId: string; buffer: Buffer; contentType: string },
  ): Promise<Result<{ fileId: string }>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    if (!WhiteboardFileIdSchema.safeParse(file.fileId).success) {
      return err(validationError('Identificador de arquivo inválido'))
    }
    const valid = validateImage(file.contentType, file.buffer)
    if (!valid.ok) return valid

    const stored = await store(
      imageKey(workspaceId, file.fileId),
      file.buffer,
      file.contentType,
    )
    if (!stored.ok) return stored

    return ok({ fileId: file.fileId })
  },

  async getImage(
    actorId: string,
    workspaceId: string,
    fileId: string,
  ): Promise<Result<WhiteboardBinary>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    if (!WhiteboardFileIdSchema.safeParse(fileId).success) {
      return err(whiteboardFileNotFound())
    }
    return read(imageKey(workspaceId, fileId))
  },

  /** PNG preview the canvas renders after saving. */
  async uploadThumbnail(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
    file: { buffer: Buffer; contentType: string },
  ): Promise<Result<{ thumbnailAt: string }>> {
    const membership = await assertWhiteboardEditor(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board

    if (file.contentType !== 'image/png') {
      return err(validationError('A miniatura deve ser PNG'))
    }
    if (
      file.buffer.byteLength === 0 ||
      file.buffer.byteLength > WHITEBOARD_THUMBNAIL_MAX_BYTES
    ) {
      return err(validationError('Miniatura vazia ou maior que 512KB'))
    }

    const stored = await store(
      thumbnailKey(workspaceId, whiteboardId),
      file.buffer,
      'image/png',
    )
    if (!stored.ok) return stored

    const at = await WhiteboardRepository.setThumbnailAt(
      whiteboardId,
      new Date(),
    )
    if (!at.ok) return at

    return ok({ thumbnailAt: at.value.toISOString() })
  },

  async getThumbnail(
    actorId: string,
    workspaceId: string,
    whiteboardId: string,
  ): Promise<Result<WhiteboardBinary>> {
    const membership = await assertWhiteboardMember(actorId, workspaceId)
    if (!membership.ok) return membership

    const board = await loadWorkspaceBoard(workspaceId, whiteboardId)
    if (!board.ok) return board
    if (!board.value.thumbnailAt) return err(whiteboardFileNotFound())

    return read(thumbnailKey(workspaceId, whiteboardId))
  },
}
