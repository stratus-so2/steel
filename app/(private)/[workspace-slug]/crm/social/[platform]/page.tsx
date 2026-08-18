import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CrmSocialPlatformView } from '@/app/_components/crm/social/crm-social-platform-view'
import { CRM_SOCIAL_PLATFORM_META } from '@/app/_components/crm/social/social-platform-meta'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ platform: string }>
}): Promise<Metadata> {
  const { platform } = await params
  const meta = CRM_SOCIAL_PLATFORM_META.find((p) => p.slug === platform)
  return {
    title: `${meta?.label ?? 'Social'} | CRM | Steel`,
    description: `Integração com ${meta?.label ?? 'a rede social'}`,
  }
}

export default async function CrmSocialPlatformPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; platform: string }>
}) {
  const { 'workspace-slug': slug, platform: platformSlug } = await params

  const meta = CRM_SOCIAL_PLATFORM_META.find((p) => p.slug === platformSlug)
  if (!meta) notFound()

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <CrmSocialPlatformView
      workspaceId={membership.value.workspaceId}
      meta={meta}
    />
  )
}
