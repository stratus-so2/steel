'use client'

import { Skeleton } from '@/components/ui/skeleton'
import {
  useCrmCampaign,
  useCrmCampaignOptions,
} from '@/src/hooks/use-crm-campaigns'
import { CrmCampaignDashboard } from './campaign-dashboard'
import { CrmCampaignWizard } from './campaign-wizard'

/** Draft → 4-step wizard; launched → results dashboard. */
export function CrmCampaignView({
  workspaceId,
  workspaceSlug,
  campaignId,
}: {
  workspaceId: string
  workspaceSlug: string
  campaignId: string
}) {
  const campaign = useCrmCampaign(workspaceId, campaignId)
  const options = useCrmCampaignOptions(workspaceId)

  if (campaign.isError) {
    return (
      <div className='p-6 text-center text-muted-foreground text-sm'>
        Campanha não encontrada.
      </div>
    )
  }
  if (!campaign.data || (campaign.data.status === 'DRAFT' && !options.data)) {
    return (
      <div className='flex flex-col gap-4 p-4 sm:p-6'>
        <Skeleton className='h-10 w-64' />
        <Skeleton className='h-80 rounded-xl' />
      </div>
    )
  }

  if (campaign.data.status === 'DRAFT' && options.data) {
    return (
      <CrmCampaignWizard
        key={campaign.data.id}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        campaign={campaign.data}
        options={options.data}
        onRefreshOptions={() => void options.refetch()}
      />
    )
  }

  return (
    <CrmCampaignDashboard
      workspaceId={workspaceId}
      workspaceSlug={workspaceSlug}
      campaign={campaign.data}
    />
  )
}
