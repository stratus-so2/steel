import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SteelAgentDetail } from '@/app/_components/steel-agents/steel-agent-detail'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Agente | Steel AI | Steel',
  description: 'Execuções e configuração do agente.',
}

export default async function SteelAgentPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; agentId: string }>
}) {
  const { 'workspace-slug': slug, agentId } = await params
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')
  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <SteelAgentDetail
      key={agentId}
      workspaceId={membership.value.workspaceId}
      slug={slug}
      agentId={agentId}
      currentUserId={session.value.user.id}
    />
  )
}
