import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SteelAgentRunView } from '@/app/_components/steel-agents/steel-agent-run-view'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Execução do agente | Steel AI | Steel',
  description: 'Linha do tempo e aprovações de uma execução do agente.',
}

export default async function SteelAgentRunPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; agentId: string; runId: string }>
}) {
  const { 'workspace-slug': slug, agentId, runId } = await params
  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')
  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <SteelAgentRunView
      key={runId}
      workspaceId={membership.value.workspaceId}
      slug={slug}
      agentId={agentId}
      runId={runId}
    />
  )
}
