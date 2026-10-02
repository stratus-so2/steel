import type { IconSvgElement } from '@hugeicons/react'
import { LockIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { ReactNode } from 'react'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'

/**
 * Casca das telas de cadastro do ServiceDesk: cabeçalho com breadcrumb e,
 * para solicitantes (sem departamento), um aviso no lugar da tela — os
 * cadastros são exclusivos de agentes.
 */
export function SdDirectoryShell({
  title,
  icon,
  isAgent,
  children,
}: {
  title: string
  icon: IconSvgElement
  isAgent: boolean
  children: ReactNode
}) {
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title={title}>
            <SteelIcon icon={icon} strokeWidth={2} className='text-primary' />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='min-h-0 flex-1'>
        {isAgent ? (
          children
        ) : (
          <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
            <div className='flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/40 text-muted-foreground'>
              <SteelIcon icon={LockIcon} strokeWidth={1.8} className='size-5' />
            </div>
            <p className='font-medium text-sm'>Acesso restrito a agentes</p>
            <p className='max-w-sm text-muted-foreground text-xs'>
              Os cadastros do ServiceDesk ficam disponíveis para membros de um
              departamento de atendimento. Peça a um administrador para incluir
              você em um departamento.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
