import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import { GenerateCrmLandingPageSchema } from '@/src/schemas/crm-landing-page.schema'
import { CrmLandingPageService } from '@/src/services/crm-landing-page.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type Params = { params: Promise<{ id: string; pageId: string }> }

/** Histórico do chat de geração da página. */
export const GET = withAxiom(async (_request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const { id, pageId } = await ctx.params

  const result = await CrmLandingPageService.listMessages(
    auth.value.user.id,
    id,
    pageId,
  )
  if (!result.ok) return handleError(result.error)

  return successResponse(result.value)
})

/**
 * Geração/edição da página via IA. Responde via SSE (`text/event-stream`):
 * cada linha `data: <json>` carrega um chunk { type: "user" | "text" | "done"
 * | "error" }. Auth/validação/configuração são checadas antes de iniciar o
 * stream (viram JSON de erro normal).
 */
export const POST = withAxiom(async (request: NextRequest, ctx: Params) => {
  const auth = await getAuthSession()
  if (!auth.ok) return handleError(auth.error)

  const limit = await consume(apiLimiter, `user:${auth.value.user.id}`)
  if (!limit.ok) return handleError(limit.error)

  const [{ id, pageId }, body] = await Promise.all([ctx.params, request.json()])
  const parsed = GenerateCrmLandingPageSchema.safeParse(body)

  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const result = await CrmLandingPageService.generate({
    actorId: auth.value.user.id,
    workspaceId: id,
    pageId,
    message: parsed.data.message,
    provider: parsed.data.provider,
  })
  if (!result.ok) return handleError(result.error)

  const { run } = result.value
  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))

      try {
        for await (const chunk of run) {
          send(chunk)
        }
      } catch (error) {
        console.error('[crm-landing-page-ai] erro no stream de geração', error)
        send({ type: 'error', message: 'Falha ao gerar a página' })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})
