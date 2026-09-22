import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { LinkSdKbArticleToTicketSchema } from '@/src/schemas/sd-kb-article.schema'
import { SdKbTicketLinkService } from '@/src/services/sd-kb-ticket-link.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; ticketId: string }> }

/** Artigos da KB vinculados ao chamado (aba "Conhecimento"). */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId } = await ctx.params
  const result = await SdKbTicketLinkService.listForTicket(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/tickets/[ticketId]/kb-links',
  )
  if (!consent.ok) return handleError(consent.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = LinkSdKbArticleToTicketSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { id, ticketId } = await ctx.params
  const result = await SdKbTicketLinkService.link(
    auth.value.user.id,
    id,
    ticketId,
    parsed.data.articleId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})

export const DELETE = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/servicedesk/tickets/[ticketId]/kb-links',
  )
  if (!consent.ok) return handleError(consent.error)

  const { searchParams } = new URL(request.url)
  const parsed = LinkSdKbArticleToTicketSchema.safeParse({
    articleId: searchParams.get('articleId') ?? undefined,
  })
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      parsed.error.issues,
    )
  }

  const { id, ticketId } = await ctx.params
  const result = await SdKbTicketLinkService.unlink(
    auth.value.user.id,
    id,
    ticketId,
    parsed.data.articleId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null)
})
