import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume, uploadLimiter } from '@/src/lib/rate-limit'
import { SD_ATTACHMENT_MAX_BYTES } from '@/src/lib/servicedesk/ticket-files'
import { SdTicketAttachmentService } from '@/src/services/sd-ticket-attachment.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; ticketId: string }> }

/** Folga do multipart (boundary e cabeçalhos) sobre o limite do arquivo. */
const MAX_UPLOAD_BYTES = SD_ATTACHMENT_MAX_BYTES + 1024 * 1024

/** Anexos visíveis do chamado (solicitante: só os públicos e os próprios). */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId } = await ctx.params
  const result = await SdTicketAttachmentService.list(
    auth.value.user.id,
    id,
    ticketId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/**
 * Envio de anexo (multipart, campo `file`, até 25 MB). Fica solto até uma
 * mensagem prendê-lo (`attachmentIds`).
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(uploadLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/tickets/[ticketId]/attachments',
  )
  if (!consent.ok) return handleError(consent.error)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_UPLOAD_BYTES) {
    return handleError(badRequest('Arquivo muito grande. Máximo 25MB'))
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return handleError(badRequest('Envie o arquivo no campo "file"'))
  }

  const { id, ticketId } = await ctx.params
  const result = await SdTicketAttachmentService.upload(
    auth.value.user.id,
    id,
    ticketId,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name,
    },
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
