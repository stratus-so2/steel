import { withAxiom } from '@/lib/axiom/server'
import { SdPortalService } from '@/src/services/sd-portal.service'
import { handleError, successResponse } from '@/utils/http-response'
import { portalSession } from '../_support'

/**
 * O que o formulário de abertura do portal oferece: tipos liberados em
 * `portalTicketTypes`, catálogo e modelos marcados como `portalVisible`,
 * urgências e campos customizados com `visibleInPortal`.
 */
export const GET = withAxiom(async () => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const result = await SdPortalService.formOptions(session.value)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
