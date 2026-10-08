import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { AiUsageOverview } from '@/app/_components/steel-ai-usage/ai-usage-overview'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Uso | Steel AI | Steel',
  description: 'Seu consumo de IA no mês e na semana, comparado à cota.',
}

export default async function SteelAiUsagePage({
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

  return <AiUsageOverview workspaceId={membership.value.workspaceId} />
}
