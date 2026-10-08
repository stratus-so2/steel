import { ChartRelationshipIcon } from '@hugeicons-pro/core-stroke-rounded'
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
import { getAuthSession } from '@/src/lib/auth-session'
import { MembershipService } from '@/src/services/membership.service'
import { IntegrationsManager } from './integrations-manager'

export const metadata: Metadata = {
  title: 'Integrações | Steel',
  description: 'Conecte o Slack, o GitHub e o GitLab a todos os módulos',
}

const PRIVILEGED_ROLES = ['OWNER', 'ADMIN']

export default async function SettingsIntegrationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ 'workspace-slug': string }>
  searchParams: Promise<{ slack?: string }>
}) {
  const [{ 'workspace-slug': slug }, query, session] = await Promise.all([
    params,
    searchParams,
    getAuthSession(),
  ])
  if (!session.ok) redirect('/sign-in')

  const membership = await MembershipService.getByUserAndSlug(
    session.value.user.id,
    slug,
  )
  if (!membership.ok || !membership.value) notFound()

  const canManage = PRIVILEGED_ROLES.includes(membership.value.role)
  const slackResult =
    query.slack === 'connected' || query.slack === 'error' ? query.slack : null

  return (
    <div className='w-full'>
      <HeaderInternalNavigation>
        <HeaderBreadcrumbList>
          <HeaderBreadcrumbCrumb title='Integrações'>
            <SteelIcon
              icon={ChartRelationshipIcon}
              strokeWidth={2}
              className='text-primary'
            />
          </HeaderBreadcrumbCrumb>
        </HeaderBreadcrumbList>
      </HeaderInternalNavigation>
      <div className='mx-auto flex w-full max-w-3xl flex-col gap-6 p-4 md:p-6'>
        <div>
          <H3>Integrações</H3>
          <Muted>
            Conecte o Slack, o GitHub e o GitLab uma vez e use em todos os
            módulos. Tokens e segredos ficam cifrados e nunca são exibidos.
          </Muted>
        </div>
        {canManage ? (
          <IntegrationsManager
            workspaceId={membership.value.workspaceId}
            slackResult={slackResult}
          />
        ) : (
          <Muted>
            Apenas o dono e os administradores do workspace podem gerenciar as
            integrações.
          </Muted>
        )}
      </div>
    </div>
  )
}
