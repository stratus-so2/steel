'use client'

import { Add01Icon } from '@hugeicons-pro/core-stroke-rounded'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useCrmSocialConnections } from '@/src/hooks/use-crm-social'
import type { CrmSocialPlatformDTO } from '@/types/crm-social'

/**
 * Dropdown de contas conectadas + atalho para conectar outra, no breadcrumb
 * da página da plataforma. Só plataformas com suporte a múltiplas contas
 * (hoje: Facebook/Instagram) chamam este componente.
 */
export function CrmSocialAccountSwitcher({
  workspaceId,
  platform,
  platformSlug,
  connectionId,
  onConnectionChange,
}: {
  workspaceId: string
  platform: CrmSocialPlatformDTO
  platformSlug: string
  connectionId: string | undefined
  onConnectionChange: (connectionId: string | undefined) => void
}) {
  const connectionsQuery = useCrmSocialConnections(workspaceId, platform)
  const connections = connectionsQuery.data ?? []

  return (
    <div className='flex items-center gap-1.5'>
      {connections.length > 0 && (
        <Select
          value={connectionId}
          onValueChange={(value) => onConnectionChange(value ?? undefined)}
        >
          <SelectTrigger size='sm' className='max-w-48'>
            <SelectValue placeholder='Selecione a conta' />
          </SelectTrigger>
          <SelectContent alignItemWithTrigger={false}>
            <SelectGroup>
              {connections.map((connection) => (
                <SelectItem key={connection.id} value={connection.id}>
                  {connection.accountName ?? connection.externalAccountId}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
      <a
        href={`/api/workspaces/${workspaceId}/crm/social/${platformSlug}/connect`}
        aria-label='Conectar outra conta'
        className={buttonVariants({ size: 'icon-sm', variant: 'outline' })}
      >
        <SteelIcon icon={Add01Icon} size={14} />
      </a>
    </div>
  )
}
