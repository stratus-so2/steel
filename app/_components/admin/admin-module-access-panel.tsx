'use client'

import { Muted } from '@/components/typography/text/muted'
import { Switch } from '@/components/ui/switch'
import { notify } from '@/lib/notify'
import { useAdminModuleAccess } from '@/src/hooks/use-admin-workspaces'
import type { ModuleKind } from '@/types/workspace-connection'

const MODULE_LABEL: Record<ModuleKind, string> = {
  SERVICE_DESK: 'Service Desk',
  CRM: 'CRM',
  COMMUNICATION: 'WhatsApp / Comunicação',
}

export function AdminModuleAccessPanel({
  workspaceId,
}: {
  workspaceId: string
}) {
  const { access, isLoading, setEnabled } = useAdminModuleAccess(workspaceId)

  async function handleToggle(module: ModuleKind, enabled: boolean) {
    const result = await setEnabled(module, enabled)
    if (!result.ok) {
      notify.error(result.message ?? 'Não foi possível atualizar o módulo.')
      return
    }
    notify.success(enabled ? 'Módulo liberado' : 'Módulo revogado')
  }

  if (isLoading) return <Muted>Carregando módulos...</Muted>

  return (
    <div className='space-y-2'>
      {access.map((item) => (
        <div
          key={item.module}
          className='flex items-center justify-between rounded-md border p-3'
        >
          <p className='font-medium text-sm'>{MODULE_LABEL[item.module]}</p>
          <Switch
            checked={item.enabled}
            onCheckedChange={(checked) => handleToggle(item.module, checked)}
          />
        </div>
      ))}
    </div>
  )
}
