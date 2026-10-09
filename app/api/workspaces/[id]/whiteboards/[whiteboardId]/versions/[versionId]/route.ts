import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { WhiteboardVersionService } from '@/src/services/whiteboard-version.service'
import { handleError, successResponse } from '@/utils/http-response'
import { whiteboardActor } from '../../../_shared'

type Params = {
  params: Promise<{ id: string; whiteboardId: string; versionId: string }>
}

/** A version with its scene, for the history preview. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, whiteboardId, versionId } = await ctx.params
  const result = await WhiteboardVersionService.get(
    actor.userId,
    id,
    whiteboardId,
    versionId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
