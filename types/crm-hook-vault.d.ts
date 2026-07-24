import type { CrmSocialPlatformDTO } from '@/types/crm-social'

export interface CrmHookVaultItemDTO {
  id: string
  text: string
  platform: CrmSocialPlatformDTO | null
  usageCount: number
  notes: string | null
  workspaceId: string
  createdById: string
  updatedById: string | null
  position: number
  createdAt: string
  updatedAt: string
}
