import type { Metadata } from 'next'
import { connection } from 'next/server'
import {
  SdExtEnter,
  SdExtSessionExpired,
} from '@/app/_components/servicedesk/external-portal'
import { isSdPortalToken } from '@/src/lib/servicedesk/portal-session'

export const metadata: Metadata = {
  title: 'Entrar no portal de atendimento',
  robots: { index: false, follow: false },
}

/**
 * `/suporte/entrar/[token]` — consome o link mágico. O GET só renderiza: a
 * troca pela sessão é um POST disparado no cliente, para que o
 * pré-carregador do cliente de e-mail não queime o link de uso único.
 */
export default async function SdSupportEnterPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  await connection()

  const { token } = await params
  if (!isSdPortalToken(token)) {
    return (
      <SdExtSessionExpired message='Este link de acesso não é válido. Verifique se copiou o endereço completo do e-mail ou peça um novo.' />
    )
  }

  return <SdExtEnter token={token} />
}
