import type { NextRequest } from 'next/server'
import { withAxiom } from '@/lib/axiom/server'
import {
  CreateSdPortalTicketSchema,
  ListSdPortalTicketsSchema,
} from '@/src/schemas/sd-portal.schema'
import { SdPortalService } from '@/src/services/sd-portal.service'
import { readJsonBody } from '@/utils/http-request'
import {
  handleError,
  standardError,
  successResponse,
} from '@/utils/http-response'
import { consumePortalWrite, portalSession } from '../_support'

/**
 * Chamados do contato externo. O escopo (chamados dele ou das empresas
 * dele, conforme `SdSettings.portalCompanyScope`) é aplicado **no
 * service** — a query não escolhe de quem são os chamados.
 */
export const GET = withAxiom(async (request: NextRequest) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const parsed = ListSdPortalTicketsSchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams),
  )
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Filtros inválidos',
      parsed.error.issues,
    )
  }

  const result = await SdPortalService.listTickets(session.value, parsed.data)
  if (!result.ok) return handleError(result.error)
  return successResponse(result.value)
})

/** Abre um chamado pelo portal (canal `PORTAL`, contato como autor). */
export const POST = withAxiom(async (request: NextRequest) => {
  const session = await portalSession()
  if (!session.ok) return handleError(session.error)

  const limit = await consumePortalWrite(request, session.value.contact.id)
  if (!limit.ok) return handleError(limit.error)

  const json = await readJsonBody(request)
  if (!json.ok) return handleError(json.error)
  const parsed = CreateSdPortalTicketSchema.safeParse(json.value)
  if (!parsed.success) {
    return standardError(
      'VALIDATION_ERROR',
      'Dados inválidos',
      parsed.error.issues,
    )
  }

  const created = await SdPortalService.createTicket(session.value, parsed.data)
  if (!created.ok) return handleError(created.error)
  return successResponse(created.value, 201)
})
