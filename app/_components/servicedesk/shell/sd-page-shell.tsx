import type { IconSvgElement } from '@hugeicons/react'
import { LockIcon } from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'

/** Aviso para solicitantes nas telas de agente (quadros, início…). */
export function SdAgentOnlyNotice({ slug }: { slug: string }) {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
      <div className='flex size-12 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground'>
        <SteelIcon icon={LockIcon} strokeWidth={1.8} className='size-5' />
      </div>
      <p className='font-medium text-sm'>Esta tela é só para agentes</p>
      <p className='max-w-sm text-muted-foreground text-xs'>
        Acompanhe e abra seus chamados pelo portal do solicitante. Se você
        atende chamados, peça a um administrador para incluir você em um
        departamento.
      </p>
      <Link
        href={`/${slug}/servicedesk/portal`}
        className={buttonVariants({ size: 'sm' })}
      >
        Ir para o portal
      </Link>
    </div>
  )
}

/**
 * Casca das telas de chamados: cabeçalho com breadcrumb e, para
 * solicitantes, o aviso no lugar do conteúdo.
 */
export function SdPageShell({
  slug,
  title,
  icon,
  isAgent,
  crumbs,
  children,
}: {
  slug: string
  title: string
  icon: IconSvgElement
  isAgent: boolean
  /** Migalhas extras depois do título (ex.: código do chamado). */
  crumbs?: ReactNode
  children: ReactNode
}) {
  return (
    <div className='flex h-full min-h-0 w-full flex-col'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title={title}>
            <SteelIcon icon={icon} strokeWidth={2} className='text-primary' />
          </HeaderBreadcrumbCrumb>
          {crumbs}
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='min-h-0 flex-1'>
        {isAgent ? children : <SdAgentOnlyNotice slug={slug} />}
      </div>
    </div>
  )
}
