import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { WhiteboardService } from '@/src/services/whiteboard.service'
import { handleError, successResponse } from '@/utils/http-response'
import { whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

/** Takes or renews the edit lease (the canvas calls it every ~20 s). */
export const POST = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.acquireLock(
    actor.userId,
    id,
    whiteboardId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** Drops the caller's lease when the canvas closes. */
export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.releaseLock(
    actor.userId,
    id,
    whiteboardId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
