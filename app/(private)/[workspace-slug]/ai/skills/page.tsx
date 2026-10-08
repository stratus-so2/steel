import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SteelAiSkillsPage } from '@/app/_components/steel-ai-skills/steel-ai-skills-page'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Skills | Steel AI | Steel',
  description: 'Instruções reutilizáveis do Steel AI.',
}

export default async function SteelAiSkillsRoute({
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
    <SteelAiSkillsPage workspaceId={membership.value.workspaceId} slug={slug} />
  )
}
