import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import {
  type GroupParticipantsDTO,
  GroupParticipantsSchema,
} from '@/src/schemas/whatsapp-group.schema'
import { WhatsAppGroupService } from '@/src/services/whatsapp-group.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; groupId: string }> }

async function parseParticipants(
  request: NextRequest,
): Promise<
  { ok: true; data: GroupParticipantsDTO } | { ok: false; response: Response }
> {
  const json = await readJsonBody(request, { allowEmpty: true })
  if (!json.ok) return { ok: false, response: handleError(json.error) }

  const parsed = GroupParticipantsSchema.safeParse(json.value)
  if (!parsed.success) {
    return {
      ok: false,
      response: standardError(
        'VALIDATION_ERROR',
        'Dados inválidos',
        parsed.error.issues,
      ),
    }
  }
  return { ok: true, data: parsed.data }
}

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, groupId }, parsed] = await Promise.all([
    ctx.params,
    parseParticipants(request),
  ])
  if (!parsed.ok) return parsed.response

  const result = await WhatsAppGroupService.addParticipants(
    auth.value.user.id,
    id,
    groupId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const DELETE = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, groupId }, parsed] = await Promise.all([
    ctx.params,
    parseParticipants(request),
  ])
  if (!parsed.ok) return parsed.response

  const result = await WhatsAppGroupService.removeParticipants(
    auth.value.user.id,
    id,
    groupId,
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})
