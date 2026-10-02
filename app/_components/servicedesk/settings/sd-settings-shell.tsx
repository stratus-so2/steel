'use client'

import { useSearchParams } from 'next/navigation'
import { H3 } from '@/components/typography/heading/h3'
import { Muted } from '@/components/typography/text/muted'
import { Skeleton } from '@/components/ui/skeleton'
import { useSdConfig, useSdMe } from '@/src/hooks/use-sd-config'
import { ReadOnlyNotice, SdSettingsProvider } from './sd-settings-kit'
import { SD_SETTINGS_TABS } from './settings-tabs'

/**
 * Conteúdo das configurações do ServiceDesk: a seção ativa (`?tab=`) do
 * registro em `settings-tabs.tsx`. Não-admins veem tudo em modo leitura.
 *
 * A navegação pelas 24 seções **não** mora aqui: ela vive na barra de
 * contexto do módulo (`SdSettingsNav`, trocada pelo `SdContextRail` do
 * layout). Antes esta tela desenhava um segundo trilho de 240px ao lado do
 * trilho do módulo — e, abaixo de `md`, uma segunda barra horizontal sob o
 * breadcrumb —, o que nenhuma outra tela do app faz. O corpo agora é o do
 * resto da casa: título + descrição em `H3`/`Muted` e as seções em largura
 * cheia, como nas configurações do workspace e do CRM.
 */
export function SdSettingsShell({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams()
  const me = useSdMe(workspaceId)
  const config = useSdConfig(workspaceId)

  const requested = searchParams.get('tab')
  const active =
    SD_SETTINGS_TABS.find((tab) => tab.id === requested) ?? SD_SETTINGS_TABS[0]
  const canEdit = me.data?.isAdmin ?? false

  const ActiveTab = active.component

  return (
    <SdSettingsProvider value={{ workspaceId, canEdit, config: config.data }}>
      <div className='min-h-0 w-full flex-1 overflow-y-auto'>
        <div className='w-full space-y-6 p-6'>
          <div>
            <H3>{active.label}</H3>
            <Muted>{active.description}</Muted>
          </div>

          {me.isLoading || config.isLoading ? (
            <div className='flex flex-col gap-3'>
              <Skeleton className='h-24 w-full' />
              <Skeleton className='h-48 w-full' />
            </div>
          ) : me.error || config.error ? (
            <p className='text-destructive text-sm'>
              {(me.error ?? config.error)?.message ??
                'Não foi possível carregar a configuração.'}
            </p>
          ) : (
            <>
              {!canEdit && !active.personal ? <ReadOnlyNotice /> : null}
              <ActiveTab />
            </>
          )}
        </div>
      </div>
    </SdSettingsProvider>
  )
}
