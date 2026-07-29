import { getAuthSession } from '@/src/lib/auth-session'
import { assertPlatformAdmin } from '@/src/services/authz'

/**
 * Resolve o acesso ao painel admin global para o layout decidir se chama
 * `notFound()`. Deliberadamente NÃO chama `notFound()` aqui — mesma razão de
 * `hasModuleAccess`: chamado através de uma função importada, o Next não
 * reconhece a chamada como parte do render dinâmico do segmento sob Cache
 * Components. `notFound()` precisa ser invocado diretamente no layout.
 */
export async function hasPlatformAdminAccess(): Promise<boolean> {
  const session = await getAuthSession()
  if (!session.ok) return false

  const admin = await assertPlatformAdmin(session.value.user.id)
  return admin.ok
}
