import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { SdReportDownloadQuerySchema } from '@/src/schemas/sd-report.schema'
import { SdReportService } from '@/src/services/sd-report.service'
import { handleError, standardError } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; runId: string }> }

/** `filename*` (RFC 5987) + fallback ASCII para o Content-Disposition. */
function disposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/**
 * Baixa o PDF ou o CSV de uma execução. O bucket é privado e a API do MinIO
 * não é pública, então o "link assinado" do módulo é esta rota: a cada pedido
 * o service confere o acesso ao ServiceDesk (`sd-reports:VIEW`) e devolve os
 * bytes.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, runId } = await ctx.params
  const query = SdReportDownloadQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  )
  if (!query.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Parâmetros inválidos',
      query.error.issues,
    )
  }

  const result = await SdReportService.download(
    auth.value.user.id,
    id,
    runId,
    query.data,
  )
  if (!result.ok) return handleError(result.error)

  return new Response(new Uint8Array(result.value.body), {
    headers: {
      'Content-Type': result.value.contentType,
      'Content-Length': String(result.value.body.byteLength),
      'Cache-Control': 'private, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': disposition(result.value.fileName),
    },
  })
})
