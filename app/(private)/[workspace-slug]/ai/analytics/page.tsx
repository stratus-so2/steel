import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AiUsageAnalytics } from '@/app/_components/steel-ai-usage/ai-usage-analytics'
import { getAuthSession } from '@/src/lib/auth-session'
import { isPrivilegedRole } from '@/src/services/authz'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Análises | Steel AI | Steel',
  description:
    'Gasto com IA por modelo, recurso, escopo e usuário, com exportação em CSV.',
}

export default async function SteelAiAnalyticsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')
  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <AiUsageAnalytics
      workspaceId={membership.value.workspaceId}
      canViewWorkspace={isPrivilegedRole(membership.value.role)}
    />
  )
}
