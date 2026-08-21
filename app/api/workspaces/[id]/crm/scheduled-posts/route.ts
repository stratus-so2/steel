import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { CreateCrmScheduledPostSchema } from '@/src/schemas/crm-social.schema'
import type { CrmScheduledUploadMedia } from '@/src/services/crm-social.service'
import { CrmScheduledPostService } from '@/src/services/crm-social.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string }> }

const MAX_MEDIA_BYTES = 64 * 1024 * 1024

/**
 * Aceita `application/json` (sem mídia, cliente legado) ou
 * `multipart/form-data` (composer com upload de imagem/vídeo). Campos de
 * texto/JSON são validados via `CreateCrmScheduledPostSchema` depois; aqui só
 * normaliza os dois formatos para o mesmo shape.
 */
async function parseCreateBody(request: NextRequest): Promise<
  | {
      ok: true
      fields: Record<string, unknown>
      media: CrmScheduledUploadMedia[]
    }
  | { ok: false; error: string }
> {
  const contentType = request.headers.get('content-type') ?? ''

  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData().catch(() => null)
    if (!form) return { ok: false, error: 'Formulário inválido' }

    const media: CrmScheduledUploadMedia[] = []
    for (const entry of form.getAll('media')) {
      if (!(entry instanceof File) || entry.size === 0) continue
      if (entry.size > MAX_MEDIA_BYTES) {
        return { ok: false, error: 'Arquivo excede o limite de 64MB' }
      }
      const bytes = await entry.arrayBuffer()
      media.push({
        kind: entry.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        bytes,
        contentType: entry.type || 'application/octet-stream',
      })
    }

    const optionsRaw = form.get('options')
    return {
      ok: true,
      fields: {
        content: form.get('content') ?? '',
        title: form.get('title') || undefined,
        mode: form.get('mode') || 'schedule',
        scheduledFor: form.get('scheduledFor') || undefined,
        platforms: form.getAll('platforms').map(String),
        options:
          typeof optionsRaw === 'string' && optionsRaw
            ? JSON.parse(optionsRaw)
            : undefined,
      },
      media,
    }
  }

  const body = await request.json().catch(() => ({}))
  return { ok: true, fields: body as Record<string, unknown>, media: [] }
}

export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id } = await ctx.params

  const result = await CrmScheduledPostService.list(auth.value.user.id, id)
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
    'POST /api/workspaces/[id]/crm/scheduled-posts',
  )
  if (!consent.ok) return handleError(consent.error)

  const { id } = await ctx.params
  const parsedBody = await parseCreateBody(request)
  if (!parsedBody.ok) {
    return standardError('VALIDATION_ERROR', parsedBody.error)
  }

  const parsed = CreateCrmScheduledPostSchema.safeParse(parsedBody.fields)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmScheduledPostService.create(
    auth.value.user.id,
    id,
    parsed.data,
    parsedBody.media,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value, 201)
})
