import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { UpdateWhiteboardSettingsSchema } from '@/src/schemas/whiteboard.schema'
import { WhiteboardSettingsService } from '@/src/services/whiteboard-settings.service'
import { handleError, successResponse } from '@/utils/http-response'
import { parseJsonBody, whiteboardActor } from '../../whiteboards/_shared'

type Params = { params: Promise<{ id: string }> }

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const { id } = await ctx.params
  const result = await WhiteboardSettingsService.get(actor.userId, id)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const PATCH = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'PATCH /api/workspaces/[id]/whiteboard/settings',
  })
  if ('response' in actor) return actor.response

  const body = await parseJsonBody(request, UpdateWhiteboardSettingsSchema)
  if ('response' in body) return body.response

  const { id } = await ctx.params
  const result = await WhiteboardSettingsService.update(
    actor.userId,
    id,
    body.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
