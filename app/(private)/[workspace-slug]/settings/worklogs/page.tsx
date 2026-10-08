import { AlarmClockIcon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { WorklogsPanel } from '@/app/_components/settings/worklogs/worklogs-panel'
import { SteelIcon } from '@/components/icon/icon'
import { H3 } from '@/components/typography/heading/h3'
import { Muted } from '@/components/typography/text/muted'
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'

export const metadata: Metadata = {
  title: 'Registros de trabalho | Ajustes | Steel',
  description: 'Horas apontadas e indicadores de produtividade do workspace',
}

export default async function SettingsWorklogsPage({
  params,
}: {
  params: Promise<{ 'workspace-slug': string }>
}) {
  const { 'workspace-slug': slug } = await params

  const session = await getAuthSession()
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  return (
    <div className='w-full overflow-y-auto'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Registros de trabalho'>
            <SteelIcon
              icon={AlarmClockIcon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='w-full max-w-6xl space-y-6 p-4 sm:p-6'>
        <div>
          <H3>Registros de trabalho</H3>
          <Muted>
            Horas apontadas nos chamados e indicadores de produtividade. O dono
            e os administradores veem a equipe; cada membro vê os próprios
            registros.
          </Muted>
        </div>
        <WorklogsPanel workspaceId={membership.value.workspaceId} />
      </div>
    </div>
  )
}
