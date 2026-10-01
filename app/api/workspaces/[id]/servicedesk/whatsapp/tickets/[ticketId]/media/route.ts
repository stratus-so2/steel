import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { consume, uploadLimiter } from '@/src/lib/rate-limit'
import {
  SD_WHATSAPP_MEDIA_MAX_BYTES,
  SdWhatsappSendMediaSchema,
} from '@/src/schemas/sd-whatsapp.schema'
import { SdWhatsappService } from '@/src/services/sd-whatsapp.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; ticketId: string }> }

/** Folga do multipart (boundary e cabeçalhos) sobre o limite do arquivo. */
const MAX_UPLOAD_BYTES = SD_WHATSAPP_MEDIA_MAX_BYTES + 1024 * 1024

/**
 * Envia um arquivo pela conversa do chamado (multipart, campo `file`, até
 * 16 MB, com `caption` opcional).
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(uploadLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/whatsapp/tickets/[ticketId]/media',
  )
  if (!consent.ok) return handleError(consent.error)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_UPLOAD_BYTES) {
    return handleError(badRequest('Arquivo muito grande. Máximo 16MB'))
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return handleError(badRequest('Envie o arquivo no campo "file"'))
  }
  const parsed = SdWhatsappSendMediaSchema.safeParse({
    caption: form?.get('caption')?.toString() || undefined,
  })
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const { id, ticketId } = await ctx.params
  const result = await SdWhatsappService.sendMedia(
    auth.value.user.id,
    id,
    ticketId,
    {
      body: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name,
    },
    parsed.data,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
