import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import { consume, sdPortalLinkLimiter } from '@/src/lib/rate-limit'
import { RequestSdPortalLinkSchema } from '@/src/schemas/sd-portal.schema'
import { SdPortalAccessService } from '@/src/services/sd-portal-access.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { portalClientIp } from '../_support'

/** Mensagem única: a tela pública nunca revela se o e-mail existe. */
const GENERIC =
  'Se este e-mail estiver cadastrado como contato, o link de acesso chega em instantes.'

/**
 * O contato pede o link mágico do portal (`POST { email }`). Sem sessão.
 * Limitado por IP **e** por e-mail (5/h cada), e a resposta é sempre a
 * mesma, exista ou não o e-mail — não serve para descobrir clientes.
 */
export const POST = withAxiom(async (request: NextRequest) => {
  const byIp = await consume(
    sdPortalLinkLimiter,
    `ip:${portalClientIp(request)}`,
  )
  if (!byIp.ok) return handleError(byIp.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = RequestSdPortalLinkSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const byEmail = await consume(
    sdPortalLinkLimiter,
    `email:${parsed.data.email}`,
  )
  if (!byEmail.ok) return handleError(byEmail.error)

  const result = await SdPortalAccessService.requestByEmail(parsed.data)
  if (!result.ok) return handleError(result.error)

  return successResponse({ message: GENERIC })
})
