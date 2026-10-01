import type { NextRequest } from 'next/server'
import { consume, sdPortalWriteLimiter } from '@/src/lib/rate-limit'
import type { Result } from '@/src/lib/result'
import { getSdPortalSession } from '@/src/lib/servicedesk/portal-auth'
import type { SdPortalSessionContext } from '@/src/services/sd-portal-access.service'

/**
 * Apoio das rotas públicas do portal do contato externo
 * (`/api/servicedesk/portal/**`): IP do cliente, sessão do cookie próprio e
 * o limitador de escrita por contato. Nenhuma rota do portal lê a sessão do
 * Better Auth.
 */

/** Primeiro IP de `X-Forwarded-For` (ou `unknown`), para o rate limit. */
export function portalClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  )
}

/** Sessão do portal (`Result`) — o service é quem aplica o escopo. */
export function portalSession(): Promise<Result<SdPortalSessionContext>> {
  return getSdPortalSession()
}

/** Limite de escrita do portal: por contato e por IP. */
export async function consumePortalWrite(
  request: NextRequest,
  contactId: string,
): Promise<Result<void>> {
  const byContact = await consume(sdPortalWriteLimiter, `contact:${contactId}`)
  if (!byContact.ok) return byContact
  return consume(sdPortalWriteLimiter, `ip:${portalClientIp(request)}`)
}
