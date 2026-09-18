import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: string
  href?: string
}

/** Área de conteúdo de uma página do admin: largura máxima e respiro. */
export function AdminPage({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'mx-auto w-full min-w-0 max-w-7xl space-y-6 px-4 py-5 sm:px-6 sm:py-6',
        className,
      )}
    >
      {children}
    </div>
  )
}

/**
 * Cabeçalho padrão: breadcrumbs (sempre começando em "Admin"), título,
 * descrição e ações. Título longo quebra em vez de empurrar as ações para
 * fora da tela.
 */
export function AdminPageHeader({
  title,
  description,
  crumbs = [],
  actions,
  meta,
}: {
  title: ReactNode
  description?: ReactNode
  crumbs?: Crumb[]
  actions?: ReactNode
  /** Linha extra sob o título (badges, IDs). */
  meta?: ReactNode
}) {
  const trail: Crumb[] = [{ label: 'Admin', href: '/admin' }, ...crumbs]

  return (
    <header className='space-y-3'>
      <Breadcrumb>
        <BreadcrumbList className='gap-1 text-xs sm:gap-1.5'>
          {trail.map((crumb, index) => {
            const last = index === trail.length - 1
            return (
              <Fragment key={`${crumb.label}-${index}`}>
                <BreadcrumbItem className='min-w-0'>
                  {last || !crumb.href ? (
                    <BreadcrumbPage className='max-w-[40ch] truncate'>
                      {crumb.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink
                      render={<Link href={crumb.href} />}
                      className='max-w-[24ch] truncate'
                    >
                      {crumb.label}
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
                {!last && <BreadcrumbSeparator />}
              </Fragment>
            )
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div className='min-w-0 flex-1 space-y-1'>
          <h1 className='wrap-break-word font-semibold text-xl tracking-tight'>
            {title}
          </h1>
          {description && (
            <p className='text-muted-foreground text-sm'>{description}</p>
          )}
          {meta && (
            <div className='flex flex-wrap items-center gap-1.5 pt-1'>
              {meta}
            </div>
          )}
        </div>
        {actions && (
          <div className='flex shrink-0 flex-wrap items-center gap-2'>
            {actions}
          </div>
        )}
      </div>
    </header>
  )
}
