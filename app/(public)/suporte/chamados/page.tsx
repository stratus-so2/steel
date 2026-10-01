import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  SdExtShell,
  SdExtTickets,
} from '@/app/_components/servicedesk/external-portal'
import { getSdPortalSession } from '@/src/lib/servicedesk/portal-auth'

export const metadata: Metadata = {
  title: 'Meus chamados',
  robots: { index: false, follow: false },
}

/** `/suporte/chamados` — os chamados que o contato pode acompanhar. */
export default async function SdSupportTicketsPage() {
  await connection()

  const session = await getSdPortalSession()
  if (!session.ok) redirect('/suporte')

  return (
    <SdExtShell title='Meus chamados'>
      <SdExtTickets />
    </SdExtShell>
  )
}
