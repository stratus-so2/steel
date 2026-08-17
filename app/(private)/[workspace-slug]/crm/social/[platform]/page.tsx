import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { CrmFacebookStudio } from '@/app/_components/crm/social/crm-facebook-studio'
import { CrmGoogleAdsStudio } from '@/app/_components/crm/social/crm-google-ads-studio'
import { CrmGoogleAnalyticsStudio } from '@/app/_components/crm/social/crm-google-analytics-studio'
import { CrmInstagramStudio } from '@/app/_components/crm/social/crm-instagram-studio'
import { CrmLinkedinStudio } from '@/app/_components/crm/social/crm-linkedin-studio'
import { CrmTiktokStudio } from '@/app/_components/crm/social/crm-tiktok-studio'
import { CrmTwitterStudio } from '@/app/_components/crm/social/crm-twitter-studio'
import { CrmYoutubeStudio } from '@/app/_components/crm/social/crm-youtube-studio'
import { CRM_SOCIAL_PLATFORM_META } from '@/app/_components/crm/social/social-platform-meta'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
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

  const workspaceId = membership.value.workspaceId

  return (
    <div className='flex h-full w-full min-h-0 flex-col'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title={meta.label}>
            <SteelIcon
              icon={meta.icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='h-full min-h-0 flex-1 overflow-y-scroll p-6'>
        {meta.platform === 'FACEBOOK' && (
          <CrmFacebookStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'INSTAGRAM' && (
          <CrmInstagramStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'TIKTOK' && (
          <CrmTiktokStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'YOUTUBE' && (
          <CrmYoutubeStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'GOOGLE_ANALYTICS' && (
          <CrmGoogleAnalyticsStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'TWITTER' && (
          <CrmTwitterStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'GOOGLE_ADS' && (
          <CrmGoogleAdsStudio workspaceId={workspaceId} />
        )}
        {meta.platform === 'LINKEDIN' && (
          <CrmLinkedinStudio workspaceId={workspaceId} />
        )}
      </div>
    </div>
  )
}
