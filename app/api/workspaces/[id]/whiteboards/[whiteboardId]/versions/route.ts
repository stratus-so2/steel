import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { CreateWhiteboardVersionSchema } from '@/src/schemas/whiteboard.schema'
import { WhiteboardVersionService } from '@/src/services/whiteboard-version.service'
import { handleError, successResponse } from '@/utils/http-response'
import { parseJsonBody, whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardVersionService.list(
    actor.userId,
    id,
    whiteboardId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/** "Salvar versão". */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'POST /api/workspaces/[id]/whiteboards/[whiteboardId]/versions',
  })
  if ('response' in actor) return actor.response

  const body = await parseJsonBody(request, CreateWhiteboardVersionSchema)
  if ('response' in body) return body.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardVersionService.create(
    actor.userId,
    id,
    whiteboardId,
    body.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
