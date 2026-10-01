import { withAxiom } from '@/lib/axiom/server'
import { SdPortalService } from '@/src/services/sd-portal.service'
import { handleError, successResponse } from '@/utils/http-response'
import { portalSession } from '../../_support'

type Params = { params: Promise<{ articleId: string }> }

/**
 * Um artigo da base de conhecimento, para o contato externo. Rascunho,
 * artigo interno ou arquivado respondem 404 — nunca o conteúdo.
 */
export const GET = withAxiom(async (_request, ctx: Params) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const { articleId } = await ctx.params
  const result = await SdPortalService.article(session.value, articleId)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
