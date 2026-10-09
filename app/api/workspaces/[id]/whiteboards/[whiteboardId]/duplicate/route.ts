import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { WhiteboardService } from '@/src/services/whiteboard.service'
import { handleError, successResponse } from '@/utils/http-response'
import { whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'POST /api/workspaces/[id]/whiteboards/[whiteboardId]/duplicate',
  })
  if ('response' in actor) return actor.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.duplicate(
    actor.userId,
    id,
    whiteboardId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
