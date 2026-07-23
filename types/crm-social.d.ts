export type CrmSocialPlatformDTO =
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'TIKTOK'
  | 'YOUTUBE'
  | 'TWITTER'
  | 'LINKEDIN'

export type CrmSocialConnectionStatusDTO =
  | 'CONNECTED'
  | 'DISCONNECTED'
  | 'ERROR'

export interface CrmSocialConnectionDTO {
  id: string
  platform: CrmSocialPlatformDTO
  externalAccountId: string
  accountName: string | null
  status: CrmSocialConnectionStatusDTO
  workspaceId: string
  createdById: string
  updatedById: string | null
  createdAt: string
  updatedAt: string
}

export type CrmScheduledPostStatusDTO =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'PUBLISHED'
  | 'FAILED'
export type CrmScheduledPostTargetStatusDTO = 'PENDING' | 'PUBLISHED' | 'FAILED'

export interface CrmScheduledPostTargetDTO {
  id: string
  postId: string
  platform: CrmSocialPlatformDTO
  status: CrmScheduledPostTargetStatusDTO
  error: string | null
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CrmScheduledPostDTO {
  id: string
  content: string
  title: string | null
  status: CrmScheduledPostStatusDTO
  scheduledFor: string | null
  publishedAt: string | null
  workspaceId: string
  createdById: string
  createdAt: string
  updatedAt: string
  targets?: CrmScheduledPostTargetDTO[]
}
