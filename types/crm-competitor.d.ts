import type { CrmSocialPlatformDTO } from '@/types/crm-social'

export interface CrmCompetitorDTO {
  id: string
  platform: CrmSocialPlatformDTO
  handle: string
  profileUrl: string | null
  followersCount: number | null
  notes: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}
