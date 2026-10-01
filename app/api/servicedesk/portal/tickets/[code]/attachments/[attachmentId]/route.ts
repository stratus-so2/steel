import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdAttachmentDownloadQuerySchema } from '@/src/schemas/sd-ticket-message.schema'
import { SdPortalService } from '@/src/services/sd-portal.service'
import { handleError } from '@/utils/http-response'
import { portalClientIp, portalSession } from '../../../../_support'

type Params = { params: Promise<{ code: string; attachmentId: string }> }

/** `filename*` (RFC 5987) + fallback ASCII para o Content-Disposition. */
function disposition(kind: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/**
 * Serve um anexo do chamado para o contato externo. Só sai daqui anexo
 * preso a uma **mensagem pública e viva** do chamado no escopo da sessão —
 * anexo de nota interna ou solto de agente nunca é servido.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const limit = await consume(apiLimiter, `ip:${portalClientIp(request)}`)
  if (!limit.ok) return handleError(limit.error)

  const { code, attachmentId } = await ctx.params
  const query = SdAttachmentDownloadQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  const result = await SdPortalService.attachment(
    session.value,
    code,
    attachmentId,
  )
  if (!result.ok) return handleError(result.error)

  const forceDownload = query.success && query.data.download
  return new Response(new Uint8Array(result.value.body), {
    headers: {
      'Content-Type': result.value.contentType,
      'Content-Length': String(result.value.body.byteLength),
      'Cache-Control': 'private, no-store',
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
