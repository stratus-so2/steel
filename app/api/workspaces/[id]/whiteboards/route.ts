import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import {
  CreateWhiteboardSchema,
  ListWhiteboardsSchema,
} from '@/src/schemas/whiteboard.schema'
import { WhiteboardService } from '@/src/services/whiteboard.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { parseJsonBody, whiteboardActor } from './_shared'

type Params = { params: Promise<{ id: string }> }

export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({})
  if ('response' in actor) return actor.response

  const search = request.nextUrl.searchParams
  const parsed = ListWhiteboardsSchema.safeParse({
    q: search.get('q') ?? undefined,
    archived: search.get('archived') ?? undefined,
  })
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Filtro inválido',
      parsed.error.issues,
    )
  }

  const { id } = await ctx.params
  const result = await WhiteboardService.list(actor.userId, id, parsed.data)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const actor = await whiteboardActor({
    consent: 'POST /api/workspaces/[id]/whiteboards',
  })
  if ('response' in actor) return actor.response

  const body = await parseJsonBody(request, CreateWhiteboardSchema)
  if ('response' in body) return body.response

  const { id } = await ctx.params
  const result = await WhiteboardService.create(actor.userId, id, body.data)
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
