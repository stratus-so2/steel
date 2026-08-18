'use client'

import { useState } from 'react'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { CrmFacebookStudio } from './crm-facebook-studio'
import { CrmGoogleAdsStudio } from './crm-google-ads-studio'
import { CrmGoogleAnalyticsStudio } from './crm-google-analytics-studio'
import { CrmInstagramStudio } from './crm-instagram-studio'
import { CrmLinkedinStudio } from './crm-linkedin-studio'
import { CrmSocialAccountSwitcher } from './crm-social-account-switcher'
import { CrmTiktokStudio } from './crm-tiktok-studio'
import { CrmTwitterStudio } from './crm-twitter-studio'
import { CrmYoutubeStudio } from './crm-youtube-studio'
import type { CrmSocialPlatformMeta } from './social-platform-meta'

/** Plataformas com suporte a múltiplas contas conectadas (ver crm-social multi-account). */
const MULTI_ACCOUNT_PLATFORMS = new Set(['FACEBOOK', 'INSTAGRAM'])

export function CrmSocialPlatformView({
  workspaceId,
  meta,
}: {
  workspaceId: string
  meta: CrmSocialPlatformMeta
}) {
  const [connectionId, setConnectionId] = useState<string | undefined>(
    undefined,
  )
  const supportsMultiAccount = MULTI_ACCOUNT_PLATFORMS.has(meta.platform)

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
        {supportsMultiAccount && (
          <CrmSocialAccountSwitcher
            workspaceId={workspaceId}
            platform={meta.platform}
            platformSlug={meta.slug}
            connectionId={connectionId}
            onConnectionChange={setConnectionId}
          />
        )}
      </HeaderInternalNavigation>
      <div className='h-full min-h-0 flex-1 overflow-y-scroll p-6'>
        {meta.platform === 'FACEBOOK' && (
          <CrmFacebookStudio
            workspaceId={workspaceId}
            connectionId={connectionId}
          />
        )}
        {meta.platform === 'INSTAGRAM' && (
          <CrmInstagramStudio
            workspaceId={workspaceId}
            connectionId={connectionId}
          />
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
