import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { UpdateWhiteboardSchema } from '@/src/schemas/whiteboard.schema'
import { WhiteboardService } from '@/src/services/whiteboard.service'
import { handleError, successResponse } from '@/utils/http-response'
import { parseJsonBody, whiteboardActor } from '../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.getById(actor.userId, id, whiteboardId)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'PATCH /api/workspaces/[id]/whiteboards/[whiteboardId]',
  })
  if ('response' in actor) return actor.response

  const body = await parseJsonBody(request, UpdateWhiteboardSchema)
  if ('response' in body) return body.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.rename(
    actor.userId,
    id,
    whiteboardId,
    body.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
