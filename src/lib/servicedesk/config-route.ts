import type { NextRequest } from 'next/server'
import type { z } from 'zod'
import { withAxiom } from '@/lib/axiom/server'
import { getAuthSession } from '@/src/lib/auth-session'
import { requireConsent } from '@/src/lib/consent'
import { apiLimiter, consume } from '@/src/lib/rate-limit'
import type { Result } from '@/src/lib/result'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'

type RouteParams = Record<string, string>

interface HandlerInput<P extends RouteParams, B, Q> {
  userId: string
  params: P
  body: B
  query: Q
}

interface SdConfigRouteOptions<P extends RouteParams, B, Q> {
  /**
   * Recurso para o gate de consentimento LGPD (ex.: `'POST
   * /api/workspaces/[id]/servicedesk/departments'`). Informe em toda mutação.
   */
  consent?: string
  /** Schema do corpo JSON (mutações). */
  body?: z.ZodType<B>
  /** Aceita corpo vazio como `{}` (ações sem payload). */
  allowEmptyBody?: boolean
  /** Schema da query string (as chaves repetidas viram lista). */
  query?: z.ZodType<Q>
  /** Status HTTP de sucesso (padrão 200). */
  status?: number
  handler: (input: HandlerInput<P, B, Q>) => Promise<Result<unknown>>
}

function queryObject(url: string): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  const { searchParams } = new URL(url)
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    out[key] = values.length > 1 ? values : values[0]
  }
  return out
}

/**
 * Handler padrão das rotas de configuração do ServiceDesk
 * (`app/api/workspaces/[id]/servicedesk/**`), na mesma ordem das rotas do
 * CRM: `withAxiom` → sessão → rate limit → consentimento (mutações) → Zod
 * (query/corpo) → service → `successResponse`/`handleError`. A autorização
 * (admin × agente × solicitante) mora no service.
 */
export function sdConfigRoute<
  P extends RouteParams = { id: string },
  B = undefined,
  Q = undefined,
>(options: SdConfigRouteOptions<P, B, Q>) {
  return withAxiom(
    async (request: NextRequest, ctx: { params: Promise<P> }) => {
      const auth = await getAuthSession()
      if (!auth.ok) return handleError(auth.error)
      const userId = auth.value.user.id

      const limit = await consume(apiLimiter, `user:${userId}`)
      if (!limit.ok) return handleError(limit.error)

      if (options.consent) {
        const consent = await requireConsent(userId, options.consent)
        if (!consent.ok) return handleError(consent.error)
      }

      const params = await ctx.params

      let query = undefined as Q
      if (options.query) {
        const parsed = options.query.safeParse(queryObject(request.url))
        if (!parsed.success) {
          return standardError(
            'VALIDATION_ERROR',
            'Parâmetros inválidos',
            parsed.error.issues,
          )
        }
        query = parsed.data
      }

      let body = undefined as B
      if (options.body) {
        const json = await readJsonBody(request, {
          allowEmpty: options.allowEmptyBody,
        })
        if (!json.ok) return handleError(json.error)
        const parsed = options.body.safeParse(json.value)
        if (!parsed.success) {
          return standardError(
            'VALIDATION_ERROR',
            'Dados inválidos',
            parsed.error.issues,
          )
        }
        body = parsed.data
      }

      const result = await options.handler({ userId, params, body, query })
      if (!result.ok) return handleError(result.error)
      return successResponse(result.value ?? null, options.status ?? 200)
    },
  )
}
