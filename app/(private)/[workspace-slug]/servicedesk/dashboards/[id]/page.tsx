import {
  ArrowLeft01Icon,
  DashboardSquare01Icon,
  TvSmartIcon,
} from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DashboardCanvas } from '@/app/_components/crm/dashboard/dashboard-canvas'
import { HeaderBreadcrumbCrumb } from '@/app/_components/header/breadcrumb-page'
import {
  getSdDashboard,
  getSdDashboardViewer,
} from '@/app/_components/servicedesk/dashboards/sd-dashboard-server-context'
import { SdPageShell } from '@/app/_components/servicedesk/shell/sd-page-shell'
import { SteelIcon } from '@/components/icon/icon'
import { buttonVariants } from '@/components/ui/button'

export const metadata: Metadata = {
  title: 'Painel | ServiceDesk | Steel',
  description: 'Painel de indicadores do ServiceDesk',
}

export default async function SdDashboardPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string; id: string }>
}) {
  const { 'workspace-slug': slug, id } = await params
  const viewer = await getSdDashboardViewer(slug)
  if (!viewer) notFound()
  const dashboard = viewer.isAgent ? await getSdDashboard(viewer, id) : null
  if (viewer.isAgent && !dashboard) notFound()

  const base = `/${slug}/servicedesk/dashboards`

  return (
    <SdPageShell
      slug={slug}
      title='Painéis'
      icon={DashboardSquare01Icon}
      isAgent={viewer.isAgent}
      crumbs={
        <HeaderBreadcrumbCrumb title={dashboard?.title ?? 'Painel'}>
          <span className='text-muted-foreground'>/</span>
        </HeaderBreadcrumbCrumb>
      }
    >
      <div className='flex h-full min-h-0 flex-col'>
        <div className='flex shrink-0 flex-wrap items-center gap-2 border-b bg-background px-4 py-2'>
          <Link
            href={base}
            className={buttonVariants({ variant: 'ghost', size: 'icon-xs' })}
            aria-label='Voltar para os painéis'
          >
            <SteelIcon icon={ArrowLeft01Icon} strokeWidth={2} />
          </Link>
          <h1 className='min-w-0 flex-1 truncate font-medium text-sm'>
            {dashboard?.title || 'Painel sem título'}
          </h1>
          <Link
            href={`${base}/${id}/tv`}
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <SteelIcon icon={TvSmartIcon} strokeWidth={2} />
            Modo TV
          </Link>
        </div>
        <div className='min-h-0 flex-1'>
          <DashboardCanvas
            workspaceId={viewer.workspaceId}
            dashboardId={id}
            basePath='servicedesk'
          />
        </div>
      </div>
    </SdPageShell>
  )
}
