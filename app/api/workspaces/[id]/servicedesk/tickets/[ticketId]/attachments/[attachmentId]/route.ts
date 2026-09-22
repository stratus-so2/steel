import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdAttachmentDownloadQuerySchema } from '@/src/schemas/sd-ticket-message.schema'
import { SdTicketAttachmentService } from '@/src/services/sd-ticket-attachment.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; ticketId: string; attachmentId: string }>
}

/** `filename*` (RFC 5987) + fallback ASCII para o Content-Disposition. */
function disposition(kind: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/**
 * Serve o anexo (bucket privado) conferindo o acesso ao chamado a cada
 * pedido. `?download=1` força o download; senão abre inline (preview de
 * imagem, player de vídeo/áudio, PDF).
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, ticketId, attachmentId } = await ctx.params
  const query = SdAttachmentDownloadQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  const result = await SdTicketAttachmentService.download(
    auth.value.user.id,
    id,
    ticketId,
    attachmentId,
  )
  if (!result.ok) return handleError(result.error)

  const forceDownload = query.success && query.data.download
  return new Response(new Uint8Array(result.value.body), {
    headers: {
      'Content-Type': result.value.contentType,
      'Content-Length': String(result.value.body.byteLength),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      // Nada de HTML/SVG ativo servido pela origem do app.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': disposition(
        forceDownload ? 'attachment' : 'inline',
        result.value.fileName,
      ),
    },
  })
})

/** Remove o anexo (agentes; solicitante só os próprios ainda soltos). */
export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/servicedesk/tickets/[ticketId]/attachments/[attachmentId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, ticketId, attachmentId } = await ctx.params
  const result = await SdTicketAttachmentService.remove(
    auth.value.user.id,
    id,
    ticketId,
    attachmentId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null)
})
