import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { uploadLimiter } from '@/src/lib/rate-limit'
import { WhiteboardFileService } from '@/src/services/whiteboard-file.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { whiteboardActor } from '../_shared'

type Params = { params: Promise<{ id: string }> }

/** Image pasted on a canvas: multipart `file` + Excalidraw `fileId`. */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'POST /api/workspaces/[id]/whiteboards/files',
    limiter: uploadLimiter,
  })
  if ('response' in actor) return actor.response

  const [{ id }, formData] = await Promise.all([
    ctx.params,
    request.formData().catch(() => null),
  ])
  const file = formData?.get('file')
  const fileId = formData?.get('fileId')
  if (!(file instanceof File) || typeof fileId !== 'string') {
    return standardError('VALIDATION_ERROR', 'Envie a imagem e o identificador')
  }

  const result = await WhiteboardFileService.uploadImage(actor.userId, id, {
    fileId,
    buffer: Buffer.from(await file.arrayBuffer()),
    contentType: file.type,
  })
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
