import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest } from '@/src/errors'
import { aiAttachmentTooLarge } from '@/src/errors/app-error'
import { AI_ATTACHMENT_MAX_DOCUMENT_BYTES } from '@/src/lib/ai/attachments'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { consume, uploadLimiter } from '@/src/lib/rate-limit'
import { AiAttachmentService } from '@/src/services/ai-attachment.service'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; conversationId: string }> }

/** Multipart overhead (boundary, headers) over the largest file accepted. */
const MAX_UPLOAD_BYTES = AI_ATTACHMENT_MAX_DOCUMENT_BYTES + 1024 * 1024

/**
 * Uploads a file or photo for the next message (multipart, field `file`).
 * It stays loose until a message is sent with its id in `attachmentIds`.
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(uploadLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/ai/conversations/[conversationId]/attachments',
  )
  if (!consent.ok) return handleError(consent.error)

  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > MAX_UPLOAD_BYTES) {
    return handleError(aiAttachmentTooLarge())
  }

  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return handleError(badRequest('Envie o arquivo no campo "file"'))
  }

  const { id, conversationId } = await ctx.params
  const result = await AiAttachmentService.upload(
    auth.value.user.id,
    id,
    conversationId,
    {
      buffer: Buffer.from(await file.arrayBuffer()),
      contentType: file.type,
      fileName: file.name,
    },
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
