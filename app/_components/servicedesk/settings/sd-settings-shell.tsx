'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { SteelIcon } from '@/components/icon/icon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useSdConfig, useSdMe } from '@/src/hooks/use-sd-config'
import { ReadOnlyNotice, SdSettingsProvider } from './sd-settings-kit'
import { SD_SETTINGS_TABS } from './settings-tabs'

/**
 * Tela de configurações do ServiceDesk: navegação lateral pelas abas do
 * registro (`settings-tabs.tsx`) e conteúdo da aba ativa (`?tab=`).
 * Não-admins veem tudo em modo leitura.
 */
export function SdSettingsShell({ workspaceId }: { workspaceId: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const me = useSdMe(workspaceId)
  const config = useSdConfig(workspaceId)

  const requested = searchParams.get('tab')
  const active =
    SD_SETTINGS_TABS.find((tab) => tab.id === requested) ?? SD_SETTINGS_TABS[0]
  const canEdit = me.data?.isAdmin ?? false

  function select(tabId: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', tabId)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const ActiveTab = active.component

  return (
    <SdSettingsProvider value={{ workspaceId, canEdit, config: config.data }}>
      <div className='flex h-full min-h-0 flex-1 flex-col md:flex-row'>
        <nav
          aria-label='Seções das configurações'
          className='flex shrink-0 gap-1 overflow-x-auto border-b border-border p-3 md:w-60 md:flex-col md:overflow-y-auto md:border-r md:border-b-0'
        >
          {SD_SETTINGS_TABS.map((tab) => (
            <button
              key={tab.id}
              type='button'
              onClick={() => select(tab.id)}
              aria-current={tab.id === active.id ? 'page' : undefined}
              className={cn(
                'flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
                tab.id === active.id
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
              )}
            >
              <SteelIcon icon={tab.icon} strokeWidth={2} />
              {tab.label}
            </button>
          ))}
        </nav>

        <div className='min-h-0 flex-1 overflow-y-auto'>
          <div className='mx-auto flex max-w-5xl flex-col gap-5 p-6'>
            <header className='flex flex-col gap-1'>
              <h2 className='flex items-center gap-2 text-lg font-semibold'>
                <SteelIcon
                  icon={active.icon}
                  strokeWidth={2}
                  className='text-primary'
                />
                {active.label}
              </h2>
              <p className='text-sm text-muted-foreground'>
                {active.description}
              </p>
            </header>

            {me.isLoading || config.isLoading ? (
              <div className='flex flex-col gap-3'>
                <Skeleton className='h-24 w-full' />
                <Skeleton className='h-48 w-full' />
              </div>
            ) : me.error || config.error ? (
              <p className='text-sm text-destructive'>
                {(me.error ?? config.error)?.message ??
                  'Não foi possível carregar a configuração.'}
              </p>
            ) : (
              <>
                {!canEdit ? <ReadOnlyNotice /> : null}
                <ActiveTab />
              </>
            )}
          </div>
        </div>
      </div>
    </SdSettingsProvider>
  )
}
