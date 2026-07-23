import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CrmAiConversationService } from '@/src/services/crm-ai.service'
import { readUploadFile } from '@/utils/form-data'
import { handleError, successResponse } from '@/utils/http-response'

type Params = { params: Promise<{ id: string; conversationId: string }> }

export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const consent = await requireConsent(
    auth.value.user.id,
    'POST /api/workspaces/[id]/crm/ai/conversations/[conversationId]/attachments',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id, conversationId } = await ctx.params

  const file = await readUploadFile(request, 'file', {
    invalidBody: 'Formulário inválido',
    invalidFile: 'Arquivo não enviado',
  })
  if (!file.ok) return handleError(file.error)

  const result = await CrmAiConversationService.uploadAttachment(
    auth.value.user.id,
    id,
    conversationId,
    {
      contentType: file.value.type,
      byteSize: file.value.size,
      filename: file.value.name,
      readBody: async () => Buffer.from(await file.value.arrayBuffer()),
    },
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
