import type { CRM_SOCIAL_PLATFORMS } from '@/src/schemas/crm-social.schema'
import { facebookProvider } from './facebook'
import { googleAdsProvider } from './google-ads'
import { googleAnalyticsProvider } from './google-analytics'
import { instagramProvider } from './instagram'
import { linkedinProvider } from './linkedin'
import { tiktokProvider } from './tiktok'
import { twitterProvider } from './twitter'
import type { SocialProvider } from './types'
import { youtubeProvider } from './youtube'

/** Registry plataforma → provedor OAuth. */
const PROVIDERS: Record<(typeof CRM_SOCIAL_PLATFORMS)[number], SocialProvider> =
  {
    INSTAGRAM: instagramProvider,
    FACEBOOK: facebookProvider,
    TIKTOK: tiktokProvider,
    YOUTUBE: youtubeProvider,
    GOOGLE_ANALYTICS: googleAnalyticsProvider,
    TWITTER: twitterProvider,
    GOOGLE_ADS: googleAdsProvider,
    LINKEDIN: linkedinProvider,
  }

/** Provedor de uma plataforma (sempre existe — o enum é fechado). */
export function getProvider(
  platform: (typeof CRM_SOCIAL_PLATFORMS)[number],
): SocialProvider {
  return PROVIDERS[platform]
}

export type { SocialAccount, SocialProvider, TokenSet } from './types'
