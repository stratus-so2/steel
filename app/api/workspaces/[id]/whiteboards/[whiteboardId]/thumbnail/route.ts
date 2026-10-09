import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { uploadLimiter } from '@/src/lib/rate-limit'
import { WhiteboardFileService } from '@/src/services/whiteboard-file.service'
import { handleError, successResponse } from '@/utils/http-response'
import { binaryResponse, whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

/** PNG preview; the URL carries `?v=<time>`, so it can be cached. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardFileService.getThumbnail(
    actor.userId,
    id,
    whiteboardId,
  )
  if (!result.ok) return handleError(result.error)

  return binaryResponse(result.value, 86_400)
})

/** Raw PNG body rendered by the canvas after a save. */
export const PUT = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'PUT /api/workspaces/[id]/whiteboards/[whiteboardId]/thumbnail',
    limiter: uploadLimiter,
  })
  if ('response' in actor) return actor.response

  const [{ id, whiteboardId }, body] = await Promise.all([
    ctx.params,
    request.arrayBuffer(),
  ])
  const result = await WhiteboardFileService.uploadThumbnail(
    actor.userId,
    id,
    whiteboardId,
    {
      buffer: Buffer.from(body),
      contentType: request.headers.get('content-type') ?? '',
    },
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
