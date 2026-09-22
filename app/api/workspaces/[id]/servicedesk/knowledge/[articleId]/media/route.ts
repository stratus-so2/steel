import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { consume, uploadLimiter } from '@/src/lib/rate-limit'
import { SdKbMediaService } from '@/src/services/sd-kb-media.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; articleId: string }> }

/** Teto do corpo multipart (o service valida o limite por tipo). */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024

/**
 * Upload de mídia do editor (multipart, campo `file`). Devolve a URL estável
 * que o editor grava no conteúdo.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(uploadLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/servicedesk/knowledge/[articleId]/media',
  )
  if (!consent.ok) return handleError(consent.error)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_UPLOAD_BYTES) {
    return handleError(badRequest('Arquivo muito grande. Máximo 200MB'))
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return handleError(badRequest('Envie o arquivo no campo "file"'))
  }

  const { id, articleId } = await ctx.params
  const result = await SdKbMediaService.upload(
    auth.value.user.id,
    id,
    articleId,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name,
    },
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
