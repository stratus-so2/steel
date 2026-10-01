import 'server-only'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { sdPortalSessionExpired } from '@/src/errors'
import { err, type Result } from '@/src/lib/result'
import {
  SdPortalAccessService,
  type SdPortalSessionContext,
} from '@/src/services/sd-portal-access.service'
import { SD_PORTAL_COOKIE } from './portal-session'

/**
 * Sessão do **portal do contato externo** no servidor: lê o cookie
 * `sd.portal_session` e resolve o contato, o workspace e as empresas dele.
 * Nada de Better Auth — é a única porta de entrada do portal público, usada
 * pelas rotas de `/api/servicedesk/portal/**` e pelas páginas de
 * `/suporte/**`.
 *
 * Devolve `Result`: `SD_PORTAL_SESSION_EXPIRED` sem cookie ou com sessão
 * vencida, `SD_PORTAL_CONTACT_INACTIVE` quando o contato saiu do ar.
 * Memoizado por requisição (`cache`), como `getAuthSession`.
 */
export const getSdPortalSession = cache(
  async (): Promise<Result<SdPortalSessionContext>> => {
    const store = await cookies()
    const token = store.get(SD_PORTAL_COOKIE)?.value
    if (!token) return err(sdPortalSessionExpired('Entre pelo link do e-mail'))
    return SdPortalAccessService.resolveSession(token)
  },
)
