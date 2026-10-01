import type { IconSvgElement } from '@hugeicons/react'
import {
  CustomerService01Icon,
  Settings02Icon,
} from '@hugeicons-pro/core-stroke-rounded'
import Link from 'next/link'
import type { ReactNode } from 'react'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'
import type { SdPortalViewer } from './sd-portal-server-context'

/** Aviso de portal desligado (`SdSettings.portalEnabled = false`). */
export function SdPortalDisabledNotice({
  slug,
  isAdmin,
}: {
  slug: string
  isAdmin: boolean
}) {
  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 p-8 text-center'>
      <div className='flex size-12 items-center justify-center rounded-2xl border bg-muted/40 text-muted-foreground'>
        <SteelIcon
          icon={CustomerService01Icon}
          strokeWidth={1.8}
          className='size-5'
        />
      </div>
      <p className='font-medium text-sm'>O portal está desativado</p>
      <p className='max-w-sm text-muted-foreground text-xs'>
        Enquanto o portal estiver desligado, os chamados são abertos pela equipe
        de atendimento. Procure o suporte interno da sua empresa.
      </p>
      {isAdmin ? (
        <Link
          href={`/${slug}/servicedesk/settings`}
          className={buttonVariants({ variant: 'outline', size: 'sm' })}
        >
          <SteelIcon icon={Settings02Icon} strokeWidth={2} />
          Ligar o portal nas configurações
        </Link>
      ) : null}
    </div>
  )
}

/**
 * Casca das telas do portal do solicitante: cabeçalho com migalhas e, com o
 * portal desligado, o aviso no lugar do conteúdo.
 */
export function SdPortalShell({
  viewer,
  title = 'Portal do solicitante',
  icon = CustomerService01Icon,
  crumbs,
  children,
}: {
  viewer: SdPortalViewer
  title?: string
  icon?: IconSvgElement
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
      <div className='min-h-0 flex-1 overflow-y-auto'>
        {viewer.portalEnabled ? (
          children
        ) : (
          <SdPortalDisabledNotice
            slug={viewer.workspaceSlug}
            isAdmin={viewer.isAdmin}
          />
        )}
      </div>
    </div>
  )
}
