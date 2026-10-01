import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { SearchSdPortalKbSchema } from '@/src/schemas/sd-portal.schema'
import { SdPortalService } from '@/src/services/sd-portal.service'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { portalSession } from '../_support'

/**
 * Base de conhecimento publicada no portal (`status = PUBLISHED`,
 * `visibility = PORTAL`), no workspace da sessão. Com `?q=` faz a busca;
 * sem, lista os artigos e as categorias.
 */
export const GET = withAxiom(async (request: NextRequest) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const parsed = SearchSdPortalKbSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Filtros inválidos',
      parsed.error.issues,
    )
  }

  const result = await SdPortalService.knowledge(session.value, parsed.data)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})
