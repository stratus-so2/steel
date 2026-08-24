import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { badRequest, notFound } from '@/src/errors'
import { getAuthSession } from '@/src/lib/auth-session'
import { getCrmSocialPublishQueue } from '@/src/lib/queue/queues'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { parseCrmPlatformSlug } from '@/src/schemas/crm-social.schema'
import { handleError, successResponse } from '@/utils/http-response'

type Params = {
  params: Promise<{ id: string; platform: string; jobId: string }>
}

/**
 * Status de um publish assíncrono (YOUTUBE/INSTAGRAM — ver `publish/route.ts`).
 * A UI faz polling aqui até `state` virar `completed`/`failed`.
 */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, platform: platformSlug, jobId } = await ctx.params
  const platform = parseCrmPlatformSlug(platformSlug)
  if (platform !== 'YOUTUBE' && platform !== 'INSTAGRAM') {
    return handleError(badRequest('Plataforma inválida para este endpoint'))
  }

  const job = await getCrmSocialPublishQueue().getJob(jobId)
  // `job.data.workspaceId`/`actorId` guardam o dono — sem isso, um usuário
  // poderia adivinhar o id de outro job e ver o resultado de outra pessoa.
  if (
    !job ||
    job.data?.workspaceId !== id ||
    job.data?.actorId !== auth.value.user.id
  ) {
    return handleError(notFound('Publicação'))
  }

  const bullState = await job.getState()

  // O processor devolve `{ ok: false, code, message }` em vez de lançar pra
  // falhas de domínio (ver crm-social-publish.ts) — só assim o `code` do
  // AppError sobrevive até aqui, pra UI saber se deve pedir reconexão.
  // `throw` no processor (bug/infra) ainda vira `bullState === 'failed'`,
  // sem `code`.
  if (bullState === 'completed') {
    const returnValue = job.returnvalue as
      | { ok: true; value: unknown }
      | { ok: false; code: string; message: string }
    if (returnValue.ok) {
      return successResponse({
        state: 'completed',
        result: returnValue.value,
        error: null,
        code: null,
      })
    }
    return successResponse({
      state: 'failed',
      result: null,
      error: returnValue.message,
      code: returnValue.code,
    })
  }

  if (bullState === 'failed') {
    return successResponse({
      state: 'failed',
      result: null,
      error: job.failedReason ?? 'Falha ao publicar',
      code: null,
    })
  }

  return successResponse({
    state: 'pending',
    result: null,
    error: null,
    code: null,
  })
})
