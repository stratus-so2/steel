import type { ReactNode } from 'react'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export default async function HomeLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params

  const session = await getAuthSession()
  let workspaceId: string | null = null
  if (session.ok) {
    const membership = await MembershipService.getByUserAndSlug(
      session.value.user.id,
      slug,
    )
    if (membership.ok && membership.value) {
      workspaceId = membership.value.workspaceId
    }
  }

  return <>{children}</>
}
