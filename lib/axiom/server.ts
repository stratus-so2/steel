import {
  createAxiomRouteHandler,
  defaultRouteHandlerOnSuccess,
} from '@axiomhq/nextjs'
import { logger } from '@/lib/axiom/logger'
import { recordModuleUsage } from '@/src/lib/usage/module-usage'

export { logger }

/**
 * Além do log padrão da Axiom, cada resposta de sucesso alimenta a contagem
 * de uso por módulo do painel de métricas (só rotas
 * `/api/workspaces/:id/{crm,whatsapp}`; ver src/lib/usage/module-usage.ts).
 * Roda no `after()` do Next, fora do caminho da resposta.
 */
export const withAxiom = createAxiomRouteHandler(logger, {
  onSuccess: (data) => {
    void defaultRouteHandlerOnSuccess(logger, data)
    void recordModuleUsage({
      pathname: new URL(data.req.url).pathname,
      method: data.req.method,
      status: data.res.status,
    })
  },
})
