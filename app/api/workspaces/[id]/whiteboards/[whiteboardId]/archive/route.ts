import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { ArchiveWhiteboardSchema } from '@/src/schemas/whiteboard.schema'
import { WhiteboardService } from '@/src/services/whiteboard.service'
import { handleError, successResponse } from '@/utils/http-response'
import { parseJsonBody, whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; whiteboardId: string }> }

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'PATCH /api/workspaces/[id]/whiteboards/[whiteboardId]/archive',
  })
  if ('response' in actor) return actor.response

  const body = await parseJsonBody(request, ArchiveWhiteboardSchema)
  if ('response' in body) return body.response

  const { id, whiteboardId } = await ctx.params
  const result = await WhiteboardService.setArchived(
    actor.userId,
    id,
    whiteboardId,
    body.data.archived,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
