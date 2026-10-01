import { withAxiom } from '@/lib/axiom/server'
import { SdPortalService } from '@/src/services/sd-portal.service'
import { handleError, successResponse } from '@/utils/http-response'
import { portalSession } from '../../_support'

type Params = { params: Promise<{ code: string }> }

/**
 * Um chamado do contato, com o histórico público. `code` é o código
 * (`INC-000123`) ou o número — **nunca o id**: o chamado é resolvido por
 * código dentro do escopo da sessão, então não há IDOR por id adivinhado.
 */
export const GET = withAxiom(async (_request, ctx: Params) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const { code } = await ctx.params
  const result = await SdPortalService.getTicket(session.value, code)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
