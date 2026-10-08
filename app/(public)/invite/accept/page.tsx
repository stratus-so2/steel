import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getAuthSession } from '@/src/lib/auth-session'
import { NO_INDEX } from '@/src/lib/seo/metadata'
import { AcceptInvitation } from './accept-invitation'

export const metadata: Metadata = {
  title: 'Aceitar convite | Steel',
  robots: NO_INDEX,
}

type Props = { searchParams: Promise<{ token?: string }> }

export default async function InviteAcceptPage({ searchParams }: Props) {
  const { token } = await searchParams
  if (!token) redirect('/sign-in')

  const auth = await getAuthSession()
  if (!auth.ok) {
    const callback = encodeURIComponent(`/invite/accept?token=${token}`)
    redirect(`/sign-up?redirect=${callback}`)
  }

  return <AcceptInvitation token={token} />
}
