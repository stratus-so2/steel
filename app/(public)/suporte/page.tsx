import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { SdExtRequestLink } from '@/app/_components/servicedesk/external-portal'
import { getSdPortalSession } from '@/src/lib/servicedesk/portal-auth'

export const metadata: Metadata = {
  title: 'Portal de atendimento',
  robots: { index: false, follow: false },
}

/**
 * `/suporte` — porta de entrada do portal do contato externo: o contato
 * informa o e-mail e recebe o link de acesso. Com a sessão válida no
 * cookie, vai direto para os chamados.
 */
export default async function SdSupportPage() {
  await connection()

  const session = await getSdPortalSession()
  if (session.ok) redirect('/suporte/chamados')

  return <SdExtRequestLink />
}
