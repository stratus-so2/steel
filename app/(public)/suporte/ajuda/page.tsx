import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import {
  SdExtKnowledge,
  SdExtShell,
} from '@/app/_components/servicedesk/external-portal'
import { getSdPortalSession } from '@/src/lib/servicedesk/portal-auth'

export const metadata: Metadata = {
  title: 'Ajuda',
  robots: { index: false, follow: false },
}

/** `/suporte/ajuda` — a base de conhecimento publicada no portal. */
export default async function SdSupportHelpPage() {
  await connection()

  const session = await getSdPortalSession()
  if (!session.ok) redirect('/suporte')

  return (
    <SdExtShell>
      <SdExtKnowledge />
    </SdExtShell>
  )
}
