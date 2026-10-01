import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  SdExtNewTicket,
  SdExtShell,
} from '@/app/_components/servicedesk/external-portal'
import { getSdPortalSession } from '@/src/lib/servicedesk/portal-auth'

export const metadata: Metadata = {
  title: 'Abrir chamado',
  robots: { index: false, follow: false },
}

/** `/suporte/novo` — o contato abre um chamado pelo portal. */
export default async function SdSupportNewTicketPage() {
  await connection()

  const session = await getSdPortalSession()
  if (!session.ok) redirect('/suporte')

  return (
    <SdExtShell title='Abrir chamado'>
      <SdExtNewTicket />
    </SdExtShell>
  )
}
