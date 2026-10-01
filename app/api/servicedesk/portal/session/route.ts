import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { consume, sdPortalLinkLimiter } from '@/src/lib/rate-limit'
import {
  SD_PORTAL_COOKIE,
  sdPortalClearCookieOptions,
  sdPortalCookieOptions,
} from '@/src/lib/servicedesk/portal-session'
import { OpenSdPortalSessionSchema } from '@/src/schemas/sd-portal.schema'
import { SdPortalAccessService } from '@/src/services/sd-portal-access.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { portalClientIp, portalSession } from '../_support'

/**
 * Sessão do portal do contato externo, no cookie próprio
 * `sd.portal_session` (`httpOnly`, `secure`, `sameSite=lax`).
 *
 * - `POST { token }` consome o link mágico (uso único) e abre a sessão de
 *   12 horas. Fica no POST de propósito: o GET do link nunca o consome, de
 *   modo que scanners de e-mail não queimam o acesso do contato.
 * - `GET` devolve a sessão corrente.
 * - `DELETE` sai do portal.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  const limit = await consume(
    sdPortalLinkLimiter,
    `open:${portalClientIp(request)}`,
  )
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = OpenSdPortalSessionSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Link de acesso inválido',
      parsed.error.issues,
    )
  }

  const opened = await SdPortalAccessService.openSession(parsed.data.token)
  if (!opened.ok) return handleError(opened.error)

  const store = await cookies()
  store.set(
    SD_PORTAL_COOKIE,
    opened.value.sessionToken,
    sdPortalCookieOptions(opened.value.expiresAt),
  )
  return successResponse(opened.value.session, 201)
})

export const GET = withAxiom(async () => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)
  return successResponse(SdPortalAccessService.toSessionDTO(session.value))
})

export const DELETE = withAxiom(async () => {
  const store = await cookies()
  const token = store.get(SD_PORTAL_COOKIE)?.value
  if (token) await SdPortalAccessService.closeSession(token)
  store.set(SD_PORTAL_COOKIE, '', sdPortalClearCookieOptions())
  return successResponse(null)
})
