import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  SdExtShell,
  SdExtTicket,
} from '@/app/_components/servicedesk/external-portal'
import { getSdPortalSession } from '@/src/lib/servicedesk/portal-auth'

export const metadata: Metadata = {
  title: 'Chamado',
  robots: { index: false, follow: false },
}

/**
 * `/suporte/chamados/[code]` — a tela do chamado. `code` é o código
 * (`INC-000123`) ou o número; o service resolve dentro do escopo do
 * contato, então um código de outra empresa responde "não encontramos".
 */
export default async function SdSupportTicketPage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  await connection()

  const session = await getSdPortalSession()
  if (!session.ok) redirect('/suporte')

  const { code } = await params
  return (
    <SdExtShell>
      <SdExtTicket code={decodeURIComponent(code)} />
    </SdExtShell>
  )
}
