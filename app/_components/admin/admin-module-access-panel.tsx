'use client'

import { AlertDiamondIcon } from '@hugeicons-pro/core-stroke-rounded'
import { useState } from 'react'
import { SteelIcon } from '@/components/icon/icon'
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
  // Seeds that failed in the last grant, per module. They stay on screen (not
  // only in a toast that fades) because the module remains half-configured
  // until somebody acts.
  const [warnings, setWarnings] = useState<
    Partial<Record<ModuleKind, string[]>>
  >({})

  async function handleToggle(module: ModuleKind, enabled: boolean) {
    const result = await setEnabled(module, enabled)
    if (!result.ok) {
      notify.error(result.message ?? 'Não foi possível atualizar o módulo.')
      return
    }
    setWarnings((current) => ({ ...current, [module]: result.seedWarnings }))
    if (result.seedWarnings.length > 0) {
      notify.warning(
        'Módulo liberado, mas a configuração padrão não foi criada por completo.',
      )
      return
    }
    notify.success(enabled ? 'Módulo liberado' : 'Módulo revogado')
  }

  if (isLoading) return <Muted>Carregando módulos...</Muted>

  return (
    <div className='divide-y rounded-md border border-border'>
      {access.map((item) => {
        const moduleWarnings = warnings[item.module] ?? []
        return (
          <div key={item.module} className='flex flex-col gap-2 px-3 py-2.5'>
            <div className='flex items-center justify-between gap-3'>
              <p className='min-w-0 truncate font-medium text-sm'>
                {MODULE_LABEL[item.module]}
              </p>
              <Switch
                checked={item.enabled}
                onCheckedChange={(checked) =>
                  handleToggle(item.module, checked)
                }
              />
            </div>
            {moduleWarnings.length > 0 ? (
              <ul
                aria-label={`Avisos de configuração de ${MODULE_LABEL[item.module]}`}
                className='flex flex-col gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 p-2'
              >
                {moduleWarnings.map((warning) => (
                  <li
                    key={warning}
                    className='flex items-start gap-1.5 text-amber-700 text-xs dark:text-amber-400'
                  >
                    <SteelIcon
                      icon={AlertDiamondIcon}
                      strokeWidth={2}
                      className='mt-0.5 size-3.5 shrink-0'
                    />
                    {warning}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
