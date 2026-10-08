import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { SteelAiMemoryPage } from '@/app/_components/steel-ai-memory/steel-ai-memory-page'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Memória | Steel AI | Steel',
  description: 'O que o Steel AI lembra sobre você e o espaço de trabalho.',
}

export default async function SteelAiMemoryRoute({
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
    <SteelAiMemoryPage workspaceId={membership.value.workspaceId} slug={slug} />
  )
}
