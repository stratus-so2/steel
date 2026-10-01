import { headers } from 'next/headers'
import { unauthorized } from '@/src/errors'
import { annotateRequest } from '@/src/lib/analytics/request-context'
import { auth } from '@/src/lib/auth'
import { err, ok } from '@/src/lib/result'

export async function getAuthSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) return err(unauthorized('Não autenticado'))
  // Usuários únicos do painel Analytics (id interno; no-op fora de rota).
  annotateRequest({ userId: session.user.id })
  return ok(session)
}
