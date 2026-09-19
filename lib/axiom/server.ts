import {
  createAxiomRouteHandler,
  getNextErrorStatusCode,
} from '@axiomhq/nextjs'
import { logger } from '@/lib/axiom/logger'
import { logRequest } from '@/lib/axiom/request-log'
import { geolocateRequest } from '@/src/lib/analytics/geoip'
import {
  type RequestContext,
  runWithRequestContext,
} from '@/src/lib/analytics/request-context'
import { recordModuleUsage } from '@/src/lib/usage/module-usage'

export { logger }

/**
 * Contexto de cada requisição (usuário, workspace, erro de domínio), aberto
 * pelo wrapper abaixo e lido no log depois da resposta. WeakMap: some junto
 * com o `Request`.
 */
const contexts = new WeakMap<Request, RequestContext>()

async function logRouteRequest(
  req: Request,
  start: number,
  end: number,
  statusCode: number,
  error?: unknown,
): Promise<void> {
  logRequest(
    logger,
    {
      method: req.method,
      url: req.url,
      headers: req.headers,
      statusCode,
      startTime: start,
      endTime: end,
      context: contexts.get(req),
      geo: await geolocateRequest(req.headers),
      error,
    },
    'lambda',
  )
  await logger.flush()
}

/**
 * Além do log de requisição (lib/axiom/request-log.ts — rota normalizada,
 * usuário/workspace, erro, país/cidade, sem IP), cada resposta de sucesso
 * alimenta a contagem de uso por módulo do painel de métricas (só rotas
 * `/api/workspaces/:id/{crm,whatsapp}`; ver src/lib/usage/module-usage.ts).
 * Roda no `after()` do Next, fora do caminho da resposta.
 */
const axiomRouteHandler = createAxiomRouteHandler(logger, {
  onSuccess: (data) => {
    void logRouteRequest(data.req, data.start, data.end, data.res.status)
    void recordModuleUsage({
      pathname: new URL(data.req.url).pathname,
      method: data.req.method,
      status: data.res.status,
    })
  },
  onError: (data) => {
    // Mesmo comportamento do handler padrão: a exceção com stack, à parte.
    if (data.error instanceof Error) logger.error(data.error.message, data.error)
    const status =
      data.error instanceof Error ? getNextErrorStatusCode(data.error) : 500
    void logRouteRequest(data.req, data.start, data.end, status, data.error)
  },
})

export const withAxiom: typeof axiomRouteHandler = (handler) =>
  axiomRouteHandler(((req: Request, ctx: unknown) => {
    const context: RequestContext = {}
    contexts.set(req, context)
    return runWithRequestContext(context, () => handler(req as never, ctx))
  }) as typeof handler)
