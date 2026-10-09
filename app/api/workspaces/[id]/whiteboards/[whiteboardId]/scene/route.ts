import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { SaveWhiteboardSceneSchema } from '@/src/schemas/whiteboard.schema'
import { WhiteboardService } from '@/src/services/whiteboard.service'
import { handleError, successResponse } from '@/utils/http-response'
import { parseJsonBody, whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

/** Autosave of the canvas (debounced on the client). */
export const PUT = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'PUT /api/workspaces/[id]/whiteboards/[whiteboardId]/scene',
  })
  if ('response' in actor) return actor.response

  const body = await parseJsonBody(request, SaveWhiteboardSceneSchema)
  if ('response' in body) return body.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.saveScene(
    actor.userId,
    id,
    whiteboardId,
    body.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
