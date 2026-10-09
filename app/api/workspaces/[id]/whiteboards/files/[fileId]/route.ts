import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { WhiteboardFileService } from '@/src/services/whiteboard-file.service'
import { handleError } from '@/utils/http-response'
import { binaryResponse, whiteboardActor } from '../../_shared'

type Params = { params: Promise<{ id: string; fileId: string }> }

/** Image of a canvas; ids are content hashes, so it caches for a day. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id, fileId } = await ctx.params
  const result = await WhiteboardFileService.getImage(actor.userId, id, fileId)
  if (!result.ok) return handleError(result.error)

  return binaryResponse(result.value, 86_400)
})
