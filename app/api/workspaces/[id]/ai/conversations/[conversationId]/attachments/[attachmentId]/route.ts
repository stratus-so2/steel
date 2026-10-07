import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { AiAttachmentService } from '@/src/services/ai-attachment.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; conversationId: string; attachmentId: string }>
}

/** `filename*` (RFC 5987) + ASCII fallback for the Content-Disposition. */
function disposition(kind: 'inline' | 'attachment', fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${kind}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

/**
 * Serves the file to the conversation owner (private bucket), inline —
 * thumbnails and previews; `?download=1` forces a download.
 */
export const GET = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, conversationId, attachmentId } = await ctx.params
  const result = await AiAttachmentService.download(
    auth.value.user.id,
    id,
    conversationId,
    attachmentId,
  )
  if (!result.ok) return handleError(result.error)

  const forceDownload = request.nextUrl.searchParams.get('download') === '1'
  return new Response(new Uint8Array(result.value.body), {
    headers: {
      'Content-Type': result.value.contentType,
      'Content-Length': String(result.value.body.byteLength),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
      // Nothing active (HTML/SVG) is ever served from the app origin.
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': disposition(
        forceDownload ? 'attachment' : 'inline',
        result.value.fileName,
      ),
    },
  })
})

/** Removes an attachment that was not sent yet. */
export const DELETE = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'DELETE /api/workspaces/[id]/ai/conversations/[conversationId]/attachments/[attachmentId]',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, conversationId, attachmentId } = await ctx.params
  const result = await AiAttachmentService.remove(
    auth.value.user.id,
    id,
    conversationId,
    attachmentId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(null)
})
