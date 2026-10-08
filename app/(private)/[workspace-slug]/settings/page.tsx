import { Building02Icon } from '@hugeicons-pro/core-stroke-rounded'
import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import {
  HeaderBreadcrumbCrumb,
  HeaderBreadcrumbList,
} from '@/app/_components/header/breadcrumb-page'
import HeaderInternalNavigation from '@/app/_components/header/header-internal-navigation'
import { SteelIcon } from '@/components/icon/icon'
import { H3 } from '@/components/typography/heading/h3'
import { Muted } from '@/components/typography/text/muted'
import { NEXT_PUBLIC_URL } from '@/lib/env/env'
import { getAuthSession } from '@/src/lib/auth-session'
import { toWorkspaceDTO } from '@/src/mappers/workspace.mapper'
import { MembershipService } from '@/src/services/membership.service'
import { WorkspaceGeneralSettings } from './general-settings'

export const metadata: Metadata = {
  title: 'Geral | Steel',
  description: 'Logo, nome, tamanho da empresa e endereço do workspace',
}

export default async function SettingsGeneralPage({
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
    <div className='w-full'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Geral'>
            <SteelIcon
              icon={Building02Icon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='mx-auto w-full max-w-3xl px-4 pt-4 md:px-6 md:pt-6'>
        <H3>Geral</H3>
        <Muted>Identidade e endereço do workspace.</Muted>
      </div>
      <WorkspaceGeneralSettings
        workspace={toWorkspaceDTO(membership.value.workspace)}
        role={membership.value.role}
        appUrl={NEXT_PUBLIC_URL ?? ''}
      />
    </div>
  )
}
