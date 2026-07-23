import type { CrmQuota } from '@prisma/client'
import type { CrmQuotaDTO } from '@/types/crm-quota'

export function toCrmQuotaDTO(quota: CrmQuota): CrmQuotaDTO {
  return {
    id: quota.id,
    workspaceId: quota.workspaceId,
    ownerId: quota.ownerId,
    period: quota.period,
    periodKey: quota.periodKey,
    targetAmount: Number(quota.targetAmount),
    createdById: quota.createdById,
    updatedById: quota.updatedById,
    createdAt: quota.createdAt.toISOString(),
    updatedAt: quota.updatedAt.toISOString(),
  }
}
